import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTRACT_ADDRESSES,
  FROZEN_NETWORK,
  PUBLIC_VIEW_METHODS,
  ProtocolClient,
  ProtocolReadError,
  RpcScheduler,
  explorerAddressUrl,
  explorerContractUrl,
  explorerTransactionUrl,
  normalizeProtocolError,
  normalizeEvidenceManifest,
  parseJsonBounded,
  type ContractReadArgs,
  type ReadTransport,
} from '../src/index.ts';

const address = '0x0000000000000000000000000000000000000001';
const zero = '0x0000000000000000000000000000000000000000';

function policy(): Record<string, unknown> {
  return { exists: true, policy_id: 'default', version: 1, name: 'Default', active: true, min_primary_sources: 1, min_independent_sources: 1, allowed_classes: '', disallowed_classes: '', require_cross_check: false, semantic_rules: '', policy_hash: 'p'.repeat(64), published_at: 1, deprecated: false };
}
function template(): Record<string, unknown> {
  return { exists: true, template_id: 't', version: 1, name: 'Template', active: true, fact_type: 'binary', required_fields: '', resolution_instructions: 'follow rules', default_policy_id: 'default', default_policy_version: 1, template_hash: 't'.repeat(64), published_at: 1, deprecated: false };
}
function request(): Record<string, unknown> {
  return { exists: true, request_id: 3, requester: address, claim_key: 'c'.repeat(64), fact_key: 'f'.repeat(64), spec_hash: 's'.repeat(64), policy_hash: 'p'.repeat(64), policy_id: 'default', policy_version: 1, assigned_resolver: CONTRACT_ADDRESSES.resolver, created_at: 1, status: 'RESOLVED', active_attempt_id: 1, last_attempt_at: 1, retry_after: 1, max_attempts: 3, attempt_count: 1, callback_target: zero, callback_status: 'NOT_REQUESTED', reuse_mode: 'REUSE_IF_FRESH', fee_paid: 0, mutability: 'IMMUTABLE', schema_version: '1', ttl_seconds: 0, seed_urls_json: '[]', subject: 'subject', predicate: 'predicate', object_value: '', qualifiers: '', temporal: '', description: '', current_resolution_id: 3, supplemental_urls_json: '[]', template_id: '', template_version: 0, template_hash: '', fact_type: '', template_resolution_instructions: '' };
}
function resolution(): Record<string, unknown> {
  return { exists: true, resolution_id: 3, request_id: 3, attempt_id: 1, claim_key: 'c'.repeat(64), fact_key: 'f'.repeat(64), spec_hash: 's'.repeat(64), policy_hash: 'p'.repeat(64), outcome: 'TRUE', diagnostic_reason: 'NONE', policy_satisfied: true, resolver_version: 'v1', evidence_manifest_hash: 'e'.repeat(64), reasoning_summary: 'summary', evaluated_at: 1, committed_at: 1, valid_until: 0, resolution_version: 1, supersedes_resolution_id: 0, template_id: '', template_version: 0, template_hash: '' };
}
function fact(): Record<string, unknown> {
  return { exists: true, fact_key: 'f'.repeat(64), claim_key: 'c'.repeat(64), policy_hash: 'p'.repeat(64), schema_version: '1', mutability: 'IMMUTABLE', current_resolution_id: 3, latest_resolution_id: 3, current_request_id: 3, current_outcome: 'TRUE', resolved_at: 1, valid_until: 0, resolution_version: 1, template_hash: '' };
}

