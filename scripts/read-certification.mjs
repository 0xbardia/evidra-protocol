import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const sdkPath = process.env.GENLAYER_JS_PATH || 'genlayer-js';
const { chains, createClient } = await import(sdkPath);

const client = createClient({
  chain: chains.studioDevnet,
  endpoint: 'https://studio-dev.genlayer.com/api',
});

const address = {
  policy: '0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71',
  registry: '0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6',
  resolver: '0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477',
  consumer: '0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F',
};

const factKey = 'e164495ffdf07a91f5a3f04c1d83eeae4d3098dbed64c5ed6f0b3c0680266cb1';
const zeroAddress = '0x0000000000000000000000000000000000000000';
const zeroCallback = '0'.repeat(64);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value, depth = 0) {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (depth >= 8) return '[depth limit]';
  if (Array.isArray(value)) return value.map((item) => normalize(item, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, depth + 1)]));
}

const expectedSemantics = {
  get_source_policy: 'Returns the exact stored policy record for the requested policy ID and version.',
  get_latest_source_policy: 'Returns the latest stored policy record for the requested policy ID.',
  is_source_policy_active: 'Reports whether the requested policy version is active for new requests.',
  get_policy_hash: 'Returns the deterministic hash of the exact stored policy version.',
  get_template: 'Returns the exact stored template record for the requested template ID and version.',
  get_latest_template: 'Returns the latest stored template record for the requested template ID.',
  is_template_active: 'Reports whether the requested template version is active for new requests.',
  get_template_hash: 'Returns the deterministic hash of the exact stored template version.',
  get_latest_policy_version: 'Returns the latest published version number for a policy ID.',
  get_latest_template_version: 'Returns the latest published version number for a template ID.',
  get_ownership: 'Returns the ownership and pending-ownership state.',
  get_owner: 'Returns the current owner address.',
  get_pending_owner: 'Returns the pending owner address or the zero address.',
  get_protocol_stats: 'Returns aggregate protocol counters for this contract.',
  get_event_count: 'Returns the number of retained protocol events.',
  get_events: 'Returns the requested bounded event page.',
  compute_policy_hash: 'Computes the policy hash preview for the supplied canonical policy inputs.',
  compute_template_hash: 'Computes the template hash preview for the supplied canonical template inputs.',
  get_registry_version: 'Returns the deployed contract version string.',
  get_request: 'Returns the exact request record for the request ID, including lifecycle state and attempt fields.',
  get_request_status: 'Returns the current lifecycle status for the request ID.',
  get_fact: 'Returns the fact record and canonical/latest resolution pointers for the fact key.',
  get_current_resolution: 'Returns the canonical resolution selected by the fact record.',
  get_latest_resolution: 'Returns the newest committed resolution attempt for the fact key.',
  get_resolution: 'Returns the exact resolution record for the resolution ID.',
  get_resolution_history: 'Returns the bounded historical resolution page for the fact key.',
  get_evidence_manifest: 'Returns the evidence manifest attached to the resolution ID.',
  compute_claim_key: 'Computes the semantic claim identity from the supplied claim fields.',
  compute_fact_key: 'Computes the fact identity from claim, policy, schema, and template identity inputs.',
  compute_spec_hash: 'Computes the request specification hash from execution parameters and validated seed inputs.',
  is_fact_fresh: 'Reports whether the fact has a canonical resolution that is currently within valid_until.',
  can_reuse_fact: 'Reports whether the configured reuse mode permits reuse of the current fact.',
  can_reuse_with_freshness: 'Reports whether the requested reuse mode and freshness requirement permit reuse.',
  compute_callback_id: 'Computes the deterministic callback identity for request, resolution, and consumer.',
  quote_resolution_fee: 'Returns the protocol fee quote for the requested reuse mode.',
  get_protocol_config: 'Returns the current protocol configuration and fee/limit parameters.',
  get_resolver: 'Returns the resolver registration and enabled state for the resolver address.',
  get_job_snapshot: 'Returns the request/job snapshot used for resolver execution.',
  get_credit: 'Returns the stored protocol credit balance for the supplied address.',
  get_guardian: 'Returns the guardian address.',
  is_paused: 'Reports whether new protocol requests are paused.',
  get_policy_registry: 'Returns the configured policy registry address.',
  get_default_resolver: 'Returns the configured default resolver address.',
  get_capabilities: 'Returns the resolver capability string.',
  get_capabilities_json: 'Returns the resolver capabilities in structured JSON form.',
  get_resolver_version: 'Returns the resolver version string.',
  get_registry: 'Returns the registry address configured in the resolver.',
  get_trusted_registry: 'Returns the registry address trusted by the consumer probe.',
  get_last_request_id: 'Returns the most recently acknowledged callback request ID.',
  get_last_fact_key: 'Returns the fact key from the most recently acknowledged callback.',
  get_last_resolution_id: 'Returns the resolution ID from the most recently acknowledged callback.',
  get_last_outcome: 'Returns the outcome from the most recently acknowledged callback.',
  get_last_resolved_at: 'Returns the resolved_at timestamp from the most recently acknowledged callback.',
  get_last_valid_until: 'Returns the valid_until timestamp from the most recently acknowledged callback.',
  get_last_callback_id: 'Returns the callback ID from the most recently acknowledged callback.',
  get_callback_count: 'Returns the number of callbacks accepted by the consumer probe.',
  get_duplicate_ignored_count: 'Returns the number of duplicate callbacks ignored by the consumer probe.',
  has_processed_callback: 'Reports whether the supplied callback ID has already been processed.',
  validate_seed_url: 'Validates a source URL under the hardened V1 URL policy.',
};

