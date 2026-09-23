import assert from 'node:assert/strict';
import test from 'node:test';
import { ChainIndexer } from '../src/indexer.ts';

const addresses = {
  policyRegistry: '0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71',
  registry: '0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6',
  resolver: '0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477',
  consumerProbe: '0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F',
};
const key = 'f'.repeat(64);
const request = { exists: true, request_id: 1n, requester: '0x0000000000000000000000000000000000000001', claim_key: 'c'.repeat(64), fact_key: key, spec_hash: 's'.repeat(64), policy_hash: 'p'.repeat(64), policy_id: 'core', policy_version: 1, assigned_resolver: addresses.resolver, created_at: 1n, status: 'RESOLVED', active_attempt_id: 1n, last_attempt_at: 1n, retry_after: 1n, max_attempts: 3, attempt_count: 1, callback_target: '0x0000000000000000000000000000000000000000', callback_status: 'NOT_REQUESTED', reuse_mode: 'REUSE_IF_FRESH', fee_paid: 0n, mutability: 'IMMUTABLE', schema_version: '1', ttl_seconds: 0n, seed_urls_json: '[]', subject: 'subject', predicate: 'predicate', object_value: '', qualifiers: '', temporal: '', description: '', current_resolution_id: 1n, supplemental_urls_json: '[]', template_id: '', template_version: 0, template_hash: '', fact_type: '', template_resolution_instructions: '' };
const resolution = { exists: true, resolution_id: 1n, request_id: 1n, attempt_id: 1n, claim_key: 'c'.repeat(64), fact_key: key, spec_hash: 's'.repeat(64), policy_hash: 'p'.repeat(64), outcome: 'TRUE', diagnostic_reason: 'NONE', policy_satisfied: true, resolver_version: 'v1', evidence_manifest_hash: 'e'.repeat(64), reasoning_summary: '', evaluated_at: 1n, committed_at: 1n, valid_until: 0n, resolution_version: 1, supersedes_resolution_id: 0n, template_id: '', template_version: 0, template_hash: '' };
const fact = { exists: true, fact_key: key, claim_key: 'c'.repeat(64), policy_hash: 'p'.repeat(64), schema_version: '1', mutability: 'IMMUTABLE', current_resolution_id: 1n, latest_resolution_id: 1n, current_request_id: 1n, current_outcome: 'TRUE', resolved_at: 1n, valid_until: 0n, resolution_version: 1, template_hash: '' };

test('a restored RPC quota cooldown skips indexer startup without touching the checkpoint', async () => {
  let rpcCalls = 0;
  let statusWrites = 0;
  const protocol = { isHardQuotaCoolingDown: () => true, registry: { getProtocolStats: async () => { rpcCalls += 1; } } };
  const repository = { setSyncStatus: async () => { statusWrites += 1; } };
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const indexer = new ChainIndexer(protocol as never, repository as never, logger, { enabled: true, intervalMs: 60_000 });
  await indexer.start();
  try {
    assert.equal(indexer.getStatus().lastError, 'rpc_hard_quota_cooldown');
    assert.equal(rpcCalls, 0);
    assert.equal(statusWrites, 0);
  } finally {
    await indexer.stop();
  }
});

test('incremental finalized sync does not reread immutable records when idle', async () => {
  const calls = { requests: 0, resolutions: 0, facts: 0, evidence: 0, stats: 0 };
  let checkpoint = { lastFinalizedAt: null, lastSuccessAt: null, lastAttemptAt: null, lastError: null, status: 'idle', observedEventCounts: {}, updatedAt: null, lastRequestId: 0n, lastResolutionId: 0n, lastProtocolConfigCheckAt: null };
  const repository = {
    getSyncStatus: async () => checkpoint,
    setSyncStatus: async (status: Record<string, unknown>) => { checkpoint = { ...checkpoint, ...status } as typeof checkpoint; },
    listMutableRequestIds: async () => [],
    refreshFactFreshness: async () => 0,
    upsertProtocolState: async () => {},
    upsertPolicy: async () => {},
    upsertTemplate: async () => {},
    upsertRequest: async () => { calls.requests += 1; },
    upsertResolution: async (_value: unknown, flags: { canonical: boolean; latest: boolean }) => { calls.resolutions += 1; assert.deepEqual(flags, { canonical: true, latest: true }); },
    setResolutionFlags: async () => {},
    replaceEvidence: async () => { calls.evidence += 1; },
    upsertFact: async () => { calls.facts += 1; },
  };
  const protocol = {
    isHardQuotaCoolingDown: () => false,
    getRpcMetrics: () => ({ totals: {}, bySubsystem: {}, byMethod: {}, cooldownUntil: null }),
    registry: {
      getProtocolStats: async () => { calls.stats += 1; return { request_count: 25n, resolution_count: 25n, reused_count: 0n, paused: false, event_count: 0n }; },
      getProtocolConfig: async () => ({ default_resolver: addresses.resolver }),
      getResolver: async () => ({ exists: true, resolver: addresses.resolver, enabled: true, resolver_version: 'v1', capabilities: '{}', registered_at: 1n }),
      getRegistryVersion: async () => 'evidra-registry-v1',
      getEvents: async () => ({ offset: 0, limit: 50, total: 0, items: [] }),
      getRequest: async () => request,
      getResolution: async () => resolution,
      getFact: async () => fact,
      getEvidenceManifest: async () => ({ exists: true, resolution_id: 1n, manifest_hash: 'e'.repeat(64), manifest_json: '[]', entries: [] }),
    },
    resolver: { getResolverVersion: async () => 'evidra-resolver-v1' },
    policyRegistry: {
      getEventCount: async () => 0n,
      getRegistryVersion: async () => 'evidra-policy-registry-v1',
      getEvents: async () => ({ offset: 0, limit: 50, total: 0, items: [] }),
    },
  };
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const indexer = new ChainIndexer(protocol as never, repository as never, logger, { enabled: true, maxRecords: 10, intervalMs: 60_000 });
  await indexer.syncOnce();
  assert.equal(checkpoint.lastRequestId, 10n);
  await indexer.syncOnce();
  assert.equal(checkpoint.lastRequestId, 20n);
  await indexer.syncOnce();
  assert.deepEqual(calls, { requests: 25, resolutions: 25, facts: 3, evidence: 25, stats: 3 });
  assert.equal(checkpoint.lastRequestId, 25n);
  await indexer.syncOnce();
  assert.deepEqual(calls, { requests: 25, resolutions: 25, facts: 3, evidence: 25, stats: 4 });
  await Promise.all([indexer.syncOnce(), indexer.syncOnce()]);
  assert.equal(calls.stats, 5);
  assert.equal(calls.requests, 25);
  assert.equal(indexer.getStatus().lastError, null);
});
