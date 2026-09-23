import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.ts';

const fact = {
  fact: { exists: true, fact_key: 'f'.repeat(64), claim_key: 'c'.repeat(64), policy_hash: 'p'.repeat(64), schema_version: '1', mutability: 'IMMUTABLE', current_resolution_id: 1n, latest_resolution_id: 1n, current_request_id: 1n, current_outcome: 'TRUE', resolved_at: 1n, valid_until: 0n, resolution_version: 1, template_hash: '' },
  currentRequest: { exists: true, request_id: 1n, requester: '0x0000000000000000000000000000000000000001', claim_key: 'c'.repeat(64), fact_key: 'f'.repeat(64), spec_hash: 's'.repeat(64), policy_hash: 'p'.repeat(64), policy_id: 'example_policy', policy_version: 1, assigned_resolver: '0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477', created_at: 1n, status: 'RESOLVED', active_attempt_id: 1n, last_attempt_at: 1n, retry_after: 0n, max_attempts: 1, attempt_count: 1, callback_target: '0x0000000000000000000000000000000000000000', callback_status: 'NOT_REQUESTED', reuse_mode: 'REUSE_IF_FRESH', fee_paid: 0n, mutability: 'IMMUTABLE', schema_version: '1', ttl_seconds: 0n, seed_urls_json: '[]', subject: 'example.com', predicate: 'publishes Example Domain', object_value: 'Example Domain', qualifiers: '', temporal: '', description: '', current_resolution_id: 1n, supplemental_urls_json: '[]', template_id: '', template_version: 0, template_hash: '', fact_type: '', template_resolution_instructions: '' },
  canonicalResolution: { exists: true, resolution_id: 1n, request_id: 1n, attempt_id: 1n, claim_key: 'c'.repeat(64), fact_key: 'f'.repeat(64), spec_hash: 's'.repeat(64), policy_hash: 'p'.repeat(64), outcome: 'TRUE', diagnostic_reason: 'NONE', policy_satisfied: true, resolver_version: 'v1', evidence_manifest_hash: 'e'.repeat(64), reasoning_summary: 'metadata', evaluated_at: 1n, committed_at: 1n, valid_until: 0n, resolution_version: 1, supersedes_resolution_id: 0n, template_id: '', template_version: 0, template_hash: '' },
  latestResolution: null,
  fresh: true,
  syncedAt: new Date().toISOString(),
  source: 'cache' as const,
};

function dependencies() {
  const repository = {
    ping: async () => {},
    getProtocolState: async () => ({ registry_version: 'v1', resolver_version: 'v1', policy_registry_version: 'v1', paused: false, resolver_enabled: true, default_resolver: '0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477' }),
    getSyncStatus: async () => ({ lastFinalizedAt: null, lastSuccessAt: null, lastAttemptAt: null, lastError: null, status: 'healthy', observedEventCounts: {}, updatedAt: null, lastRequestId: 0n, lastResolutionId: 0n, lastProtocolConfigCheckAt: null }),
    listFacts: async () => ({ items: [fact], total: 1 }),
    getFact: async () => fact,
    listResolutions: async () => ({ items: [fact.canonicalResolution], total: 1 }),
    getResolution: async () => fact.canonicalResolution,
    getEvidence: async () => [],
    getRequest: async () => null,
    listPolicies: async () => ({ items: [], total: 0 }),
    getPolicy: async () => null,
    listTemplates: async () => ({ items: [], total: 0 }),
    getTemplate: async () => null,
    listActivity: async () => ({ items: [], total: 0 }),
    getStats: async () => ({ facts: 1 }),
  };
  const protocol = {
    verifyDeployment: async () => ({ chainId: 61997, readMode: 'latest-final', config: {} }),
    isHardQuotaCoolingDown: () => false,
  };
  const indexer = { getStatus: () => ({ enabled: false, running: false, lastStartedAt: null, lastSuccessAt: null, lastError: null, lastDurationMs: null, lagSeconds: null }) };
  const health = { getSnapshot: () => ({ state: 'healthy' as const, chainId: 61997, readMode: 'latest-final' as const, lastRpcSuccessAt: new Date().toISOString(), lastChainVerificationAt: new Date().toISOString(), lastContractVerificationAt: new Date().toISOString(), lastIndexerSuccessAt: null, lastError: null }), isReady: () => true };
  return { repository, protocol, indexer, health, corsOrigins: ['http://localhost:3000'] } as Parameters<typeof buildApp>[0];
}