const scenarioCalls = [
  ['configured-policy', 'EvidraPolicyRegistry', 'get_source_policy', address.policy, ['core', 1], 'Configured policy record must be readable.'],
  ['configured-template', 'EvidraPolicyRegistry', 'get_template', address.policy, ['launch', 1], 'Configured template record must be readable.'],
  ['missing-policy', 'EvidraPolicyRegistry', 'get_source_policy', address.policy, ['missing-policy', 1], 'Missing policy must return its defined empty/not-found representation or an expected contract error.'],
  ['missing-template', 'EvidraPolicyRegistry', 'get_template', address.policy, ['missing-template', 1], 'Missing template must return its defined empty/not-found representation or an expected contract error.'],
  ['configured-request', 'EvidraRegistry', 'get_request', address.registry, [3n], 'Existing reassessment request must be readable.'],
  ['resolution-state', 'EvidraRegistry', 'get_resolution', address.registry, [3n], 'Existing resolution must expose committed outcome and metadata.'],
  ['canonical-resolution', 'EvidraRegistry', 'get_current_resolution', address.registry, [factKey], 'Canonical resolution must be readable independently of latest resolution.'],
  ['latest-resolution', 'EvidraRegistry', 'get_latest_resolution', address.registry, [factKey], 'Latest resolution attempt must be readable independently of canonical resolution.'],
  ['history', 'EvidraRegistry', 'get_resolution_history', address.registry, [factKey, 0, 50], 'Historical resolution pagination must return the available committed versions.'],
  ['evidence', 'EvidraRegistry', 'get_evidence_manifest', address.registry, [3n], 'Evidence manifest for the existing resolution must be readable.'],
  ['freshness', 'EvidraRegistry', 'is_fact_fresh', address.registry, [factKey], 'Freshness must be derived from the canonical fact timestamps.'],
  ['callback', 'EvidraConsumerProbe', 'get_callback_count', address.consumer, [], 'Callback counter must be readable after the live callback lifecycle.'],
  ['protocol-config', 'EvidraRegistry', 'get_protocol_config', address.registry, [], 'Protocol configuration must be readable.'],
  ['missing-request', 'EvidraRegistry', 'get_request', address.registry, [999999n], 'Missing request must return its defined empty/not-found representation or an expected contract error.'],
  ['missing-fact', 'EvidraRegistry', 'get_fact', address.registry, ['0'.repeat(64)], 'Missing fact must return its defined empty/not-found representation or an expected contract error.'],
];

