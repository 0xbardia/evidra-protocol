import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import {
  CONTRACT_ADDRESSES,
  FROZEN_NETWORK,
  ProtocolReadError,
  toJsonSafe,
  type ProtocolClient,
  type ResolutionRecord,
} from '@evidra/protocol';
import type { ProjectionFact, ProjectionRepository, ProjectionStatus } from '@evidra/db';
import type { IndexerStatus } from './indexer.js';
import type { HealthStatusProvider } from './health.js';

export interface ApiIndexer {
  getStatus(): IndexerStatus;
}

export interface ApiDeps {
  repository: ProjectionRepository;
  protocol: ProtocolClient;
  indexer: ApiIndexer;
  health: HealthStatusProvider;
  corsOrigins: string[];
}

const pageSchema = z.object({
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const factQuerySchema = pageSchema.extend({
  outcome: z.enum(['TRUE', 'FALSE', 'UNRESOLVED']).optional(),
  fresh: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  policy: z.string().trim().max(128).optional(),
  template: z.string().trim().max(128).optional(),
  mutability: z.string().trim().max(64).optional(),
  search: z.string().trim().max(256).optional(),
  sort: z.enum(['recent', 'request']).default('recent'),
});
const hashParam = z.string().regex(/^[a-f0-9]{64}$/i, 'invalid fact key');
const numericParam = z.string().regex(/^\d{1,78}$/, 'invalid numeric id');
const versionParam = z.coerce.number().int().min(1).max(2_147_483_647);

function safe(value: unknown): unknown { return toJsonSafe(value); }
function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = String(error.code);
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ENOENT', '57P01', '57P02', '57P03'].includes(code) || code.startsWith('08') || code.startsWith('53');
}
function publicIndexError(error: string | null, rateLimited: boolean): string | null {
  return error ? rateLimited ? 'rpc_quota' : 'indexer_unavailable' : null;
}
function publicSyncStatus(sync: ProjectionStatus): ProjectionStatus {
  return { ...sync, lastError: publicIndexError(sync.lastError, sync.status === 'rate_limited') };
}

function factEnvelope(item: ProjectionFact): Record<string, unknown> {
  const projectionStale = item.source === 'cache' && (!Number.isFinite(Date.parse(item.syncedAt)) || Date.now() - Date.parse(item.syncedAt) > 300_000);
  const fresh = item.source === 'cache'
    ? item.fact.mutability === 'IMMUTABLE' || item.fact.valid_until > BigInt(Math.floor(Date.now() / 1000))
    : item.fresh;
  return {
    fact: item.fact,
    current_request: item.currentRequest && {
      subject: item.currentRequest.subject,
      predicate: item.currentRequest.predicate,
      object_value: item.currentRequest.object_value,
      qualifiers: item.currentRequest.qualifiers,
      temporal: item.currentRequest.temporal,
      description: item.currentRequest.description,
      ttl_seconds: item.currentRequest.ttl_seconds,
      policy_id: item.currentRequest.policy_id,
      policy_version: item.currentRequest.policy_version,
      template_id: item.currentRequest.template_id,
      template_version: item.currentRequest.template_version,
      status: item.currentRequest.status,
      callback_status: item.currentRequest.callback_status,
    },
    canonical_resolution: item.canonicalResolution,
    latest_resolution: item.latestResolution,
    freshness: { is_fresh: fresh, source: item.source },
    projection: { source: item.source, synced_at: item.syncedAt, stale: projectionStale },
  };
}

async function chainFact(protocol: ProtocolClient, factKey: string): Promise<ProjectionFact | null> {
  const fact = await protocol.registry.getFact(factKey);
  if (!fact.exists) return null;
  const latestId = fact.latest_resolution_id === 0n ? fact.current_resolution_id : fact.latest_resolution_id;
  const [canonical, latest, fresh] = await Promise.all([
    fact.current_resolution_id === 0n ? Promise.resolve(null) : protocol.registry.getResolution(fact.current_resolution_id),
    latestId === 0n ? Promise.resolve(null) : protocol.registry.getResolution(latestId),
    protocol.registry.isFactFresh(factKey),
  ]);
  return { fact, currentRequest: null, canonicalResolution: canonical?.exists ? canonical : null, latestResolution: latest?.exists ? latest : null, fresh, source: 'chain', syncedAt: new Date().toISOString() };
}

function resolutionEnvelope(resolution: ResolutionRecord): Record<string, unknown> {
  return {
    resolution,
    consensus: {
      outcome: resolution.outcome,
      policy_satisfied: resolution.policy_satisfied,
      diagnostic_reason: resolution.diagnostic_reason,
    },
    metadata: {
      evidence_manifest_hash: resolution.evidence_manifest_hash,
      reasoning_summary: resolution.reasoning_summary,
    },
  };
}

export function buildApp(deps: ApiDeps): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: 65_536,
    requestIdHeader: 'x-request-id',
    trustProxy: ['127.0.0.1', '::1'],
  });
  void app.register(helmet, { global: true });
  void app.register(cors, { origin: deps.corsOrigins.includes('*') ? true : deps.corsOrigins, credentials: false });
  void app.register(rateLimit, { max: 120, timeWindow: '1 minute', allowList: ['127.0.0.1', '::1'] });

  app.after((error) => {
    if (error) throw error;
  app.get('/api/v1/health', async (request) => ({ ok: true, request_id: request.id, timestamp: new Date().toISOString() }));

  app.get('/api/v1/ready', async (request, reply) => {
    try {
      await deps.repository.ping();
      const health = deps.health.getSnapshot();
      const indexer = deps.indexer.getStatus();
      const ready = deps.health.isReady();
      const rateLimited = health.state === 'rate_limited' || deps.protocol.isHardQuotaCoolingDown();
      const indexerError = publicIndexError(indexer.lastError, rateLimited);
      const readinessError = ready ? null : rateLimited ? 'rpc_quota' : health.state !== 'healthy' ? 'rpc_unavailable' : indexerError ?? 'indexer_unavailable';
      const body = {
        ok: ready,
        request_id: request.id,
        chain_id: health.chainId,
        read_mode: health.readMode,
        health: {
          state: health.state,
          last_rpc_success_at: health.lastRpcSuccessAt,
          last_chain_verification_at: health.lastChainVerificationAt,
          last_contract_verification_at: health.lastContractVerificationAt,
          last_indexer_success_at: health.lastIndexerSuccessAt,
          error: readinessError,
        },
        indexer: { ...indexer, lastError: indexerError },
      };
      return reply.code(ready ? 200 : 503).send(body);
    } catch (error) {
      request.log.warn({ error: error instanceof Error ? error.message : String(error) }, 'readiness check failed');
      return reply.code(503).send({ ok: false, request_id: request.id, error: 'readiness_unavailable' });
    }
  });

  app.get('/api/v1/network', async (request) => ({
    network: FROZEN_NETWORK.name,
    chain_id: FROZEN_NETWORK.chainId,
    rpc_url: FROZEN_NETWORK.rpcUrl,
    explorer_url: FROZEN_NETWORK.explorerUrl,
    contracts: CONTRACT_ADDRESSES,
    request_id: request.id,
  }));

  app.get('/api/v1/protocol', async (request, reply) => {
    const state = await deps.repository.getProtocolState();
    if (!state) return reply.code(503).send({ error: 'protocol_projection_unavailable', request_id: request.id });
    return safe({
      network: FROZEN_NETWORK.name,
      chain_id: FROZEN_NETWORK.chainId,
      contracts: CONTRACT_ADDRESSES,
      versions: { registry: state.registry_version, resolver: state.resolver_version, policy_registry: state.policy_registry_version },
      paused: state.paused,
      resolver_enabled: state.resolver_enabled,
      default_resolver: state.default_resolver,
      sync: publicSyncStatus(await deps.repository.getSyncStatus()),
      indexer: deps.indexer.getStatus(),
      request_id: request.id,
    });
  });

  app.get('/api/v1/facts', async (request) => {
    const query = factQuerySchema.parse(request.query);
    const result = await deps.repository.listFacts({ ...query, sort: query.sort });
    return safe({ items: result.items.map(factEnvelope), page: { offset: query.offset, limit: query.limit, total: result.total }, source: 'cache', request_id: request.id });
  });

  app.get('/api/v1/facts/:factKey', async (request, reply) => {
    const factKey = hashParam.parse((request.params as { factKey?: string }).factKey);
    const source = z.enum(['cache', 'chain']).default('cache').parse((request.query as { source?: string }).source);
    const item = source === 'chain' ? await chainFact(deps.protocol, factKey) : await deps.repository.getFact(factKey);
    if (!item) return reply.code(404).send({ error: 'fact_not_found', request_id: request.id });
    const history = source === 'cache' ? await deps.repository.listResolutions(factKey, 0, 50) : null;
    return safe({ ...factEnvelope(item), history: history ? { items: history.items.map(resolutionEnvelope), total: history.total } : undefined, request_id: request.id });
  });

  app.get('/api/v1/facts/:factKey/resolutions', async (request) => {
    const factKey = hashParam.parse((request.params as { factKey?: string }).factKey);
    const query = pageSchema.parse(request.query);
    const result = await deps.repository.listResolutions(factKey, query.offset, query.limit);
    return safe({ items: result.items.map(resolutionEnvelope), page: { offset: query.offset, limit: query.limit, total: result.total }, request_id: request.id });
  });

  app.get('/api/v1/resolutions/:resolutionId', async (request, reply) => {
    const id = BigInt(numericParam.parse((request.params as { resolutionId?: string }).resolutionId));
    const resolution = await deps.repository.getResolution(id);
    if (!resolution) return reply.code(404).send({ error: 'resolution_not_found', request_id: request.id });
    return safe({ ...resolutionEnvelope(resolution), request_id: request.id });
  });

  app.get('/api/v1/resolutions/:resolutionId/evidence', async (request, reply) => {
    const id = BigInt(numericParam.parse((request.params as { resolutionId?: string }).resolutionId));
    const resolution = await deps.repository.getResolution(id);
    if (!resolution) return reply.code(404).send({ error: 'resolution_not_found', request_id: request.id });
    return safe({ resolution_id: id, items: await deps.repository.getEvidence(id), informational: true, request_id: request.id });
  });

  app.get('/api/v1/requests/:requestId', async (request, reply) => {
    const id = BigInt(numericParam.parse((request.params as { requestId?: string }).requestId));
    const item = await deps.repository.getRequest(id);
    if (!item) return reply.code(404).send({ error: 'request_not_found', request_id: request.id });
    return safe({ request: item, request_id: request.id });
  });

  app.get('/api/v1/policies', async (request) => {
    const query = pageSchema.parse(request.query);
    const result = await deps.repository.listPolicies(query.offset, query.limit);
    return safe({ items: result.items, page: { offset: query.offset, limit: query.limit, total: result.total }, request_id: request.id });
  });

  app.get('/api/v1/policies/:policyId/:version', async (request, reply) => {
    const params = request.params as { policyId?: string; version?: string };
    const policy = await deps.repository.getPolicy(z.string().min(1).max(64).parse(params.policyId), versionParam.parse(params.version));
    if (!policy) return reply.code(404).send({ error: 'policy_not_found', request_id: request.id });
    return safe({ policy, request_id: request.id });
  });

  app.get('/api/v1/templates', async (request) => {
    const query = pageSchema.parse(request.query);
    const result = await deps.repository.listTemplates(query.offset, query.limit);
    return safe({ items: result.items, page: { offset: query.offset, limit: query.limit, total: result.total }, request_id: request.id });
  });

  app.get('/api/v1/templates/:templateId/:version', async (request, reply) => {
    const params = request.params as { templateId?: string; version?: string };
    const template = await deps.repository.getTemplate(z.string().min(1).max(64).parse(params.templateId), versionParam.parse(params.version));
    if (!template) return reply.code(404).send({ error: 'template_not_found', request_id: request.id });
    return safe({ template, request_id: request.id });
  });

  app.get('/api/v1/activity', async (request) => {
    const query = pageSchema.parse(request.query);
    const result = await deps.repository.listActivity(query.offset, query.limit);
    return safe({ items: result.items, page: { offset: query.offset, limit: query.limit, total: result.total }, request_id: request.id });
  });

  app.get('/api/v1/stats', async (request) => safe({ stats: await deps.repository.getStats(), sync: publicSyncStatus(await deps.repository.getSyncStatus()), request_id: request.id }));

  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: 'not_found', request_id: request.id }));
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'invalid_request', details: error.issues.map((issue) => issue.path.join('.')), request_id: request.id });
    if (error instanceof ProtocolReadError) return reply.code(error.normalized.retryable ? 503 : 502).send({ error: 'protocol_read_failed', message: error.normalized.userMessage, request_id: request.id });
    if (isDatabaseUnavailable(error)) return reply.code(503).send({ error: 'read_service_unavailable', request_id: request.id });
    const status = typeof (error as { statusCode?: unknown }).statusCode === 'number' ? Number((error as { statusCode: number }).statusCode) : 500;
    if (status === 429) return reply.code(429).send({ error: 'rate_limit_exceeded', message: 'Too many requests. Wait before retrying.', request_id: request.id });
    request.log.error({ error: error instanceof Error ? error.message : String(error) }, 'request failed');
    return reply.code(status >= 400 && status < 600 ? status : 500).send({ error: status === 413 ? 'request_too_large' : 'internal_error', request_id: request.id });
  });
  });
  return app;
}