class FakeTransport implements ReadTransport {
  readonly calls: ContractReadArgs[] = [];
  failOnce = false;
  async chainId(): Promise<number> { return FROZEN_NETWORK.chainId; }
  async readContract(args: ContractReadArgs): Promise<unknown> {
    this.calls.push(args);
    if (this.failOnce) { this.failOnce = false; throw Object.assign(new Error('502 upstream'), { status: 502 }); }
    switch (args.functionName) {
      case 'get_registry_version': return args.address.toLowerCase() === CONTRACT_ADDRESSES.registry.toLowerCase() ? 'evidra-registry-v1' : 'evidra-policy-registry-v1';
      case 'get_protocol_config': return { owner: address, pending_owner: zero, guardian: address, policy_registry: CONTRACT_ADDRESSES.policyRegistry, default_resolver: CONTRACT_ADDRESSES.resolver, paused_new_requests: false, fee_base: 0, fee_per_attempt: 0, fee_reuse: 0, retry_delay_seconds: 60, stale_after_seconds: 3600, max_attempts: 3, max_seed_urls: 8, schema_version: '1', registry_version: 'evidra-registry-v1' };
      case 'get_registry': return CONTRACT_ADDRESSES.registry;
      case 'get_trusted_registry': return CONTRACT_ADDRESSES.registry;
      case 'get_source_policy': case 'get_latest_source_policy': return policy();
      case 'get_template': case 'get_latest_template': return template();
      case 'get_ownership': return { owner: address, pending_owner: zero };
      case 'get_owner': case 'get_guardian': return address;
      case 'get_pending_owner': return zero;
      case 'get_protocol_stats': return args.address.toLowerCase() === CONTRACT_ADDRESSES.registry.toLowerCase() ? { request_count: 3, resolution_count: 3, reused_count: 0, paused: false, event_count: 0 } : '{}';
      case 'get_event_count': return 0;
      case 'get_events': return { offset: args.args[0], limit: args.args[1], total: 0, items_json: '[]' };
      case 'get_request': return request();
      case 'get_request_status': return 'RESOLVED';
      case 'get_fact': case 'get_current_resolution': case 'get_latest_resolution': return args.functionName === 'get_fact' ? fact() : resolution();
      case 'get_resolution': return resolution();
      case 'get_resolution_history': return { fact_key: 'f'.repeat(64), offset: 0, limit: 50, total: 1, resolution_ids_json: '[3]' };
      case 'get_evidence_manifest': return { exists: true, resolution_id: 3, manifest_hash: 'e'.repeat(64), manifest_json: '[]' };
      case 'get_resolver': return { exists: true, resolver: CONTRACT_ADDRESSES.resolver, enabled: true, resolver_version: 'v1', capabilities: '{}', registered_at: 1 };
      case 'get_capabilities': return { version: 'v1', registry: CONTRACT_ADDRESSES.registry, web_access: true, llm_access: true, source_isolation: true, injection_hardened: true, equivalence: 'test' };
      case 'get_capabilities_json': return '{}';
      case 'is_paused': return false;
      case 'get_policy_registry': return CONTRACT_ADDRESSES.policyRegistry;
      case 'get_default_resolver': return CONTRACT_ADDRESSES.resolver;
      case 'get_credit': case 'get_last_request_id': case 'get_last_resolution_id': case 'get_last_resolved_at': case 'get_last_valid_until': case 'get_callback_count': case 'get_duplicate_ignored_count': return 0;
      case 'get_job_snapshot': return '{}';
      case 'get_last_fact_key': case 'get_last_outcome': case 'get_last_callback_id': return '';
      case 'has_processed_callback': case 'is_source_policy_active': case 'is_template_active': case 'is_fact_fresh': case 'can_reuse_fact': case 'can_reuse_with_freshness': case 'validate_seed_url': return true;
      case 'compute_claim_key': case 'compute_fact_key': case 'compute_spec_hash': case 'compute_callback_id': case 'get_policy_hash': case 'get_template_hash': case 'quote_resolution_fee': case 'compute_policy_hash': case 'compute_template_hash': return 'x';
      case 'get_latest_policy_version': case 'get_latest_template_version': return 1;
      default: throw new Error(`unhandled ${args.functionName}`);
    }
  }
}