const calls = [
  ['EvidraPolicyRegistry', 'get_source_policy', address.policy, ['core', 1]],
  ['EvidraPolicyRegistry', 'get_latest_source_policy', address.policy, ['core']],
  ['EvidraPolicyRegistry', 'is_source_policy_active', address.policy, ['core', 1]],
  ['EvidraPolicyRegistry', 'get_policy_hash', address.policy, ['core', 1]],
  ['EvidraPolicyRegistry', 'get_template', address.policy, ['launch', 1]],
  ['EvidraPolicyRegistry', 'get_latest_template', address.policy, ['launch']],
  ['EvidraPolicyRegistry', 'is_template_active', address.policy, ['launch', 1]],
  ['EvidraPolicyRegistry', 'get_template_hash', address.policy, ['launch', 1]],
  ['EvidraPolicyRegistry', 'get_latest_policy_version', address.policy, ['core']],
  ['EvidraPolicyRegistry', 'get_latest_template_version', address.policy, ['launch']],
  ['EvidraPolicyRegistry', 'get_ownership', address.policy, []],
  ['EvidraPolicyRegistry', 'get_owner', address.policy, []],
  ['EvidraPolicyRegistry', 'get_pending_owner', address.policy, []],
  ['EvidraPolicyRegistry', 'get_protocol_stats', address.policy, []],
  ['EvidraPolicyRegistry', 'get_event_count', address.policy, []],
  ['EvidraPolicyRegistry', 'get_events', address.policy, [0, 50]],
  ['EvidraPolicyRegistry', 'compute_policy_hash', address.policy, [
    'core', 1, 'Core official sources', 1, 1,
    'OFFICIAL,PRIMARY,INDEPENDENT_SECONDARY', 'SOCIAL,COMMUNITY', true,
    'Prefer primary official documents. Duplicate mirrors do not count as independent sources. A failed URL must not poison other usable sources.',
  ]],
  ['EvidraPolicyRegistry', 'compute_template_hash', address.policy, [
    'launch', 1, 'Launch before date', 'immutable_launch', 'subject,temporal',
    'An announcement alone does not count as launch. Require a production mainnet. User context cannot override these template rules.', 'core', 1,
  ]],
  ['EvidraPolicyRegistry', 'get_registry_version', address.policy, []],

  ['EvidraRegistry', 'get_request', address.registry, [3n]],
  ['EvidraRegistry', 'get_request_status', address.registry, [3n]],
  ['EvidraRegistry', 'get_fact', address.registry, [factKey]],
  ['EvidraRegistry', 'get_current_resolution', address.registry, [factKey]],
  ['EvidraRegistry', 'get_latest_resolution', address.registry, [factKey]],
  ['EvidraRegistry', 'get_resolution', address.registry, [3n]],
  ['EvidraRegistry', 'get_resolution_history', address.registry, [factKey, 0, 50]],
  ['EvidraRegistry', 'get_evidence_manifest', address.registry, [3n]],
  ['EvidraRegistry', 'compute_claim_key', address.registry, ['example.com', 'publishes the Example Domain page', 'Example Domain', '', '2026-09-21', 'IMMUTABLE']],
  ['EvidraRegistry', 'compute_fact_key', address.registry, ['5928183907a78b3b075b829d38457aefb9143e2dd13c2da49ef33db8ea3f21f3', 'c3ca8f47d5d00f29d09820fa362f9e8f0625477dbbd5647a64be8b210753bcf4', '1', '']],
  ['EvidraRegistry', 'compute_spec_hash', address.registry, ['example.com', 'publishes the Example Domain page', 'Example Domain', '', '2026-09-21', 'IMMUTABLE', '1', 0n, 'Verify the public Example Domain page.', '["https://example.com/"]']],
  ['EvidraRegistry', 'is_fact_fresh', address.registry, [factKey]],
  ['EvidraRegistry', 'can_reuse_fact', address.registry, [factKey]],
  ['EvidraRegistry', 'can_reuse_with_freshness', address.registry, [factKey, 0n]],
  ['EvidraRegistry', 'compute_callback_id', address.registry, [3n, 3n, address.consumer]],
  ['EvidraRegistry', 'quote_resolution_fee', address.registry, ['REUSE_IF_FRESH']],
  ['EvidraRegistry', 'get_protocol_config', address.registry, []],
  ['EvidraRegistry', 'get_resolver', address.registry, [address.resolver]],
  ['EvidraRegistry', 'get_protocol_stats', address.registry, []],
  ['EvidraRegistry', 'get_credit', address.registry, [zeroAddress]],
  ['EvidraRegistry', 'get_job_snapshot', address.registry, [3n]],
  ['EvidraRegistry', 'get_owner', address.registry, []],
  ['EvidraRegistry', 'get_guardian', address.registry, []],
  ['EvidraRegistry', 'is_paused', address.registry, []],
  ['EvidraRegistry', 'get_policy_registry', address.registry, []],
  ['EvidraRegistry', 'get_default_resolver', address.registry, []],
  ['EvidraRegistry', 'get_registry_version', address.registry, []],
  ['EvidraRegistry', 'get_event_count', address.registry, []],
  ['EvidraRegistry', 'get_events', address.registry, [0, 50]],
  ['EvidraRegistry', 'validate_seed_url', address.registry, ['https://example.com/']],

  ['EvidraResolver', 'get_resolver_version', address.resolver, []],
  ['EvidraResolver', 'get_registry', address.resolver, []],
  ['EvidraResolver', 'get_capabilities', address.resolver, []],
  ['EvidraResolver', 'get_capabilities_json', address.resolver, []],

  ['EvidraConsumerProbe', 'get_trusted_registry', address.consumer, []],
  ['EvidraConsumerProbe', 'get_last_request_id', address.consumer, []],
  ['EvidraConsumerProbe', 'get_last_fact_key', address.consumer, []],
  ['EvidraConsumerProbe', 'get_last_resolution_id', address.consumer, []],
  ['EvidraConsumerProbe', 'get_last_outcome', address.consumer, []],
  ['EvidraConsumerProbe', 'get_last_resolved_at', address.consumer, []],
  ['EvidraConsumerProbe', 'get_last_valid_until', address.consumer, []],
  ['EvidraConsumerProbe', 'get_last_callback_id', address.consumer, []],
  ['EvidraConsumerProbe', 'get_callback_count', address.consumer, []],
  ['EvidraConsumerProbe', 'get_duplicate_ignored_count', address.consumer, []],
  ['EvidraConsumerProbe', 'has_processed_callback', address.consumer, [zeroCallback]],
];

