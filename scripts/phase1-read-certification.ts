import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  CONTRACT_ADDRESSES,
  FROZEN_NETWORK,
  createProtocolClient,
  type ProtocolClient,
} from '../packages/protocol/src/index.ts';

const factKey = 'e164495ffdf07a91f5a3f04c1d83eeae4d3098dbed64c5ed6f0b3c0680266cb1';
const zeroAddress = '0x0000000000000000000000000000000000000000';
const zeroCallback = '0'.repeat(64);
const client = createProtocolClient({
  rpcUrl: FROZEN_NETWORK.rpcUrl,
  schedulerOptions: { concurrency: 1, minIntervalMs: Number(process.env.RPC_MIN_INTERVAL_MS ?? 2400), maxRetries: 3 },
});

function normalize(value: unknown, depth = 0): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (depth > 8) return '[depth limit]';
  if (Array.isArray(value)) return value.map((item) => normalize(item, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, depth + 1)]));
}

type ReadCase = { contract: string; method: string; run: (client: ProtocolClient) => Promise<unknown> };
const calls: ReadCase[] = [
  { contract: 'EvidraPolicyRegistry', method: 'get_source_policy', run: (c) => c.policyRegistry.getSourcePolicy('core', 1) },
  { contract: 'EvidraPolicyRegistry', method: 'get_latest_source_policy', run: (c) => c.policyRegistry.getLatestSourcePolicy('core') },
  { contract: 'EvidraPolicyRegistry', method: 'is_source_policy_active', run: (c) => c.policyRegistry.isSourcePolicyActive('core', 1) },
  { contract: 'EvidraPolicyRegistry', method: 'get_policy_hash', run: (c) => c.policyRegistry.getPolicyHash('core', 1) },
  { contract: 'EvidraPolicyRegistry', method: 'get_template', run: (c) => c.policyRegistry.getTemplate('launch', 1) },
  { contract: 'EvidraPolicyRegistry', method: 'get_latest_template', run: (c) => c.policyRegistry.getLatestTemplate('launch') },
  { contract: 'EvidraPolicyRegistry', method: 'is_template_active', run: (c) => c.policyRegistry.isTemplateActive('launch', 1) },
  { contract: 'EvidraPolicyRegistry', method: 'get_template_hash', run: (c) => c.policyRegistry.getTemplateHash('launch', 1) },
  { contract: 'EvidraPolicyRegistry', method: 'get_latest_policy_version', run: (c) => c.policyRegistry.getLatestPolicyVersion('core') },
  { contract: 'EvidraPolicyRegistry', method: 'get_latest_template_version', run: (c) => c.policyRegistry.getLatestTemplateVersion('launch') },
  { contract: 'EvidraPolicyRegistry', method: 'get_ownership', run: (c) => c.policyRegistry.getOwnership() },
  { contract: 'EvidraPolicyRegistry', method: 'get_owner', run: (c) => c.policyRegistry.getOwner() },
  { contract: 'EvidraPolicyRegistry', method: 'get_pending_owner', run: (c) => c.policyRegistry.getPendingOwner() },
  { contract: 'EvidraPolicyRegistry', method: 'get_protocol_stats', run: (c) => c.policyRegistry.getProtocolStats() },
  { contract: 'EvidraPolicyRegistry', method: 'get_event_count', run: (c) => c.policyRegistry.getEventCount() },
  { contract: 'EvidraPolicyRegistry', method: 'get_events', run: (c) => c.policyRegistry.getEvents(0, 50) },
  { contract: 'EvidraPolicyRegistry', method: 'compute_policy_hash', run: (c) => c.policyRegistry.computePolicyHash('core', 1, 'Core official sources', 1, 1, 'OFFICIAL,PRIMARY,INDEPENDENT_SECONDARY', 'SOCIAL,COMMUNITY', true, 'Prefer primary official documents.') },
  { contract: 'EvidraPolicyRegistry', method: 'compute_template_hash', run: (c) => c.policyRegistry.computeTemplateHash('launch', 1, 'Launch before date', 'immutable_launch', 'subject,temporal', 'Require a production mainnet.', 'core', 1) },
  { contract: 'EvidraPolicyRegistry', method: 'get_registry_version', run: (c) => c.policyRegistry.getRegistryVersion() },
  { contract: 'EvidraRegistry', method: 'get_request', run: (c) => c.registry.getRequest(3n) },
  { contract: 'EvidraRegistry', method: 'get_request_status', run: (c) => c.registry.getRequestStatus(3n) },
  { contract: 'EvidraRegistry', method: 'get_fact', run: (c) => c.registry.getFact(factKey) },
  { contract: 'EvidraRegistry', method: 'get_current_resolution', run: (c) => c.registry.getCurrentResolution(factKey) },
  { contract: 'EvidraRegistry', method: 'get_latest_resolution', run: (c) => c.registry.getLatestResolution(factKey) },
  { contract: 'EvidraRegistry', method: 'get_resolution', run: (c) => c.registry.getResolution(3n) },
  { contract: 'EvidraRegistry', method: 'get_resolution_history', run: (c) => c.registry.getResolutionHistory(factKey, 0, 50) },
  { contract: 'EvidraRegistry', method: 'get_evidence_manifest', run: (c) => c.registry.getEvidenceManifest(3n) },
  { contract: 'EvidraRegistry', method: 'compute_claim_key', run: (c) => c.registry.computeClaimKey('example.com', 'publishes the Example Domain page', 'Example Domain', '', '2026-09-21', 'IMMUTABLE') },
  { contract: 'EvidraRegistry', method: 'compute_fact_key', run: (c) => c.registry.computeFactKey('5928183907a78b3b075b829d38457aefb9143e2dd13c2da49ef33db8ea3f21f3', 'c3ca8f47d5d00f29d09820fa362f9e8f0625477dbbd5647a64be8b210753bcf4', '1', '') },
  { contract: 'EvidraRegistry', method: 'compute_spec_hash', run: (c) => c.registry.computeSpecHash('example.com', 'publishes the Example Domain page', 'Example Domain', '', '2026-09-21', 'IMMUTABLE', '1', 0n, 'Verify the public Example Domain page.', '["https://example.com/"]') },
  { contract: 'EvidraRegistry', method: 'is_fact_fresh', run: (c) => c.registry.isFactFresh(factKey) },
  { contract: 'EvidraRegistry', method: 'can_reuse_fact', run: (c) => c.registry.canReuseFact(factKey) },
  { contract: 'EvidraRegistry', method: 'can_reuse_with_freshness', run: (c) => c.registry.canReuseWithFreshness(factKey, 0n) },
  { contract: 'EvidraRegistry', method: 'compute_callback_id', run: (c) => c.registry.computeCallbackId(3n, 3n, CONTRACT_ADDRESSES.consumerProbe) },
  { contract: 'EvidraRegistry', method: 'quote_resolution_fee', run: (c) => c.registry.quoteResolutionFee('REUSE_IF_FRESH') },
  { contract: 'EvidraRegistry', method: 'get_protocol_config', run: (c) => c.registry.getProtocolConfig() },
  { contract: 'EvidraRegistry', method: 'get_resolver', run: (c) => c.registry.getResolver(CONTRACT_ADDRESSES.resolver) },
  { contract: 'EvidraRegistry', method: 'get_protocol_stats', run: (c) => c.registry.getProtocolStats() },
  { contract: 'EvidraRegistry', method: 'get_credit', run: (c) => c.registry.getCredit(zeroAddress) },
  { contract: 'EvidraRegistry', method: 'get_job_snapshot', run: (c) => c.registry.getJobSnapshot(3n) },
  { contract: 'EvidraRegistry', method: 'get_owner', run: (c) => c.registry.getOwner() },
  { contract: 'EvidraRegistry', method: 'get_guardian', run: (c) => c.registry.getGuardian() },
  { contract: 'EvidraRegistry', method: 'is_paused', run: (c) => c.registry.isPaused() },
  { contract: 'EvidraRegistry', method: 'get_policy_registry', run: (c) => c.registry.getPolicyRegistry() },
  { contract: 'EvidraRegistry', method: 'get_default_resolver', run: (c) => c.registry.getDefaultResolver() },
  { contract: 'EvidraRegistry', method: 'get_registry_version', run: (c) => c.registry.getRegistryVersion() },
  { contract: 'EvidraRegistry', method: 'get_event_count', run: (c) => c.registry.getEventCount() },
  { contract: 'EvidraRegistry', method: 'get_events', run: (c) => c.registry.getEvents(0, 50) },
  { contract: 'EvidraRegistry', method: 'validate_seed_url', run: (c) => c.registry.validateSeedUrl('https://example.com/') },
  { contract: 'EvidraResolver', method: 'get_resolver_version', run: (c) => c.resolver.getResolverVersion() },
  { contract: 'EvidraResolver', method: 'get_registry', run: (c) => c.resolver.getRegistry() },
  { contract: 'EvidraResolver', method: 'get_capabilities', run: (c) => c.resolver.getCapabilities() },
  { contract: 'EvidraResolver', method: 'get_capabilities_json', run: (c) => c.resolver.getCapabilitiesJson() },
  { contract: 'EvidraConsumerProbe', method: 'get_trusted_registry', run: (c) => c.consumerProbe.getTrustedRegistry() },
  { contract: 'EvidraConsumerProbe', method: 'get_last_request_id', run: (c) => c.consumerProbe.getLastRequestId() },
  { contract: 'EvidraConsumerProbe', method: 'get_last_fact_key', run: (c) => c.consumerProbe.getLastFactKey() },
  { contract: 'EvidraConsumerProbe', method: 'get_last_resolution_id', run: (c) => c.consumerProbe.getLastResolutionId() },
  { contract: 'EvidraConsumerProbe', method: 'get_last_outcome', run: (c) => c.consumerProbe.getLastOutcome() },
  { contract: 'EvidraConsumerProbe', method: 'get_last_resolved_at', run: (c) => c.consumerProbe.getLastResolvedAt() },
  { contract: 'EvidraConsumerProbe', method: 'get_last_valid_until', run: (c) => c.consumerProbe.getLastValidUntil() },
  { contract: 'EvidraConsumerProbe', method: 'get_last_callback_id', run: (c) => c.consumerProbe.getLastCallbackId() },
  { contract: 'EvidraConsumerProbe', method: 'get_callback_count', run: (c) => c.consumerProbe.getCallbackCount() },
  { contract: 'EvidraConsumerProbe', method: 'get_duplicate_ignored_count', run: (c) => c.consumerProbe.getDuplicateIgnoredCount() },
  { contract: 'EvidraConsumerProbe', method: 'has_processed_callback', run: (c) => c.consumerProbe.hasProcessedCallback(zeroCallback) },
];

