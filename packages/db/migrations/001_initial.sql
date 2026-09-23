CREATE TABLE IF NOT EXISTS protocol_state (
  chain_id integer PRIMARY KEY,
  network_name text NOT NULL,
  registry_address text NOT NULL,
  policy_registry_address text NOT NULL,
  resolver_address text NOT NULL,
  consumer_probe_address text NOT NULL,
  registry_version text NOT NULL,
  resolver_version text NOT NULL,
  policy_registry_version text NOT NULL,
  paused boolean NOT NULL,
  resolver_enabled boolean NOT NULL,
  default_resolver text NOT NULL,
  config_json jsonb NOT NULL,
  stats_json jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_finalized_at timestamptz,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  observed_event_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'idle',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policies (
  policy_id text NOT NULL,
  version integer NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL,
  deprecated boolean NOT NULL,
  min_primary_sources integer NOT NULL,
  min_independent_sources integer NOT NULL,
  allowed_classes text NOT NULL,
  disallowed_classes text NOT NULL,
  require_cross_check boolean NOT NULL,
  semantic_rules text NOT NULL,
  policy_hash text NOT NULL,
  published_at numeric(78,0) NOT NULL,
  raw_json jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_id, version)
);

CREATE TABLE IF NOT EXISTS templates (
  template_id text NOT NULL,
  version integer NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL,
  deprecated boolean NOT NULL,
  fact_type text NOT NULL,
  required_fields text NOT NULL,
  resolution_instructions text NOT NULL,
  default_policy_id text NOT NULL,
  default_policy_version integer NOT NULL,
  template_hash text NOT NULL,
  published_at numeric(78,0) NOT NULL,
  raw_json jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, version)
);

CREATE TABLE IF NOT EXISTS facts (
  fact_key text PRIMARY KEY,
  claim_key text NOT NULL,
  policy_hash text NOT NULL,
  schema_version text NOT NULL,
  mutability text NOT NULL,
  canonical_resolution_id numeric(78,0) NOT NULL,
  latest_resolution_id numeric(78,0) NOT NULL,
  current_request_id numeric(78,0) NOT NULL,
  canonical_outcome text NOT NULL,
  resolved_at numeric(78,0) NOT NULL,
  valid_until numeric(78,0) NOT NULL,
  resolution_version integer NOT NULL,
  template_hash text NOT NULL,
  is_fresh boolean NOT NULL,
  raw_json jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requests (
  request_id numeric(78,0) PRIMARY KEY,
  requester text NOT NULL,
  claim_key text NOT NULL,
  fact_key text NOT NULL,
  spec_hash text NOT NULL,
  policy_hash text NOT NULL,
  policy_id text NOT NULL,
  policy_version integer NOT NULL,
  assigned_resolver text NOT NULL,
  created_at numeric(78,0) NOT NULL,
  status text NOT NULL,
  active_attempt_id numeric(78,0) NOT NULL,
  last_attempt_at numeric(78,0) NOT NULL,
  retry_after numeric(78,0) NOT NULL,
  max_attempts integer NOT NULL,
  attempt_count integer NOT NULL,
  callback_target text NOT NULL,
  callback_status text NOT NULL,
  reuse_mode text NOT NULL,
  fee_paid numeric(78,0) NOT NULL,
  mutability text NOT NULL,
  schema_version text NOT NULL,
  ttl_seconds numeric(78,0) NOT NULL,
  seed_urls_json text NOT NULL,
  subject text NOT NULL,
  predicate text NOT NULL,
  object_value text NOT NULL,
  qualifiers text NOT NULL,
  temporal text NOT NULL,
  description text NOT NULL,
  current_resolution_id numeric(78,0) NOT NULL,
  supplemental_urls_json text NOT NULL,
  template_id text NOT NULL,
  template_version integer NOT NULL,
  template_hash text NOT NULL,
  fact_type text NOT NULL,
  template_resolution_instructions text NOT NULL,
  raw_json jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS requests_fact_key_idx ON requests (fact_key);
CREATE INDEX IF NOT EXISTS requests_created_at_idx ON requests (created_at DESC);

CREATE TABLE IF NOT EXISTS resolutions (
  resolution_id numeric(78,0) PRIMARY KEY,
  request_id numeric(78,0) NOT NULL,
  fact_key text NOT NULL,
  resolution_version integer NOT NULL,
  attempt_id numeric(78,0) NOT NULL,
  claim_key text NOT NULL,
  spec_hash text NOT NULL,
  policy_hash text NOT NULL,
  outcome text NOT NULL,
  diagnostic_reason text NOT NULL,
  policy_satisfied boolean NOT NULL,
  resolver_version text NOT NULL,
  evidence_manifest_hash text NOT NULL,
  reasoning_summary text NOT NULL,
  evaluated_at numeric(78,0) NOT NULL,
  committed_at numeric(78,0) NOT NULL,
  valid_until numeric(78,0) NOT NULL,
  supersedes_resolution_id numeric(78,0) NOT NULL,
  template_id text NOT NULL,
  template_version integer NOT NULL,
  template_hash text NOT NULL,
  is_canonical boolean NOT NULL DEFAULT false,
  is_latest boolean NOT NULL DEFAULT false,
  raw_json jsonb NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resolutions_fact_version_idx ON resolutions (fact_key, resolution_version DESC);
CREATE INDEX IF NOT EXISTS resolutions_request_idx ON resolutions (request_id);

CREATE TABLE IF NOT EXISTS evidence (
  resolution_id numeric(78,0) NOT NULL,
  ordinal integer NOT NULL,
  url text NOT NULL,
  canonical text NOT NULL,
  host text NOT NULL,
  status text NOT NULL,
  error text,
  origin text NOT NULL,
  category text NOT NULL,
  provenance_group text NOT NULL,
  source_class text NOT NULL,
  is_primary boolean NOT NULL,
  is_independent boolean NOT NULL,
  policy_eligible boolean NOT NULL,
  evidence_hash text NOT NULL,
  relevant_timestamp text,
  raw_json jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resolution_id, ordinal),
  FOREIGN KEY (resolution_id) REFERENCES resolutions(resolution_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  tx_id text PRIMARY KEY,
  kind text NOT NULL,
  request_id numeric(78,0),
  resolution_id numeric(78,0),
  status text NOT NULL,
  submitted_at timestamptz,
  decided_at timestamptz,
  finalized_at timestamptz,
  error_code text,
  error_message text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facts_claim_key_idx ON facts (claim_key);
CREATE INDEX IF NOT EXISTS facts_outcome_idx ON facts (canonical_outcome);
CREATE INDEX IF NOT EXISTS facts_fresh_idx ON facts (is_fresh);
CREATE INDEX IF NOT EXISTS facts_policy_idx ON facts (policy_hash);
CREATE INDEX IF NOT EXISTS facts_template_idx ON facts (template_hash);

INSERT INTO sync_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