test('frozen network and addresses are centralized', () => {
  assert.equal(FROZEN_NETWORK.chainId, 61997);
  assert.equal(Object.keys(CONTRACT_ADDRESSES).length, 4);
  assert.equal(PUBLIC_VIEW_METHODS.length, 64);
  assert.equal(explorerAddressUrl(address), `${FROZEN_NETWORK.explorerUrl}/address/${address}`);
  assert.equal(explorerContractUrl(address), `${FROZEN_NETWORK.explorerUrl}/contract/${address}`);
  assert.equal(explorerTransactionUrl('0xabc'), `${FROZEN_NETWORK.explorerUrl}/tx/0xabc`);
});

test('typed wrappers use latest-final and normalize IC records', async () => {
  const transport = new FakeTransport();
  const client = new ProtocolClient({ transport, schedulerOptions: { minIntervalMs: 0 } });
  assert.deepEqual(await client.registry.getFact('f'.repeat(64)), { exists: true, fact_key: 'f'.repeat(64), claim_key: 'c'.repeat(64), policy_hash: 'p'.repeat(64), schema_version: '1', mutability: 'IMMUTABLE', current_resolution_id: 3n, latest_resolution_id: 3n, current_request_id: 3n, current_outcome: 'TRUE', resolved_at: 1n, valid_until: 0n, resolution_version: 1, template_hash: '' });
  await client.registry.getEvents(0, 10);
  assert.equal(transport.calls.at(-1)?.transactionHashVariant, 'latest-final');
  const deployment = await client.verifyDeployment();
  assert.equal(deployment.chainId, 61997);
  assert.equal(deployment.readMode, 'latest-final');
});

test('read scheduler retries transient RPC failures but preserves errors', async () => {
  const transport = new FakeTransport();
  transport.failOnce = true;
  const client = new ProtocolClient({ transport, schedulerOptions: { minIntervalMs: 0, baseDelayMs: 1, maxDelayMs: 2, maxRetries: 1 } });
  assert.equal(await client.registry.getRegistryVersion(), 'evidra-registry-v1');
  assert.equal(transport.calls.length, 2);
  const error = normalizeProtocolError(new Error('INVALID_URL'));
  assert.equal(error.retryable, false);
  assert.equal(new ProtocolReadError(new Error('502 upstream')).normalized.retryable, true);
  assert.equal(normalizeProtocolError(new Error('Rate limit exceeded: 30 requests per minute')).retryAfterMs, 60_000);
});

test('read scheduler stops a queued batch when the RPC quota is exhausted', async () => {
  const scheduler = new RpcScheduler({ concurrency: 1, minIntervalMs: 0, maxRetries: 3, hardQuotaCooldownMs: 60_000 });
  let calls = 0;
  const read = () => scheduler.schedule(async () => {
    calls += 1;
    throw new Error('Rate limit exceeded: 5000 requests per day');
  });
  const results = await Promise.all([read(), read(), read()].map((promise) => promise.then(() => 'ok', (error: unknown) => error)));
  assert.equal(calls, 1);
  assert.equal(results.filter((result) => result instanceof ProtocolReadError).length, 3);
  await assert.rejects(() => scheduler.schedule(async () => { calls += 1; return 'unexpected'; }));
  assert.equal(calls, 1);
  assert.equal(scheduler.getMetrics().totals.hardQuota, 1);
  assert.ok((scheduler.getMetrics().cooldownUntil ?? 0) > Date.now());
});

test('single-flight coalesces identical reads and keeps subsystem metrics', async () => {
  const transport = new FakeTransport();
  const client = new ProtocolClient({ transport, subsystem: 'indexer', schedulerOptions: { minIntervalMs: 0 } });
  const results = await Promise.all([client.registry.getRegistryVersion(), client.registry.getRegistryVersion(), client.registry.getRegistryVersion()]);
  assert.deepEqual(results, ['evidra-registry-v1', 'evidra-registry-v1', 'evidra-registry-v1']);
  assert.equal(transport.calls.filter((call) => call.functionName === 'get_registry_version').length, 1);
  const metrics = client.getRpcMetrics();
  assert.equal(metrics.bySubsystem.indexer?.total, 1);
  assert.equal(metrics.byMethod.get_registry_version?.success, 1);
});