if (calls.length !== 64) throw new Error(`Expected 64 calls, got ${calls.length}`);
const verification = await client.verifyDeployment();
const results: Array<Record<string, unknown>> = [];
for (const item of calls) {
  try { results.push({ contract: item.contract, method: item.method, result: 'PASS', actual: normalize(await item.run(client)) }); }
  catch (error) { results.push({ contract: item.contract, method: item.method, result: 'FAIL', error: String(error instanceof Error ? error.message : error).slice(0, 300) }); }
}
const failures = results.filter((item) => item.result === 'FAIL');
const output = {
  network: { name: FROZEN_NETWORK.name, rpc: FROZEN_NETWORK.rpcUrl, chainId: FROZEN_NETWORK.chainId },
  deployment: CONTRACT_ADDRESSES,
  readMode: verification.readMode,
  uniquePublicViews: { total: results.length, passed: results.length - failures.length, failed: failures.length },
  results,
  observedAt: new Date().toISOString(),
};
const serialized = JSON.stringify(output, null, 2);
if (process.env.CERT_OUTPUT) { mkdirSync(dirname(process.env.CERT_OUTPUT), { recursive: true }); writeFileSync(process.env.CERT_OUTPUT, `${serialized}\n`); }
console.log(serialized);
if (failures.length) process.exitCode = 1;
