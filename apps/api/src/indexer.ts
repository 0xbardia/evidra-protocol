import {
  CONTRACT_ADDRESSES,
  FROZEN_NETWORK,
  parseJsonBounded,
  type EventPage,
  type ProtocolClient,
  type ProtocolEvent,
  type RequestRecord,
  type ResolutionRecord,
} from '@evidra/protocol';
import type { ProjectionRepository, ProjectionStatus } from '@evidra/db';

export interface IndexerLogger {
  info(data: object, message?: string): void;
  warn(data: object, message?: string): void;
  error(data: object, message?: string): void;
}

export interface IndexerOptions {
  intervalMs: number;
  maxRecords: number;
  enabled: boolean;
  maxMutableRequests: number;
  configRefreshMs: number;
}

export interface IndexerStatus {
  enabled: boolean;
  running: boolean;
  lastStartedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
  lagSeconds: number | null;
}

const EMPTY_STATUS: IndexerStatus = {
  enabled: false,
  running: false,
  lastStartedAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastDurationMs: null,
  lagSeconds: null,
};

interface EventDelta { events: ProtocolEvent[]; nextOffset: bigint; }

interface ProtocolProjection {
  config: Awaited<ReturnType<ProtocolClient['registry']['getProtocolConfig']>>;
  registryVersion: string;
  resolverVersion: string;
  policyRegistryVersion: string;
  resolverInfo: Awaited<ReturnType<ProtocolClient['registry']['getResolver']>>;
  checkedAt: number;
}