test('minute rate limits remain bounded retryable failures, not daily cooldowns', async () => {
  const scheduler = new RpcScheduler({ minIntervalMs: 0, baseDelayMs: 1, maxDelayMs: 2, maxRetries: 1 });
  let calls = 0;
  await assert.rejects(() => scheduler.schedule(async () => { calls += 1; throw Object.assign(new Error('429 upstream'), { status: 429, retryAfterMs: 1 }); }));
  assert.equal(calls, 2);
  assert.equal(scheduler.getMetrics().cooldownUntil, null);
  assert.equal(scheduler.getMetrics().totals.retries, 1);
});

test('fixed hourly quota limits enter hard cooldown', async () => {
  const scheduler = new RpcScheduler({ concurrency: 1, minIntervalMs: 0, maxRetries: 3, hardQuotaCooldownMs: 60_000 });
  let calls = 0;
  const read = () => scheduler.schedule(async () => {
    calls += 1;
    throw new Error('Rate limit exceeded: 500 requests per hour');
  });
  const results = await Promise.all([read(), read(), read()].map((promise) => promise.then(() => 'ok', (error: unknown) => error)));
  assert.equal(calls, 1);
  assert.equal(results.filter((result) => result instanceof ProtocolReadError).length, 3);
  assert.equal(scheduler.getMetrics().totals.retries, 0);
  assert.equal(scheduler.getMetrics().totals.hardQuota, 1);
  assert.ok((scheduler.getMetrics().cooldownUntil ?? 0) > Date.now());
});

test('persisted quota cooldown can be restored without starting an RPC call', async () => {
  const scheduler = new RpcScheduler({ minIntervalMs: 0 });
  const until = Date.now() + 60_000;
  scheduler.restoreHardQuotaCooldown(until);
  let calls = 0;
  await assert.rejects(() => scheduler.schedule(async () => { calls += 1; }));
  assert.equal(calls, 0);
  assert.equal(scheduler.hardQuotaCooldownUntil, until);
  scheduler.restoreHardQuotaCooldown(Date.now() - 1);
  assert.equal(scheduler.isHardQuotaCoolingDown(), true);
});

test('bounded JSON parsing rejects oversized or malformed chain payloads', () => {
  assert.deepEqual(parseJsonBounded('[1]', 'items'), [1]);
  assert.throws(() => parseJsonBounded('{', 'items'));
  assert.throws(() => parseJsonBounded('x'.repeat(129 * 1024), 'items'));
});

test('evidence manifests normalize contract field names without certifying prose', () => {
  const manifest = normalizeEvidenceManifest({ exists: true, resolution_id: 1, manifest_hash: 'e'.repeat(64), manifest_json: JSON.stringify([{ url: 'https://example.com/', fetch_status: 'USABLE', source_origin: 'seed', source_class: 'OFFICIAL', is_primary: true, is_independent: true, policy_eligible: true, provenance_group: 'example.com', evidence_hash: 'h'.repeat(64) }]) });
  assert.equal(manifest.entries[0]?.status, 'USABLE');
  assert.equal(manifest.entries[0]?.origin, 'seed');
  assert.equal(manifest.entries[0]?.policy_eligible, true);
});

test('wrapper prototypes cover every frozen public view method', () => {
  const client = new ProtocolClient({ transport: new FakeTransport(), schedulerOptions: { minIntervalMs: 0 } });
  const groups = [client.policyRegistry, client.registry, client.resolver, client.consumerProbe];
  const names = new Set(groups.flatMap((group) => Object.getOwnPropertyNames(Object.getPrototypeOf(group)).filter((name) => name !== 'constructor').map((name) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`))));
  for (const method of PUBLIC_VIEW_METHODS) assert.ok(names.has(method.functionName), method.functionName);
});
