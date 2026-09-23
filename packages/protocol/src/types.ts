export type Address = string;
export type U256 = bigint;
export type KnownOrUnknown<T extends string> = T | (string & {});

export type Outcome = KnownOrUnknown<'TRUE' | 'FALSE' | 'UNRESOLVED'>;
export type DiagnosticReason = KnownOrUnknown<
  | 'NONE'
  | 'AMBIGUOUS'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONFLICTING_EVIDENCE'
  | 'SOURCE_POLICY_UNSATISFIED'
  | 'SOURCE_UNAVAILABLE'
  | 'INTERNAL_RESOLUTION_ERROR'
>;
export type RequestStatus = KnownOrUnknown<
  | 'PENDING'
  | 'DISPATCHED'
  | 'RESOLVED'
  | 'REUSED'
  | 'CANCELLED'
  | 'FAILED'
  | 'UNKNOWN'
>;
export type CallbackStatus = KnownOrUnknown<
  | 'NOT_REQUESTED'
  | 'DISPATCHED'
  | 'ACKNOWLEDGED'
  | 'FAILED_REPORTED'
>;
export type Mutability = KnownOrUnknown<'IMMUTABLE' | 'MUTABLE_WITH_TTL'>;
export type ReuseMode = KnownOrUnknown<'REUSE_IF_FRESH' | 'FORCE_FRESH_RESOLUTION'>;
export type SourceClass = KnownOrUnknown<
  | 'OFFICIAL'
  | 'PRIMARY'
  | 'INDEPENDENT_SECONDARY'
  | 'DERIVED'
  | 'COMMUNITY'
  | 'SOCIAL'
  | 'UNKNOWN'
  | 'INVALID'
>;
export type SourceStatus = KnownOrUnknown<'USABLE' | 'UNAVAILABLE' | 'INVALID' | 'DUPLICATE' | 'DERIVED'>;

export interface SourcePolicyRecord {
  exists: boolean;
  policy_id: string;
  version: number;
  name: string;
  active: boolean;
  min_primary_sources: number;
  min_independent_sources: number;
  allowed_classes: string;
  disallowed_classes: string;
  require_cross_check: boolean;
  semantic_rules: string;
  policy_hash: string;
  published_at: U256;
  deprecated: boolean;
}

export interface TemplateRecord {
  exists: boolean;
  template_id: string;
  version: number;
  name: string;
  active: boolean;
  fact_type: string;
  required_fields: string;
  resolution_instructions: string;
  default_policy_id: string;
  default_policy_version: number;
  template_hash: string;
  published_at: U256;
  deprecated: boolean;
}

export interface OwnershipView { owner: Address; pending_owner: Address }

export interface ProtocolEvent {
  index: U256;
  topic: string;
  payload: string;
  timestamp: U256;
}

export interface EventPage {
  offset: number;
  limit: number;
  total: number;
  items: ProtocolEvent[];
}

export interface ResolverInfo {
  exists: boolean;
  resolver: Address;
  enabled: boolean;
  resolver_version: string;
  capabilities: string;
  registered_at: U256;
}

export interface RequestRecord {
  exists: boolean;
  request_id: U256;
  requester: Address;
  claim_key: string;
  fact_key: string;
  spec_hash: string;
  policy_hash: string;
  policy_id: string;
  policy_version: number;
  assigned_resolver: Address;
  created_at: U256;
  status: RequestStatus;
  active_attempt_id: U256;
  last_attempt_at: U256;
  retry_after: U256;
  max_attempts: number;
  attempt_count: number;
  callback_target: Address;
  callback_status: CallbackStatus;
  reuse_mode: ReuseMode;
  fee_paid: U256;
  mutability: Mutability;
  schema_version: string;
  ttl_seconds: U256;
  seed_urls_json: string;
  subject: string;
  predicate: string;
  object_value: string;
  qualifiers: string;
  temporal: string;
  description: string;
  current_resolution_id: U256;
  supplemental_urls_json: string;
  template_id: string;
  template_version: number;
  template_hash: string;
  fact_type: string;
  template_resolution_instructions: string;
}

export interface ResolutionRecord {
  exists: boolean;
  resolution_id: U256;
  request_id: U256;
  attempt_id: U256;
  claim_key: string;
  fact_key: string;
  spec_hash: string;
  policy_hash: string;
  outcome: Outcome;
  diagnostic_reason: DiagnosticReason;
  policy_satisfied: boolean;
  resolver_version: string;
  evidence_manifest_hash: string;
  reasoning_summary: string;
  evaluated_at: U256;
  committed_at: U256;
  valid_until: U256;
  resolution_version: number;
  supersedes_resolution_id: U256;
  template_id: string;
  template_version: number;
  template_hash: string;
}

export interface FactRecord {
  exists: boolean;
  fact_key: string;
  claim_key: string;
  policy_hash: string;
  schema_version: string;
  mutability: Mutability;
  current_resolution_id: U256;
  latest_resolution_id: U256;
  current_request_id: U256;
  current_outcome: Outcome;
  resolved_at: U256;
  valid_until: U256;
  resolution_version: number;
  template_hash: string;
}

export interface ProtocolConfig {
  owner: Address;
  pending_owner: Address;
  guardian: Address;
  policy_registry: Address;
  default_resolver: Address;
  paused_new_requests: boolean;
  fee_base: U256;
  fee_per_attempt: U256;
  fee_reuse: U256;
  retry_delay_seconds: U256;
  stale_after_seconds: U256;
  max_attempts: number;
  max_seed_urls: number;
  schema_version: string;
  registry_version: string;
}

export interface ProtocolStats {
  request_count: U256;
  resolution_count: U256;
  reused_count: U256;
  paused: boolean;
  event_count: U256;
}

export interface ResolutionHistoryPage {
  fact_key: string;
  offset: number;
  limit: number;
  total: number;
  resolution_ids: U256[];
}

export interface EvidenceEntry {
  url: string;
  canonical?: string;
  host?: string;
  status: SourceStatus;
  error?: string;
  origin: string;
  category?: string;
  provenance_group: string;
  source_class: SourceClass;
  is_primary: boolean;
  is_independent: boolean;
  policy_eligible: boolean;
  evidence_hash: string;
  relevant_timestamp?: string;
}

export interface EvidenceManifestView {
  exists: boolean;
  resolution_id: U256;
  manifest_hash: string;
  manifest_json: string;
}

export interface ResolverCapabilities {
  version: string;
  registry: Address;
  web_access: boolean;
  llm_access: boolean;
  source_isolation: boolean;
  injection_hardened: boolean;
  equivalence: string;
}

export interface ReadMeta {
  source: 'chain' | 'cache';
  readMode: 'latest-final' | 'latest-nonfinal';
  chainId: number;
  contractAddress: string;
  observedAt: string;
  finalizedRead: boolean;
}

export type TransactionState = KnownOrUnknown<'SUBMITTED' | 'PENDING' | 'DECIDED' | 'FINALIZED' | 'FAILED' | 'NETWORK_ERROR'>;

export interface TransactionRecord {
  tx_id: string;
  kind: string;
  request_id?: U256;
  resolution_id?: U256;
  status: TransactionState;
  submitted_at?: string;
  decided_at?: string;
  finalized_at?: string;
  error_code?: string;
  error_message?: string;
}

export interface ReadSnapshot {
  source: 'cache' | 'chain';
  readMode: 'latest-final' | 'latest-nonfinal';
  chainId: number;
  observedAt: string;
  syncedAt?: string;
  stale: boolean;
}

export interface Page<T> {
  items: T[];
  pagination: { offset: number; limit: number; total: number; hasMore: boolean };
}
