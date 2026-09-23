import {
  chains,
  createClient as createGenLayerClient,
} from 'genlayer-js';
import { TransactionHashVariant } from 'genlayer-js/types';
import type { ContractName } from './constants.js';
import { CONTRACT_ADDRESSES, FROZEN_NETWORK, assertAddress, assertFrozenDeployment, normalizeAddress } from './constants.js';
import { ProtocolReadError } from './errors.js';
import { boundedPage } from './pagination.js';
import {
  normalizeEvidenceManifest,
  normalizeEventPage,
  normalizeHistoryPage,
  toAddress,
  toBigInt,
  toNumber,
} from './serialization.js';
import { RpcScheduler, type SchedulerOptions } from './scheduler.js';
import type {
  Address,
  EventPage,
  EvidenceManifestView,
  FactRecord,
  KnownOrUnknown,
  OwnershipView,
  ProtocolConfig,
  ProtocolStats,
  ReadMeta,
  RequestRecord,
  ResolutionHistoryPage,
  ResolutionRecord,
  ResolverCapabilities,
  ResolverInfo,
  SourcePolicyRecord,
  TemplateRecord,
  U256,
} from './types.js';

export type ReadMode = 'latest-final' | 'latest-nonfinal';

export interface ContractReadArgs {
  address: string;
  functionName: string;
  args: readonly unknown[];
  transactionHashVariant: ReadMode;
}

export interface ReadTransport {
  readContract(args: ContractReadArgs): Promise<unknown>;
  chainId(): Promise<number>;
}

export interface ProtocolClientOptions {
  rpcUrl?: string;
  readMode?: ReadMode;
  scheduler?: RpcScheduler;
  schedulerOptions?: SchedulerOptions;
  transport?: ReadTransport;
  subsystem?: string;
}