test('health, pagination, canonical/latest separation, and security headers', async () => {
  const app = buildApp(dependencies());
  await app.ready();
  try {
    const health = await app.inject({ method: 'GET', url: '/api/v1/health' });
    assert.equal(health.statusCode, 200);
    const list = await app.inject({ method: 'GET', url: '/api/v1/facts?limit=1&offset=0' });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().items[0].canonical_resolution.resolution_id, '1');
    assert.equal(list.json().items[0].latest_resolution, null);
    assert.equal(list.json().items[0].current_request.subject, 'example.com');
    assert.equal(list.headers['x-content-type-options'], 'nosniff');
    const invalid = await app.inject({ method: 'GET', url: '/api/v1/facts?limit=999' });
    assert.equal(invalid.statusCode, 400);
  } finally {
    await app.close();
  }
});

test('not-found and no mutation surface', async () => {
  const app = buildApp(dependencies());
  await app.ready();
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' })).statusCode, 404);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/facts', payload: {} })).statusCode, 404);
  } finally {
    await app.close();
  }
});

test('readiness, filters, and parameter bounds are explicit', async () => {
  const app = buildApp(dependencies());
  await app.ready();
  try {
    const ready = await app.inject({ method: 'GET', url: '/api/v1/ready' });
    assert.equal(ready.statusCode, 200);
    const filtered = await app.inject({ method: 'GET', url: '/api/v1/facts?fresh=false&sort=request&search=subject' });
    assert.equal(filtered.statusCode, 200);
    const invalidKey = await app.inject({ method: 'GET', url: '/api/v1/facts/not-a-hash' });
    assert.equal(invalidKey.statusCode, 400);
    const invalidPolicyPage = await app.inject({ method: 'GET', url: '/api/v1/policies?limit=51' });
    assert.equal(invalidPolicyPage.statusCode, 400);
  } finally {
    await app.close();
  }
});

test('database outages return a sanitized 503 instead of an internal server error', async () => {
  const deps = dependencies();
  deps.repository.getProtocolState = async () => { throw Object.assign(new Error('connect ENOENT /var/run/postgresql/.s.PGSQL.5432'), { code: 'ENOENT' }); };
  const app = buildApp(deps);
  await app.ready();
  try {
    const response = await app.inject('/api/v1/protocol');
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error, 'read_service_unavailable');
    assert.doesNotMatch(response.body, /ENOENT|postgresql|\.s\.PGSQL/);
  } finally {
    await app.close();
  }
});

test('readiness reads the cached health snapshot without invoking RPC', async () => {
  const deps = dependencies();
  let calls = 0;
  deps.protocol.verifyDeployment = async () => {
    calls += 1;
    return { chainId: 61997, readMode: 'latest-final', config: {} };
  };
  const app = buildApp(deps);
  await app.ready();
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/ready' })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/ready' })).statusCode, 200);
    assert.equal(calls, 0);
  } finally {
    await app.close();
  }
});

test('readiness remains unavailable when the cached health snapshot is unhealthy', async () => {
  const deps = dependencies();
  deps.health = { getSnapshot: () => ({ state: 'rate_limited', chainId: null, readMode: null, lastRpcSuccessAt: null, lastChainVerificationAt: null, lastContractVerificationAt: null, lastIndexerSuccessAt: null, lastError: 'quota' }), isReady: () => false };
  const app = buildApp(deps);
  await app.ready();
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/ready' })).statusCode, 503);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/ready' })).statusCode, 503);
    assert.equal(deps.health.isReady(), false);
  } finally {
    await app.close();
  }
});