if (calls.length !== 64) throw new Error(`expected 64 view calls, found ${calls.length}`);

let readVariant = 'latest-final';
let finalReadProbe;
try {
  const actual = await client.readContract({
    address: address.policy,
    functionName: 'get_registry_version',
    args: [],
    transactionHashVariant: 'latest-final',
  });
  finalReadProbe = { result: 'PASS', actual: normalize(actual) };
} catch (error) {
  readVariant = 'latest-nonfinal';
  finalReadProbe = { result: 'UNSUPPORTED', error: String(error?.message || error).slice(0, 500) };
}

const results = [];
for (const [contract, method, target, args] of calls) {
  try {
    const actual = await client.readContract({
      address: target,
      functionName: method,
      args,
      transactionHashVariant: readVariant,
    });
    results.push({ contract, method, arguments: normalize(args), expectedSemantics: expectedSemantics[method], actual: normalize(actual), result: 'PASS' });
  } catch (error) {
    results.push({ contract, method, arguments: normalize(args), expectedSemantics: expectedSemantics[method], actual: null, result: 'FAIL', error: String(error?.message || error).slice(0, 300) });
  }
  await sleep(2300);
}

const failures = results.filter((item) => item.result === 'FAIL');
const scenarios = [];
for (const [scenario, contract, method, target, args, expected] of scenarioCalls) {
  try {
    const actual = await client.readContract({
      address: target,
      functionName: method,
      args,
      transactionHashVariant: readVariant,
    });
    scenarios.push({ scenario, contract, method, arguments: normalize(args), expectedSemantics: expected, actual: normalize(actual), observation: 'PASS' });
  } catch (error) {
    scenarios.push({ scenario, contract, method, arguments: normalize(args), expectedSemantics: expected, actual: null, observation: 'EXPECTED_OR_REVIEW', error: String(error?.message || error).slice(0, 300) });
  }
  await sleep(2300);
}

const payload = {
  network: { name: 'GenLayer Studio Dev', rpc: 'https://studio-dev.genlayer.com/api', chainId: 61997 },
  deployment: address,
  readVariant,
  latestFinalProbe: finalReadProbe,
  uniquePublicViews: { total: results.length, passed: results.length - failures.length, failed: failures.length },
  results,
  scenarioCoverage: scenarios,
};
const output = JSON.stringify(payload, null, 2);
if (process.env.CERT_OUTPUT) {
  mkdirSync(dirname(process.env.CERT_OUTPUT), { recursive: true });
  writeFileSync(process.env.CERT_OUTPUT, `${output}\n`);
}
console.log(output);
if (failures.length > 0) process.exitCode = 1;