function record(value: unknown, method: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${method} returned a non-record value`);
  return value as Record<string, unknown>;
}

function text(value: unknown): string { return String(value ?? ''); }
function flag(value: unknown): boolean { return Boolean(value); }
function n(value: unknown, field: string): number { return toNumber(value, field); }
function big(value: unknown, field: string): bigint { return toBigInt(value, field); }
function addr(value: unknown, field: string): string { return toAddress(value, field); }
function inputText(value: string, field: string, max = 2048): string { if (typeof value !== 'string' || value.trim() === '' || value.length > max) throw new Error(`${field} must be a non-empty bounded string`); return value; }
function inputVersion(value: number, field: string): number { if (!Number.isInteger(value) || value < 1) throw new Error(`${field} must be a positive integer`); return value; }
function inputU256(value: U256, field: string): U256 { const result = toBigInt(value, field); if (result < 0n) throw new Error(`${field} must be non-negative`); return result; }
function inputFactKey(value: string): string { if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('factKey must be a 32-byte hex string'); return value; }

function normalizePolicy(value: unknown): SourcePolicyRecord {
  const r = record(value, 'get_source_policy');
  return {
    exists: flag(r.exists), policy_id: text(r.policy_id), version: n(r.version, 'policy.version'), name: text(r.name),
    active: flag(r.active), min_primary_sources: n(r.min_primary_sources, 'policy.min_primary_sources'),
    min_independent_sources: n(r.min_independent_sources, 'policy.min_independent_sources'),
    allowed_classes: text(r.allowed_classes), disallowed_classes: text(r.disallowed_classes),
    require_cross_check: flag(r.require_cross_check), semantic_rules: text(r.semantic_rules), policy_hash: text(r.policy_hash),
    published_at: big(r.published_at, 'policy.published_at'), deprecated: flag(r.deprecated),
  };
}

function normalizeTemplate(value: unknown): TemplateRecord {
  const r = record(value, 'get_template');
  return {
    exists: flag(r.exists), template_id: text(r.template_id), version: n(r.version, 'template.version'), name: text(r.name),
    active: flag(r.active), fact_type: text(r.fact_type), required_fields: text(r.required_fields),
    resolution_instructions: text(r.resolution_instructions), default_policy_id: text(r.default_policy_id),
    default_policy_version: n(r.default_policy_version, 'template.default_policy_version'), template_hash: text(r.template_hash),
    published_at: big(r.published_at, 'template.published_at'), deprecated: flag(r.deprecated),
  };
}

function normalizeOwnership(value: unknown): OwnershipView {
  const r = record(value, 'get_ownership');
  return { owner: addr(r.owner, 'ownership.owner'), pending_owner: addr(r.pending_owner, 'ownership.pending_owner') };
}

function normalizeResolver(value: unknown): ResolverInfo {
  const r = record(value, 'get_resolver');
  return { exists: flag(r.exists), resolver: addr(r.resolver, 'resolver.resolver'), enabled: flag(r.enabled), resolver_version: text(r.resolver_version), capabilities: text(r.capabilities), registered_at: big(r.registered_at, 'resolver.registered_at') };
}

function normalizeRequest(value: unknown): RequestRecord {
  const r = record(value, 'get_request');
  return {
    exists: flag(r.exists), request_id: big(r.request_id, 'request.request_id'), requester: addr(r.requester, 'request.requester'),
    claim_key: text(r.claim_key), fact_key: text(r.fact_key), spec_hash: text(r.spec_hash), policy_hash: text(r.policy_hash),
    policy_id: text(r.policy_id), policy_version: n(r.policy_version, 'request.policy_version'), assigned_resolver: addr(r.assigned_resolver, 'request.assigned_resolver'),
    created_at: big(r.created_at, 'request.created_at'), status: text(r.status) as RequestRecord['status'], active_attempt_id: big(r.active_attempt_id, 'request.active_attempt_id'),
    last_attempt_at: big(r.last_attempt_at, 'request.last_attempt_at'), retry_after: big(r.retry_after, 'request.retry_after'), max_attempts: n(r.max_attempts, 'request.max_attempts'),
    attempt_count: n(r.attempt_count, 'request.attempt_count'), callback_target: addr(r.callback_target, 'request.callback_target'), callback_status: text(r.callback_status) as RequestRecord['callback_status'],
    reuse_mode: text(r.reuse_mode) as RequestRecord['reuse_mode'], fee_paid: big(r.fee_paid, 'request.fee_paid'), mutability: text(r.mutability) as RequestRecord['mutability'],
    schema_version: text(r.schema_version), ttl_seconds: big(r.ttl_seconds, 'request.ttl_seconds'), seed_urls_json: text(r.seed_urls_json), subject: text(r.subject), predicate: text(r.predicate), object_value: text(r.object_value), qualifiers: text(r.qualifiers), temporal: text(r.temporal), description: text(r.description), current_resolution_id: big(r.current_resolution_id, 'request.current_resolution_id'), supplemental_urls_json: text(r.supplemental_urls_json), template_id: text(r.template_id), template_version: n(r.template_version, 'request.template_version'), template_hash: text(r.template_hash), fact_type: text(r.fact_type), template_resolution_instructions: text(r.template_resolution_instructions),
  };
}

function normalizeResolution(value: unknown): ResolutionRecord {
  const r = record(value, 'get_resolution');
  return {
    exists: flag(r.exists), resolution_id: big(r.resolution_id, 'resolution.resolution_id'), request_id: big(r.request_id, 'resolution.request_id'), attempt_id: big(r.attempt_id, 'resolution.attempt_id'), claim_key: text(r.claim_key), fact_key: text(r.fact_key), spec_hash: text(r.spec_hash), policy_hash: text(r.policy_hash), outcome: text(r.outcome), diagnostic_reason: text(r.diagnostic_reason), policy_satisfied: flag(r.policy_satisfied), resolver_version: text(r.resolver_version), evidence_manifest_hash: text(r.evidence_manifest_hash), reasoning_summary: text(r.reasoning_summary), evaluated_at: big(r.evaluated_at, 'resolution.evaluated_at'), committed_at: big(r.committed_at, 'resolution.committed_at'), valid_until: big(r.valid_until, 'resolution.valid_until'), resolution_version: n(r.resolution_version, 'resolution.resolution_version'), supersedes_resolution_id: big(r.supersedes_resolution_id, 'resolution.supersedes_resolution_id'), template_id: text(r.template_id), template_version: n(r.template_version, 'resolution.template_version'), template_hash: text(r.template_hash),
  };
}

function normalizeFact(value: unknown): FactRecord {
  const r = record(value, 'get_fact');
  return { exists: flag(r.exists), fact_key: text(r.fact_key), claim_key: text(r.claim_key), policy_hash: text(r.policy_hash), schema_version: text(r.schema_version), mutability: text(r.mutability) as FactRecord['mutability'], current_resolution_id: big(r.current_resolution_id, 'fact.current_resolution_id'), latest_resolution_id: big(r.latest_resolution_id, 'fact.latest_resolution_id'), current_request_id: big(r.current_request_id, 'fact.current_request_id'), current_outcome: text(r.current_outcome), resolved_at: big(r.resolved_at, 'fact.resolved_at'), valid_until: big(r.valid_until, 'fact.valid_until'), resolution_version: n(r.resolution_version, 'fact.resolution_version'), template_hash: text(r.template_hash) };
}

function normalizeConfig(value: unknown): ProtocolConfig {
  const r = record(value, 'get_protocol_config');
  return { owner: addr(r.owner, 'config.owner'), pending_owner: addr(r.pending_owner, 'config.pending_owner'), guardian: addr(r.guardian, 'config.guardian'), policy_registry: addr(r.policy_registry, 'config.policy_registry'), default_resolver: addr(r.default_resolver, 'config.default_resolver'), paused_new_requests: flag(r.paused_new_requests), fee_base: big(r.fee_base, 'config.fee_base'), fee_per_attempt: big(r.fee_per_attempt, 'config.fee_per_attempt'), fee_reuse: big(r.fee_reuse, 'config.fee_reuse'), retry_delay_seconds: big(r.retry_delay_seconds, 'config.retry_delay_seconds'), stale_after_seconds: big(r.stale_after_seconds, 'config.stale_after_seconds'), max_attempts: n(r.max_attempts, 'config.max_attempts'), max_seed_urls: n(r.max_seed_urls, 'config.max_seed_urls'), schema_version: text(r.schema_version), registry_version: text(r.registry_version) };
}

function normalizeStats(value: unknown): ProtocolStats {
  const r = record(value, 'get_protocol_stats');
  return { request_count: big(r.request_count, 'stats.request_count'), resolution_count: big(r.resolution_count, 'stats.resolution_count'), reused_count: big(r.reused_count, 'stats.reused_count'), paused: flag(r.paused), event_count: big(r.event_count, 'stats.event_count') };
}

function normalizeCapabilities(value: unknown): ResolverCapabilities {
  const r = record(value, 'get_capabilities');
  return { version: text(r.version), registry: addr(r.registry, 'capabilities.registry'), web_access: flag(r.web_access), llm_access: flag(r.llm_access), source_isolation: flag(r.source_isolation), injection_hardened: flag(r.injection_hardened), equivalence: text(r.equivalence) };
}

class GenLayerTransport implements ReadTransport {
  private readonly client: ReturnType<typeof createGenLayerClient>;

  constructor(endpoint: string) {
    this.client = createGenLayerClient({ chain: chains.studioDevnet as never, endpoint });
  }

  async readContract(args: ContractReadArgs): Promise<unknown> {
    const variant = args.transactionHashVariant === 'latest-final' ? TransactionHashVariant.LATEST_FINAL : TransactionHashVariant.LATEST_NONFINAL;
    return this.client.readContract({ address: assertAddress(args.address) as `0x${string}`, functionName: args.functionName, args: [...args.args] as never[], transactionHashVariant: variant, jsonSafeReturn: true });
  }

  async chainId(): Promise<number> {
    const result = await this.client.request({ method: 'eth_chainId' });
    if (typeof result === 'string') return Number.parseInt(result, 16);
    return Number(result);
  }
}

export class ProtocolClient {
  readonly policyRegistry: PolicyRegistryClient;
  readonly registry: RegistryClient;
  readonly resolver: ResolverClient;
  readonly consumerProbe: ConsumerProbeClient;
  private readonly transport: ReadTransport;
  private readonly scheduler: RpcScheduler;
  private readonly subsystem: string;
  private readonly inflightReads = new Map<string, Promise<unknown>>();
  private mode: ReadMode;

  constructor(options: ProtocolClientOptions = {}) {
    this.transport = options.transport ?? new GenLayerTransport(options.rpcUrl ?? FROZEN_NETWORK.rpcUrl);
    this.scheduler = options.scheduler ?? new RpcScheduler(options.schedulerOptions);
    this.subsystem = options.subsystem ?? 'manual-verification';
    this.mode = options.readMode ?? 'latest-final';
    this.policyRegistry = new PolicyRegistryClient(this);
    this.registry = new RegistryClient(this);
    this.resolver = new ResolverClient(this);
    this.consumerProbe = new ConsumerProbeClient(this);
  }

  get readMode(): ReadMode { return this.mode; }
  get pendingRpcReads(): number { return this.scheduler.pending; }
  getRpcMetrics() { return this.scheduler.getMetrics(); }
  getRpcCooldownUntil(): number | null { return this.scheduler.hardQuotaCooldownUntil; }
  isHardQuotaCoolingDown(): boolean { return this.scheduler.isHardQuotaCoolingDown(); }

  async assertNetwork(): Promise<number> {
    const chainId = await this.scheduler.schedule(() => this.transport.chainId(), { subsystem: this.subsystem, method: 'eth_chainId' });
    if (chainId !== FROZEN_NETWORK.chainId) throw new Error(`Wrong GenLayer chain: ${chainId}`);
    return chainId;
  }

  async probeReadMode(): Promise<ReadMode> {
    try {
      await this.rawRead('policyRegistry', 'get_registry_version', [], 'latest-final');
      this.mode = 'latest-final';
    } catch (error) {
      const detail = error instanceof ProtocolReadError ? error.normalized.detail.toLowerCase() : String(error).toLowerCase();
      const unsupported = detail.includes('unsupported') || detail.includes('unknown transaction hash variant') || detail.includes('invalid transaction hash variant');
      if (!unsupported) throw error;
      this.mode = 'latest-nonfinal';
    }
    return this.mode;
  }

  async verifyDeployment(): Promise<{ chainId: number; readMode: ReadMode; config: ProtocolConfig }> {
    const chainId = await this.assertNetwork();
    const readMode = await this.probeReadMode();
    const config = await this.registry.getProtocolConfig();
    assertFrozenDeployment({ ...CONTRACT_ADDRESSES });
    if (normalizeAddress(config.policy_registry) !== normalizeAddress(CONTRACT_ADDRESSES.policyRegistry)) throw new Error('Registry policy registry mismatch');
    if (normalizeAddress(config.default_resolver) !== normalizeAddress(CONTRACT_ADDRESSES.resolver)) throw new Error('Registry default resolver mismatch');
    const resolverRegistry = await this.resolver.getRegistry();
    if (normalizeAddress(resolverRegistry) !== normalizeAddress(CONTRACT_ADDRESSES.registry)) throw new Error('Resolver registry mismatch');
    const trustedRegistry = await this.consumerProbe.getTrustedRegistry();
    if (normalizeAddress(trustedRegistry) !== normalizeAddress(CONTRACT_ADDRESSES.registry)) throw new Error('Consumer trusted registry mismatch');
    return { chainId, readMode, config };
  }

  async rawRead(contract: ContractName, functionName: string, args: readonly unknown[], mode = this.mode): Promise<unknown> {
    const key = JSON.stringify([contract, functionName, args], (_, value: unknown) => typeof value === 'bigint' ? `${value}n` : value);
    const existing = this.inflightReads.get(key);
    if (existing) return existing;
    const operation = this.scheduler.schedule(
      () => this.transport.readContract({ address: CONTRACT_ADDRESSES[contract], functionName, args, transactionHashVariant: mode }),
      { subsystem: this.subsystem, method: functionName },
    ).catch((error: unknown) => {
      if (error instanceof ProtocolReadError) throw error;
      throw new ProtocolReadError(error);
    });
    this.inflightReads.set(key, operation);
    const cleanup = (): void => {
      if (this.inflightReads.get(key) === operation) this.inflightReads.delete(key);
    };
    void operation.then(cleanup, cleanup);
    return operation;
  }

  readMeta(contract: ContractName): ReadMeta {
    return { source: 'chain', readMode: this.mode, chainId: FROZEN_NETWORK.chainId, contractAddress: CONTRACT_ADDRESSES[contract], observedAt: new Date().toISOString(), finalizedRead: this.mode === 'latest-final' };
  }
}

export class PolicyRegistryClient {
  constructor(private readonly client: ProtocolClient) {}
  getSourcePolicy(policyId: string, version: number): Promise<SourcePolicyRecord> { return this.client.rawRead('policyRegistry', 'get_source_policy', [inputText(policyId, 'policyId', 64), inputVersion(version, 'version')]).then(normalizePolicy); }
  getLatestSourcePolicy(policyId: string): Promise<SourcePolicyRecord> { return this.client.rawRead('policyRegistry', 'get_latest_source_policy', [inputText(policyId, 'policyId', 64)]).then(normalizePolicy); }
  isSourcePolicyActive(policyId: string, version: number): Promise<boolean> { return this.client.rawRead('policyRegistry', 'is_source_policy_active', [inputText(policyId, 'policyId', 64), inputVersion(version, 'version')]).then(flag); }
  getPolicyHash(policyId: string, version: number): Promise<string> { return this.client.rawRead('policyRegistry', 'get_policy_hash', [inputText(policyId, 'policyId', 64), inputVersion(version, 'version')]).then(text); }
  getTemplate(templateId: string, version: number): Promise<TemplateRecord> { return this.client.rawRead('policyRegistry', 'get_template', [inputText(templateId, 'templateId', 64), inputVersion(version, 'version')]).then(normalizeTemplate); }
  getLatestTemplate(templateId: string): Promise<TemplateRecord> { return this.client.rawRead('policyRegistry', 'get_latest_template', [inputText(templateId, 'templateId', 64)]).then(normalizeTemplate); }
  isTemplateActive(templateId: string, version: number): Promise<boolean> { return this.client.rawRead('policyRegistry', 'is_template_active', [inputText(templateId, 'templateId', 64), inputVersion(version, 'version')]).then(flag); }
  getTemplateHash(templateId: string, version: number): Promise<string> { return this.client.rawRead('policyRegistry', 'get_template_hash', [inputText(templateId, 'templateId', 64), inputVersion(version, 'version')]).then(text); }
  getLatestPolicyVersion(policyId: string): Promise<number> { return this.client.rawRead('policyRegistry', 'get_latest_policy_version', [inputText(policyId, 'policyId', 64)]).then((v) => n(v, 'latest_policy_version')); }
  getLatestTemplateVersion(templateId: string): Promise<number> { return this.client.rawRead('policyRegistry', 'get_latest_template_version', [inputText(templateId, 'templateId', 64)]).then((v) => n(v, 'latest_template_version')); }
  getOwnership(): Promise<OwnershipView> { return this.client.rawRead('policyRegistry', 'get_ownership', []).then(normalizeOwnership); }
  getOwner(): Promise<Address> { return this.client.rawRead('policyRegistry', 'get_owner', []).then((v) => addr(v, 'policy.owner')); }
  getPendingOwner(): Promise<Address> { return this.client.rawRead('policyRegistry', 'get_pending_owner', []).then((v) => addr(v, 'policy.pending_owner')); }
  getProtocolStats(): Promise<string> { return this.client.rawRead('policyRegistry', 'get_protocol_stats', []).then(text); }
  getEventCount(): Promise<U256> { return this.client.rawRead('policyRegistry', 'get_event_count', []).then((v) => big(v, 'policy.event_count')); }
  getEvents(offset: number, limit: number): Promise<EventPage> { const page = boundedPage({ offset, limit }); return this.client.rawRead('policyRegistry', 'get_events', [page.offset, page.limit]).then((v) => normalizeEventPage(record(v, 'get_events'))); }
  computePolicyHash(...args: [string, number, string, number, number, string, string, boolean, string]): Promise<string> { const [policyId, version, ...rest] = args; return this.client.rawRead('policyRegistry', 'compute_policy_hash', [inputText(policyId, 'policyId', 64), inputVersion(version, 'version'), ...rest]).then(text); }
  computeTemplateHash(...args: [string, number, string, string, string, string, string, number]): Promise<string> { const [templateId, version, ...rest] = args; return this.client.rawRead('policyRegistry', 'compute_template_hash', [inputText(templateId, 'templateId', 64), inputVersion(version, 'version'), ...rest]).then(text); }
  getRegistryVersion(): Promise<string> { return this.client.rawRead('policyRegistry', 'get_registry_version', []).then(text); }
}

export class RegistryClient {
  constructor(private readonly client: ProtocolClient) {}
  getRequest(requestId: U256): Promise<RequestRecord> { return this.client.rawRead('registry', 'get_request', [inputU256(requestId, 'requestId')]).then(normalizeRequest); }
  getRequestStatus(requestId: U256): Promise<string> { return this.client.rawRead('registry', 'get_request_status', [inputU256(requestId, 'requestId')]).then(text); }
  getFact(factKey: string): Promise<FactRecord> { return this.client.rawRead('registry', 'get_fact', [inputFactKey(factKey)]).then(normalizeFact); }
  getCurrentResolution(factKey: string): Promise<ResolutionRecord> { return this.client.rawRead('registry', 'get_current_resolution', [inputFactKey(factKey)]).then(normalizeResolution); }
  getLatestResolution(factKey: string): Promise<ResolutionRecord> { return this.client.rawRead('registry', 'get_latest_resolution', [inputFactKey(factKey)]).then(normalizeResolution); }
  getResolution(resolutionId: U256): Promise<ResolutionRecord> { return this.client.rawRead('registry', 'get_resolution', [inputU256(resolutionId, 'resolutionId')]).then(normalizeResolution); }
  getResolutionHistory(factKey: string, offset: number, limit: number): Promise<ResolutionHistoryPage> { const page = boundedPage({ offset, limit }); return this.client.rawRead('registry', 'get_resolution_history', [inputFactKey(factKey), page.offset, page.limit]).then((v) => normalizeHistoryPage(record(v, 'get_resolution_history'))); }
  getEvidenceManifest(resolutionId: U256): Promise<EvidenceManifestView & { entries: unknown[] }> { return this.client.rawRead('registry', 'get_evidence_manifest', [inputU256(resolutionId, 'resolutionId')]).then((v) => normalizeEvidenceManifest(record(v, 'get_evidence_manifest'))); }
  computeClaimKey(...args: [string, string, string, string, string, string]): Promise<string> { return this.client.rawRead('registry', 'compute_claim_key', args).then(text); }
  computeFactKey(...args: [string, string, string, string]): Promise<string> { const [claimKey, policyHash, schemaVersion, templateHash] = args; return this.client.rawRead('registry', 'compute_fact_key', [inputText(claimKey, 'claimKey', 128), inputText(policyHash, 'policyHash', 128), inputText(schemaVersion, 'schemaVersion', 64), templateHash === '' ? '' : inputText(templateHash, 'templateHash', 128)]).then(text); }
  computeSpecHash(...args: [string, string, string, string, string, string, string, U256, string, string]): Promise<string> { return this.client.rawRead('registry', 'compute_spec_hash', args).then(text); }
  isFactFresh(factKey: string): Promise<boolean> { return this.client.rawRead('registry', 'is_fact_fresh', [inputFactKey(factKey)]).then(flag); }
  canReuseFact(factKey: string): Promise<boolean> { return this.client.rawRead('registry', 'can_reuse_fact', [inputFactKey(factKey)]).then(flag); }
  canReuseWithFreshness(factKey: string, requestedTtl: U256): Promise<boolean> { return this.client.rawRead('registry', 'can_reuse_with_freshness', [inputFactKey(factKey), inputU256(requestedTtl, 'requestedTtl')]).then(flag); }
  computeCallbackId(requestId: U256, resolutionId: U256, consumer: string): Promise<string> { return this.client.rawRead('registry', 'compute_callback_id', [inputU256(requestId, 'requestId'), inputU256(resolutionId, 'resolutionId'), assertAddress(consumer, 'consumer')]).then(text); }
  quoteResolutionFee(reuseMode: string): Promise<U256> { return this.client.rawRead('registry', 'quote_resolution_fee', [inputText(reuseMode, 'reuseMode', 64)]).then((v) => big(v, 'resolution_fee')); }
  getProtocolConfig(): Promise<ProtocolConfig> { return this.client.rawRead('registry', 'get_protocol_config', []).then(normalizeConfig); }
  getResolver(resolver: string): Promise<ResolverInfo> { return this.client.rawRead('registry', 'get_resolver', [assertAddress(resolver, 'resolver')]).then(normalizeResolver); }
  getProtocolStats(): Promise<ProtocolStats> { return this.client.rawRead('registry', 'get_protocol_stats', []).then(normalizeStats); }
  getCredit(account: string): Promise<U256> { return this.client.rawRead('registry', 'get_credit', [assertAddress(account, 'account')]).then((v) => big(v, 'credit')); }
  getJobSnapshot(requestId: U256): Promise<string> { return this.client.rawRead('registry', 'get_job_snapshot', [inputU256(requestId, 'requestId')]).then(text); }
  getOwner(): Promise<Address> { return this.client.rawRead('registry', 'get_owner', []).then((v) => addr(v, 'registry.owner')); }
  getGuardian(): Promise<Address> { return this.client.rawRead('registry', 'get_guardian', []).then((v) => addr(v, 'registry.guardian')); }
  isPaused(): Promise<boolean> { return this.client.rawRead('registry', 'is_paused', []).then(flag); }
  getPolicyRegistry(): Promise<Address> { return this.client.rawRead('registry', 'get_policy_registry', []).then((v) => addr(v, 'policy_registry')); }
  getDefaultResolver(): Promise<Address> { return this.client.rawRead('registry', 'get_default_resolver', []).then((v) => addr(v, 'default_resolver')); }
  getRegistryVersion(): Promise<string> { return this.client.rawRead('registry', 'get_registry_version', []).then(text); }
  getEventCount(): Promise<U256> { return this.client.rawRead('registry', 'get_event_count', []).then((v) => big(v, 'registry.event_count')); }
  getEvents(offset: number, limit: number): Promise<EventPage> { const page = boundedPage({ offset, limit }); return this.client.rawRead('registry', 'get_events', [page.offset, page.limit]).then((v) => normalizeEventPage(record(v, 'get_events'))); }
  validateSeedUrl(url: string): Promise<boolean> { return this.client.rawRead('registry', 'validate_seed_url', [inputText(url, 'url', 2048)]).then(flag); }
}

export class ResolverClient {
  constructor(private readonly client: ProtocolClient) {}
  getResolverVersion(): Promise<string> { return this.client.rawRead('resolver', 'get_resolver_version', []).then(text); }
  getRegistry(): Promise<Address> { return this.client.rawRead('resolver', 'get_registry', []).then((v) => addr(v, 'resolver.registry')); }
  getCapabilities(): Promise<ResolverCapabilities> { return this.client.rawRead('resolver', 'get_capabilities', []).then(normalizeCapabilities); }
  getCapabilitiesJson(): Promise<string> { return this.client.rawRead('resolver', 'get_capabilities_json', []).then(text); }
}

export class ConsumerProbeClient {
  constructor(private readonly client: ProtocolClient) {}
  getTrustedRegistry(): Promise<Address> { return this.client.rawRead('consumerProbe', 'get_trusted_registry', []).then((v) => addr(v, 'trusted_registry')); }
  getLastRequestId(): Promise<U256> { return this.client.rawRead('consumerProbe', 'get_last_request_id', []).then((v) => big(v, 'last_request_id')); }
  getLastFactKey(): Promise<string> { return this.client.rawRead('consumerProbe', 'get_last_fact_key', []).then(text); }
  getLastResolutionId(): Promise<U256> { return this.client.rawRead('consumerProbe', 'get_last_resolution_id', []).then((v) => big(v, 'last_resolution_id')); }
  getLastOutcome(): Promise<KnownOrUnknown<'TRUE' | 'FALSE' | 'UNRESOLVED'>> { return this.client.rawRead('consumerProbe', 'get_last_outcome', []).then(text); }
  getLastResolvedAt(): Promise<U256> { return this.client.rawRead('consumerProbe', 'get_last_resolved_at', []).then((v) => big(v, 'last_resolved_at')); }
  getLastValidUntil(): Promise<U256> { return this.client.rawRead('consumerProbe', 'get_last_valid_until', []).then((v) => big(v, 'last_valid_until')); }
  getLastCallbackId(): Promise<string> { return this.client.rawRead('consumerProbe', 'get_last_callback_id', []).then(text); }
  getCallbackCount(): Promise<U256> { return this.client.rawRead('consumerProbe', 'get_callback_count', []).then((v) => big(v, 'callback_count')); }
  getDuplicateIgnoredCount(): Promise<U256> { return this.client.rawRead('consumerProbe', 'get_duplicate_ignored_count', []).then((v) => big(v, 'duplicate_ignored_count')); }
  hasProcessedCallback(callbackId: string): Promise<boolean> { return this.client.rawRead('consumerProbe', 'has_processed_callback', [callbackId]).then(flag); }
}

export function createProtocolClient(options: ProtocolClientOptions = {}): ProtocolClient {
  return new ProtocolClient(options);
}