test('readiness reports a live RPC quota even when cached chain health is still healthy', async () => {
  const deps = dependencies();
  deps.health = { ...deps.health, isReady: () => false };
  deps.protocol.isHardQuotaCoolingDown = () => true;
  deps.indexer = { getStatus: () => ({ enabled: true, running: false, lastStartedAt: null, lastSuccessAt: null, lastError: 'rpc_hard_quota_cooldown', lastDurationMs: null, lagSeconds: null }) };
  const app = buildApp(deps);
  await app.ready();
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/ready' });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().health.state, 'healthy');
    assert.equal(response.json().health.error, 'rpc_quota');
    assert.equal(response.json().indexer.lastError, 'rpc_quota');
  } finally {
    await app.close();
  }
});

test('expired cached facts are never reported fresh and public health errors are normalized', async () => {
  const deps = dependencies();
  deps.repository.listFacts = async () => ({ items: [{ ...fact, fact: { ...fact.fact, mutability: 'MUTABLE_WITH_TTL', valid_until: 1n }, fresh: true }], total: 1 });
  deps.repository.getSyncStatus = async () => ({ lastFinalizedAt: null, lastSuccessAt: null, lastAttemptAt: null, lastError: 'provider secret detail', status: 'degraded', observedEventCounts: {}, updatedAt: null });
  deps.health = { getSnapshot: () => ({ state: 'rate_limited', chainId: 61997, readMode: 'latest-final', lastRpcSuccessAt: null, lastChainVerificationAt: null, lastContractVerificationAt: null, lastIndexerSuccessAt: null, lastError: 'provider secret detail' }), isReady: () => false };
  deps.indexer = { getStatus: () => ({ enabled: true, running: false, lastStartedAt: null, lastSuccessAt: null, lastError: 'provider secret detail', lastDurationMs: null, lagSeconds: null }) };
  const app = buildApp(deps);
  await app.ready();
  try {
    const facts = await app.inject({ method: 'GET', url: '/api/v1/facts' });
    assert.equal(facts.json().items[0].freshness.is_fresh, false);
    const ready = await app.inject({ method: 'GET', url: '/api/v1/ready' });
    assert.equal(ready.json().health.error, 'rpc_quota');
    assert.equal(ready.json().indexer.lastError, 'rpc_quota');
    const stats = await app.inject({ method: 'GET', url: '/api/v1/stats' });
    assert.equal(stats.json().sync.lastError, 'indexer_unavailable');
    assert.doesNotMatch(stats.body, /provider secret detail/);
  } finally {
    await app.close();
  }
});

test('public clients behind the loopback reverse proxy are rate limited by forwarded address', async () => {
  const app = buildApp(dependencies());
  await app.ready();
  try {
    const request = { method: 'GET' as const, url: '/api/v1/health', remoteAddress: '127.0.0.1', headers: { 'x-forwarded-for': '203.0.113.42' } };
    let remaining = '';
    for (let count = 0; count < 120; count += 1) {
      const response = await app.inject(request);
      assert.equal(response.statusCode, 200);
      if (count === 0) assert.equal(response.headers['x-ratelimit-limit'], '120');
      remaining = String(response.headers['x-ratelimit-remaining']);
    }
    assert.equal(remaining, '0');
    const limited = await app.inject(request);
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.json().error, 'rate_limit_exceeded');
  } finally {
    await app.close();
  }
});

test('outcome filters reject unknown protocol values', async () => {
  const app = buildApp(dependencies());
  await app.ready();
  try {
    assert.equal((await app.inject('/api/v1/facts?outcome=YES')).statusCode, 400);
  } finally {
    await app.close();
  }
});