function parseEventPayload(event: ProtocolEvent): Record<string, unknown> {
  try {
    const value = parseJsonBounded<unknown>(event.payload, `event.${event.topic}.payload`, 16 * 1024);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export class ChainIndexer {
  private readonly options: IndexerOptions;
  private readonly logger: IndexerLogger;
  private timer: NodeJS.Timeout | undefined;
  private status: IndexerStatus;
  private syncing = false;
  private projection: ProtocolProjection | undefined;

  constructor(
    private readonly protocol: ProtocolClient,
    private readonly repository: ProjectionRepository,
    logger: IndexerLogger,
    options: Partial<IndexerOptions> = {},
  ) {
    this.options = {
      intervalMs: options.intervalMs ?? 300_000,
      maxRecords: options.maxRecords ?? 100_000,
      enabled: options.enabled ?? true,
      maxMutableRequests: options.maxMutableRequests ?? 4,
      configRefreshMs: options.configRefreshMs ?? 21_600_000,
    };
    this.logger = logger;
    this.status = { ...EMPTY_STATUS, enabled: this.options.enabled };
  }

  getStatus(): IndexerStatus { return { ...this.status }; }

  async start(): Promise<void> {
    if (!this.options.enabled || this.timer) return;
    try { await this.syncOnce(); } catch (error) { this.logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'initial chain sync failed; retrying on interval'); }
    this.timer = setInterval(() => { void this.syncOnce().catch(() => {}); }, this.options.intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    while (this.syncing) await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async syncOnce(): Promise<void> {
    if (this.syncing) return;
    if (this.protocol.isHardQuotaCoolingDown()) {
      this.status = { ...this.status, running: false, lastError: 'rpc_hard_quota_cooldown' };
      return;
    }
    this.syncing = true;
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    this.status = { ...this.status, running: true, lastStartedAt: startedAt, lastError: null };
    try { await this.repository.setSyncStatus({ status: 'syncing', lastAttemptAt: startedAt, lastError: null }); }
    catch (error) { this.logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'could not write sync-start status'); }
    try {
      const checkpoint = await this.repository.getSyncStatus();
      const registryStats = await this.protocol.registry.getProtocolStats();
      const policyEventCount = await this.protocol.policyRegistry.getEventCount();
      const projection = await this.getProtocolProjection(checkpoint);
      await this.repository.upsertProtocolState({
        chainId: FROZEN_NETWORK.chainId,
        networkName: FROZEN_NETWORK.name,
        registryAddress: CONTRACT_ADDRESSES.registry,
        policyRegistryAddress: CONTRACT_ADDRESSES.policyRegistry,
        resolverAddress: CONTRACT_ADDRESSES.resolver,
        consumerProbeAddress: CONTRACT_ADDRESSES.consumerProbe,
        registryVersion: projection.registryVersion,
        resolverVersion: projection.resolverVersion,
        policyRegistryVersion: projection.policyRegistryVersion,
        paused: registryStats.paused,
        resolverEnabled: projection.resolverInfo.enabled,
        defaultResolver: projection.config.default_resolver,
        config: projection.config,
        stats: registryStats,
      });

      const previousPolicyEvents = BigInt(checkpoint.observedEventCounts.policy ?? '0');
      const previousRegistryEvents = BigInt(checkpoint.observedEventCounts.registry ?? '0');
      const [policyDelta, registryDelta] = await Promise.all([
        this.readEventDelta((offset, limit) => this.protocol.policyRegistry.getEvents(offset, limit), previousPolicyEvents, policyEventCount),
        this.readEventDelta((offset, limit) => this.protocol.registry.getEvents(offset, limit), previousRegistryEvents, registryStats.event_count),
      ]);
      await this.syncPoliciesAndTemplates(policyDelta.events);

      const previousRequestId = checkpoint.lastRequestId ?? 0n;
      const previousResolutionId = checkpoint.lastResolutionId ?? 0n;
      const requestEnd = registryStats.request_count;
      const resolutionEnd = registryStats.resolution_count;
      const newRequestIds = this.range(previousRequestId + 1n, requestEnd);
      const newResolutionIds = this.range(previousResolutionId + 1n, resolutionEnd);
      const mutableIds = await this.repository.listMutableRequestIds(this.options.maxMutableRequests);
      const requestIds = [...new Set([...newRequestIds, ...mutableIds].map((id) => id.toString()))].map(BigInt);
      const requests = await this.syncRequests(requestIds);
      const resolutions = await this.syncResolutions(newResolutionIds);
      await this.repository.refreshFactFreshness();
      await this.syncFacts(requests, resolutions);

      const finished = Date.now();
      const finishedAt = new Date(finished).toISOString();
      const nextRequestId = newRequestIds.at(-1) ?? previousRequestId;
      const nextResolutionId = newResolutionIds.at(-1) ?? previousResolutionId;
      this.status = { ...this.status, running: false, lastSuccessAt: finishedAt, lastError: null, lastDurationMs: finished - started, lagSeconds: 0 };
      await this.repository.setSyncStatus({
        status: 'healthy',
        lastFinalizedAt: finishedAt,
        lastSuccessAt: finishedAt,
        lastError: null,
        observedEventCounts: { policy: policyDelta.nextOffset.toString(), registry: registryDelta.nextOffset.toString() },
        lastRequestId: nextRequestId,
        lastResolutionId: nextResolutionId,
        lastProtocolConfigCheckAt: new Date(projection.checkedAt).toISOString(),
      });
      this.logger.info({ durationMs: finished - started, requests: requests.length, resolutions: resolutions.length, policyEvents: policyDelta.events.length, registryEvents: registryDelta.events.length, rpcMetrics: this.protocol.getRpcMetrics() }, 'incremental chain sync complete');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const finished = Date.now();
      this.status = { ...this.status, running: false, lastError: message, lastDurationMs: finished - started };
      try { await this.repository.setSyncStatus({ status: this.protocol.isHardQuotaCoolingDown() ? 'rate_limited' : 'degraded', lastError: message }); }
      catch (statusError) { this.logger.warn({ error: statusError instanceof Error ? statusError.message : String(statusError) }, 'could not write sync-error status'); }
      this.logger.error({ error: message }, 'chain sync failed');
      throw error;
    } finally {
      this.syncing = false;
    }
  }

  private async getProtocolProjection(checkpoint: ProjectionStatus): Promise<ProtocolProjection> {
    const checkpointAt = checkpoint.lastProtocolConfigCheckAt ? Date.parse(checkpoint.lastProtocolConfigCheckAt) : 0;
    if (this.projection && Date.now() - this.projection.checkedAt < this.options.configRefreshMs) return this.projection;
    if (this.projection && checkpointAt > 0 && Date.now() - checkpointAt < this.options.configRefreshMs) return this.projection;
    const [config, resolverVersion, resolverInfo, registryVersion, policyRegistryVersion] = await Promise.all([
      this.protocol.registry.getProtocolConfig(),
      this.protocol.resolver.getResolverVersion(),
      this.protocol.registry.getResolver(CONTRACT_ADDRESSES.resolver),
      this.protocol.registry.getRegistryVersion(),
      this.protocol.policyRegistry.getRegistryVersion(),
    ]);
    this.projection = { config, resolverVersion, resolverInfo, registryVersion, policyRegistryVersion, checkedAt: Date.now() };
    return this.projection;
  }

  private async readEventDelta(getPage: (offset: number, limit: number) => Promise<EventPage>, previous: bigint, current: bigint): Promise<EventDelta> {
    if (current <= previous) return { events: [], nextOffset: previous };
    const output: ProtocolEvent[] = [];
    let offset = previous;
    while (offset < current && output.length < this.options.maxRecords) {
      const page = await getPage(Number(offset), Math.min(50, this.options.maxRecords - output.length));
      output.push(...page.items.slice(0, Math.max(0, this.options.maxRecords - output.length)));
      if (page.items.length === 0) break;
      offset += BigInt(page.items.length);
    }
    return { events: output, nextOffset: offset };
  }

  private range(start: bigint, end: bigint): bigint[] {
    if (end < start) return [];
    const output: bigint[] = [];
    for (let id = start; id <= end && output.length < this.options.maxRecords; id += 1n) output.push(id);
    return output;
  }

  private async syncPoliciesAndTemplates(events: ProtocolEvent[]): Promise<void> {
    for (const event of events) {
      const payload = parseEventPayload(event);
      if (event.topic === 'PolicyPublished' || event.topic === 'PolicyDeprecated') {
        const policyId = String(payload.policy_id ?? '');
        const version = Number(payload.version ?? 0);
        if (policyId && version > 0) await this.repository.upsertPolicy(await this.protocol.policyRegistry.getSourcePolicy(policyId, version));
      }
      if (event.topic === 'TemplatePublished' || event.topic === 'TemplateDeprecated') {
        const templateId = String(payload.template_id ?? '');
        const version = Number(payload.version ?? 0);
        if (templateId && version > 0) await this.repository.upsertTemplate(await this.protocol.policyRegistry.getTemplate(templateId, version));
      }
    }
  }

  private async syncRequests(ids: bigint[]): Promise<RequestRecord[]> {
    const requests: RequestRecord[] = [];
    for (const id of ids) {
      const request = await this.protocol.registry.getRequest(id);
      if (!request.exists) continue;
      await this.repository.upsertRequest(request);
      requests.push(request);
    }
    return requests;
  }

  private async syncResolutions(ids: bigint[]): Promise<ResolutionRecord[]> {
    const resolutions: ResolutionRecord[] = [];
    for (const id of ids) {
      const resolution = await this.protocol.registry.getResolution(id);
      if (resolution.exists) resolutions.push(resolution);
    }
    return resolutions;
  }

  private async syncFacts(requests: RequestRecord[], resolutions: ResolutionRecord[]): Promise<void> {
    const factKeys = new Set(requests.map((request) => request.fact_key));
    for (const resolution of resolutions) factKeys.add(resolution.fact_key);
    for (const factKey of factKeys) {
      const fact = await this.protocol.registry.getFact(factKey);
      if (!fact.exists) continue;
      const latestId = fact.latest_resolution_id === 0n ? fact.current_resolution_id : fact.latest_resolution_id;
      const affectedResolutions = resolutions.filter((item) => item.fact_key === fact.fact_key);
      for (const resolution of affectedResolutions) {
        await this.repository.upsertResolution(resolution, { canonical: resolution.resolution_id === fact.current_resolution_id, latest: resolution.resolution_id === latestId });
        const manifest = await this.protocol.registry.getEvidenceManifest(resolution.resolution_id);
        if (manifest.exists) await this.repository.replaceEvidence(manifest);
      }
      await this.repository.setResolutionFlags(fact.fact_key, fact.current_resolution_id, latestId);
      const fresh = fact.mutability === 'IMMUTABLE' || fact.valid_until > BigInt(Math.floor(Date.now() / 1000));
      await this.repository.upsertFact(fact, fresh);
    }
  }
}
