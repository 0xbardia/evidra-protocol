import type { ContractName } from './constants.js';

export interface PublicViewMethod {
  contract: ContractName;
  functionName: string;
}

const methods = (contract: ContractName, names: string[]): PublicViewMethod[] => names.map((functionName) => ({ contract, functionName }));

export const PUBLIC_VIEW_METHODS: readonly PublicViewMethod[] = [
  ...methods('policyRegistry', [
    'get_source_policy', 'get_latest_source_policy', 'is_source_policy_active', 'get_policy_hash',
    'get_template', 'get_latest_template', 'is_template_active', 'get_template_hash',
    'get_latest_policy_version', 'get_latest_template_version', 'get_ownership', 'get_owner',
    'get_pending_owner', 'get_protocol_stats', 'get_event_count', 'get_events',
    'compute_policy_hash', 'compute_template_hash', 'get_registry_version',
  ]),
  ...methods('registry', [
    'get_request', 'get_request_status', 'get_fact', 'get_current_resolution', 'get_latest_resolution',
    'get_resolution', 'get_resolution_history', 'get_evidence_manifest', 'compute_claim_key',
    'compute_fact_key', 'compute_spec_hash', 'is_fact_fresh', 'can_reuse_fact', 'can_reuse_with_freshness',
    'compute_callback_id', 'quote_resolution_fee', 'get_protocol_config', 'get_resolver',
    'get_protocol_stats', 'get_credit', 'get_job_snapshot', 'get_owner', 'get_guardian', 'is_paused',
    'get_policy_registry', 'get_default_resolver', 'get_registry_version', 'get_event_count', 'get_events',
    'validate_seed_url',
  ]),
  ...methods('resolver', ['get_resolver_version', 'get_registry', 'get_capabilities', 'get_capabilities_json']),
  ...methods('consumerProbe', [
    'get_trusted_registry', 'get_last_request_id', 'get_last_fact_key', 'get_last_resolution_id',
    'get_last_outcome', 'get_last_resolved_at', 'get_last_valid_until', 'get_last_callback_id',
    'get_callback_count', 'get_duplicate_ignored_count', 'has_processed_callback',
  ]),
];

if (PUBLIC_VIEW_METHODS.length !== 64) throw new Error(`Expected 64 public views, got ${PUBLIC_VIEW_METHODS.length}`);
