import type pg from 'pg';
import {
  toJsonSafe,
  type FactRecord,
  type ProtocolConfig,
  type ProtocolStats,
  type RequestRecord,
  type ResolutionRecord,
  type SourcePolicyRecord,
  type TemplateRecord,
  type EvidenceManifestView,
  type U256,
} from '@evidra/protocol';

export interface FactFilters {
  offset: number;
  limit: number;
  outcome?: string | undefined;
  fresh?: boolean | undefined;
  policy?: string | undefined;
  template?: string | undefined;
  mutability?: string | undefined;
  search?: string | undefined;
  sort: 'recent' | 'request';
}

export interface ProjectionFact {
  fact: FactRecord;
  currentRequest: RequestRecord | null;
  canonicalResolution: ResolutionRecord | null;
  latestResolution: ResolutionRecord | null;
  fresh: boolean;
  syncedAt: string;
  source: 'cache' | 'chain';
}

export interface ProjectionStatus {
  lastFinalizedAt: string | null;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  status: string;
  observedEventCounts: Record<string, string>;
  updatedAt: string | null;
  lastRequestId?: bigint;
  lastResolutionId?: bigint;
  lastProtocolConfigCheckAt?: string | null;
}

const numeric = (value: bigint | number | string): string => String(value);
const json = (value: unknown): string => JSON.stringify(toJsonSafe(value));

function rowToResolution(row: Record<string, unknown>): ResolutionRecord {
  return {
    exists: true,
    resolution_id: BigInt(String(row.resolution_id)), request_id: BigInt(String(row.request_id)), attempt_id: BigInt(String(row.attempt_id)),
    claim_key: String(row.claim_key), fact_key: String(row.fact_key), spec_hash: String(row.spec_hash), policy_hash: String(row.policy_hash),
    outcome: String(row.outcome), diagnostic_reason: String(row.diagnostic_reason), policy_satisfied: Boolean(row.policy_satisfied),
    resolver_version: String(row.resolver_version), evidence_manifest_hash: String(row.evidence_manifest_hash), reasoning_summary: String(row.reasoning_summary),
    evaluated_at: BigInt(String(row.evaluated_at)), committed_at: BigInt(String(row.committed_at)), valid_until: BigInt(String(row.valid_until)),
    resolution_version: Number(row.resolution_version), supersedes_resolution_id: BigInt(String(row.supersedes_resolution_id)),
    template_id: String(row.template_id), template_version: Number(row.template_version), template_hash: String(row.template_hash),
  };
}

function rowToRequest(row: Record<string, unknown>): RequestRecord {
  return {
    exists: true,
    request_id: BigInt(String(row.request_id)), requester: String(row.requester), claim_key: String(row.claim_key), fact_key: String(row.fact_key),
    spec_hash: String(row.spec_hash), policy_hash: String(row.policy_hash), policy_id: String(row.policy_id), policy_version: Number(row.policy_version),
    assigned_resolver: String(row.assigned_resolver), created_at: BigInt(String(row.created_at)), status: String(row.status),
    active_attempt_id: BigInt(String(row.active_attempt_id)), last_attempt_at: BigInt(String(row.last_attempt_at)), retry_after: BigInt(String(row.retry_after)),
    max_attempts: Number(row.max_attempts), attempt_count: Number(row.attempt_count), callback_target: String(row.callback_target), callback_status: String(row.callback_status),
    reuse_mode: String(row.reuse_mode), fee_paid: BigInt(String(row.fee_paid)), mutability: String(row.mutability), schema_version: String(row.schema_version),
    ttl_seconds: BigInt(String(row.ttl_seconds)), seed_urls_json: String(row.seed_urls_json), subject: String(row.subject), predicate: String(row.predicate),
    object_value: String(row.object_value), qualifiers: String(row.qualifiers), temporal: String(row.temporal), description: String(row.description),
    current_resolution_id: BigInt(String(row.current_resolution_id)), supplemental_urls_json: String(row.supplemental_urls_json), template_id: String(row.template_id),
    template_version: Number(row.template_version), template_hash: String(row.template_hash), fact_type: String(row.fact_type), template_resolution_instructions: String(row.template_resolution_instructions),
  } as RequestRecord;
}

function rowToFact(row: Record<string, unknown>): FactRecord {
  return {
    exists: true,
    fact_key: String(row.fact_key), claim_key: String(row.claim_key), policy_hash: String(row.policy_hash), schema_version: String(row.schema_version),
    mutability: String(row.mutability), current_resolution_id: BigInt(String(row.canonical_resolution_id)), latest_resolution_id: BigInt(String(row.latest_resolution_id)),
    current_request_id: BigInt(String(row.current_request_id)), current_outcome: String(row.canonical_outcome), resolved_at: BigInt(String(row.resolved_at)),
    valid_until: BigInt(String(row.valid_until)), resolution_version: Number(row.resolution_version), template_hash: String(row.template_hash),
  } as FactRecord;
}

function parseRaw(row: Record<string, unknown>): Record<string, unknown> {
  const raw = row.raw_json;
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>;
  return {};
}

export class ProjectionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async ping(): Promise<void> { await this.pool.query('SELECT 1'); }

  async upsertProtocolState(input: {
    chainId: number; networkName: string; registryAddress: string; policyRegistryAddress: string; resolverAddress: string; consumerProbeAddress: string;
    registryVersion: string; resolverVersion: string; policyRegistryVersion: string; paused: boolean; resolverEnabled: boolean; defaultResolver: string;
    config: ProtocolConfig; stats: ProtocolStats;
  }): Promise<void> {
    await this.pool.query(`INSERT INTO protocol_state
      (chain_id, network_name, registry_address, policy_registry_address, resolver_address, consumer_probe_address, registry_version, resolver_version, policy_registry_version, paused, resolver_enabled, default_resolver, config_json, stats_json, observed_at, synced_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,now(),now())
      ON CONFLICT (chain_id) DO UPDATE SET network_name=EXCLUDED.network_name, registry_address=EXCLUDED.registry_address, policy_registry_address=EXCLUDED.policy_registry_address, resolver_address=EXCLUDED.resolver_address, consumer_probe_address=EXCLUDED.consumer_probe_address, registry_version=EXCLUDED.registry_version, resolver_version=EXCLUDED.resolver_version, policy_registry_version=EXCLUDED.policy_registry_version, paused=EXCLUDED.paused, resolver_enabled=EXCLUDED.resolver_enabled, default_resolver=EXCLUDED.default_resolver, config_json=EXCLUDED.config_json, stats_json=EXCLUDED.stats_json, observed_at=now(), synced_at=now()`,
      [input.chainId, input.networkName, input.registryAddress, input.policyRegistryAddress, input.resolverAddress, input.consumerProbeAddress, input.registryVersion, input.resolverVersion, input.policyRegistryVersion, input.paused, input.resolverEnabled, input.defaultResolver, json(input.config), json(input.stats)]);
  }

  async upsertPolicy(policy: SourcePolicyRecord): Promise<void> {
    await this.pool.query(`INSERT INTO policies (policy_id,version,name,active,deprecated,min_primary_sources,min_independent_sources,allowed_classes,disallowed_classes,require_cross_check,semantic_rules,policy_hash,published_at,raw_json,synced_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,now())
      ON CONFLICT (policy_id,version) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, deprecated=EXCLUDED.deprecated, min_primary_sources=EXCLUDED.min_primary_sources, min_independent_sources=EXCLUDED.min_independent_sources, allowed_classes=EXCLUDED.allowed_classes, disallowed_classes=EXCLUDED.disallowed_classes, require_cross_check=EXCLUDED.require_cross_check, semantic_rules=EXCLUDED.semantic_rules, policy_hash=EXCLUDED.policy_hash, published_at=EXCLUDED.published_at, raw_json=EXCLUDED.raw_json, synced_at=now()`,
      [policy.policy_id, policy.version, policy.name, policy.active, policy.deprecated, policy.min_primary_sources, policy.min_independent_sources, policy.allowed_classes, policy.disallowed_classes, policy.require_cross_check, policy.semantic_rules, policy.policy_hash, numeric(policy.published_at), json(policy)]);
  }

  async upsertTemplate(template: TemplateRecord): Promise<void> {
    await this.pool.query(`INSERT INTO templates (template_id,version,name,active,deprecated,fact_type,required_fields,resolution_instructions,default_policy_id,default_policy_version,template_hash,published_at,raw_json,synced_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,now())
      ON CONFLICT (template_id,version) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, deprecated=EXCLUDED.deprecated, fact_type=EXCLUDED.fact_type, required_fields=EXCLUDED.required_fields, resolution_instructions=EXCLUDED.resolution_instructions, default_policy_id=EXCLUDED.default_policy_id, default_policy_version=EXCLUDED.default_policy_version, template_hash=EXCLUDED.template_hash, published_at=EXCLUDED.published_at, raw_json=EXCLUDED.raw_json, synced_at=now()`,
      [template.template_id, template.version, template.name, template.active, template.deprecated, template.fact_type, template.required_fields, template.resolution_instructions, template.default_policy_id, template.default_policy_version, template.template_hash, numeric(template.published_at), json(template)]);
  }

  async upsertRequest(request: RequestRecord): Promise<void> {
    const r = request;
    await this.pool.query(`INSERT INTO requests (request_id,requester,claim_key,fact_key,spec_hash,policy_hash,policy_id,policy_version,assigned_resolver,created_at,status,active_attempt_id,last_attempt_at,retry_after,max_attempts,attempt_count,callback_target,callback_status,reuse_mode,fee_paid,mutability,schema_version,ttl_seconds,seed_urls_json,subject,predicate,object_value,qualifiers,temporal,description,current_resolution_id,supplemental_urls_json,template_id,template_version,template_hash,fact_type,template_resolution_instructions,raw_json,synced_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38::jsonb,now())
      ON CONFLICT (request_id) DO UPDATE SET requester=EXCLUDED.requester,claim_key=EXCLUDED.claim_key,fact_key=EXCLUDED.fact_key,spec_hash=EXCLUDED.spec_hash,policy_hash=EXCLUDED.policy_hash,policy_id=EXCLUDED.policy_id,policy_version=EXCLUDED.policy_version,assigned_resolver=EXCLUDED.assigned_resolver,created_at=EXCLUDED.created_at,status=EXCLUDED.status,active_attempt_id=EXCLUDED.active_attempt_id,last_attempt_at=EXCLUDED.last_attempt_at,retry_after=EXCLUDED.retry_after,max_attempts=EXCLUDED.max_attempts,attempt_count=EXCLUDED.attempt_count,callback_target=EXCLUDED.callback_target,callback_status=EXCLUDED.callback_status,reuse_mode=EXCLUDED.reuse_mode,fee_paid=EXCLUDED.fee_paid,mutability=EXCLUDED.mutability,schema_version=EXCLUDED.schema_version,ttl_seconds=EXCLUDED.ttl_seconds,seed_urls_json=EXCLUDED.seed_urls_json,subject=EXCLUDED.subject,predicate=EXCLUDED.predicate,object_value=EXCLUDED.object_value,qualifiers=EXCLUDED.qualifiers,temporal=EXCLUDED.temporal,description=EXCLUDED.description,current_resolution_id=EXCLUDED.current_resolution_id,supplemental_urls_json=EXCLUDED.supplemental_urls_json,template_id=EXCLUDED.template_id,template_version=EXCLUDED.template_version,template_hash=EXCLUDED.template_hash,fact_type=EXCLUDED.fact_type,template_resolution_instructions=EXCLUDED.template_resolution_instructions,raw_json=EXCLUDED.raw_json,synced_at=now()`,
      [numeric(r.request_id), r.requester, r.claim_key, r.fact_key, r.spec_hash, r.policy_hash, r.policy_id, r.policy_version, r.assigned_resolver, numeric(r.created_at), r.status, numeric(r.active_attempt_id), numeric(r.last_attempt_at), numeric(r.retry_after), r.max_attempts, r.attempt_count, r.callback_target, r.callback_status, r.reuse_mode, numeric(r.fee_paid), r.mutability, r.schema_version, numeric(r.ttl_seconds), r.seed_urls_json, r.subject, r.predicate, r.object_value, r.qualifiers, r.temporal, r.description, numeric(r.current_resolution_id), r.supplemental_urls_json, r.template_id, r.template_version, r.template_hash, r.fact_type, r.template_resolution_instructions, json(r)]);
  }

  async upsertResolution(resolution: ResolutionRecord, flags: { canonical: boolean; latest: boolean }): Promise<void> {
    const r = resolution;
    await this.pool.query(`INSERT INTO resolutions (resolution_id,request_id,fact_key,resolution_version,attempt_id,claim_key,spec_hash,policy_hash,outcome,diagnostic_reason,policy_satisfied,resolver_version,evidence_manifest_hash,reasoning_summary,evaluated_at,committed_at,valid_until,supersedes_resolution_id,template_id,template_version,template_hash,is_canonical,is_latest,raw_json,synced_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,now())
      ON CONFLICT (resolution_id) DO UPDATE SET request_id=EXCLUDED.request_id,fact_key=EXCLUDED.fact_key,resolution_version=EXCLUDED.resolution_version,attempt_id=EXCLUDED.attempt_id,claim_key=EXCLUDED.claim_key,spec_hash=EXCLUDED.spec_hash,policy_hash=EXCLUDED.policy_hash,outcome=EXCLUDED.outcome,diagnostic_reason=EXCLUDED.diagnostic_reason,policy_satisfied=EXCLUDED.policy_satisfied,resolver_version=EXCLUDED.resolver_version,evidence_manifest_hash=EXCLUDED.evidence_manifest_hash,reasoning_summary=EXCLUDED.reasoning_summary,evaluated_at=EXCLUDED.evaluated_at,committed_at=EXCLUDED.committed_at,valid_until=EXCLUDED.valid_until,supersedes_resolution_id=EXCLUDED.supersedes_resolution_id,template_id=EXCLUDED.template_id,template_version=EXCLUDED.template_version,template_hash=EXCLUDED.template_hash,is_canonical=EXCLUDED.is_canonical,is_latest=EXCLUDED.is_latest,raw_json=EXCLUDED.raw_json,synced_at=now()`,
      [numeric(r.resolution_id), numeric(r.request_id), r.fact_key, r.resolution_version, numeric(r.attempt_id), r.claim_key, r.spec_hash, r.policy_hash, r.outcome, r.diagnostic_reason, r.policy_satisfied, r.resolver_version, r.evidence_manifest_hash, r.reasoning_summary, numeric(r.evaluated_at), numeric(r.committed_at), numeric(r.valid_until), numeric(r.supersedes_resolution_id), r.template_id, r.template_version, r.template_hash, flags.canonical, flags.latest, json(r)]);
  }

  async upsertFact(fact: FactRecord, fresh: boolean): Promise<void> {
    await this.pool.query(`INSERT INTO facts (fact_key,claim_key,policy_hash,schema_version,mutability,canonical_resolution_id,latest_resolution_id,current_request_id,canonical_outcome,resolved_at,valid_until,resolution_version,template_hash,is_fresh,raw_json,observed_at,synced_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,now(),now())
      ON CONFLICT (fact_key) DO UPDATE SET claim_key=EXCLUDED.claim_key,policy_hash=EXCLUDED.policy_hash,schema_version=EXCLUDED.schema_version,mutability=EXCLUDED.mutability,canonical_resolution_id=EXCLUDED.canonical_resolution_id,latest_resolution_id=EXCLUDED.latest_resolution_id,current_request_id=EXCLUDED.current_request_id,canonical_outcome=EXCLUDED.canonical_outcome,resolved_at=EXCLUDED.resolved_at,valid_until=EXCLUDED.valid_until,resolution_version=EXCLUDED.resolution_version,template_hash=EXCLUDED.template_hash,is_fresh=EXCLUDED.is_fresh,raw_json=EXCLUDED.raw_json,observed_at=now(),synced_at=now()`,
      [fact.fact_key, fact.claim_key, fact.policy_hash, fact.schema_version, fact.mutability, numeric(fact.current_resolution_id), numeric(fact.latest_resolution_id), numeric(fact.current_request_id), fact.current_outcome, numeric(fact.resolved_at), numeric(fact.valid_until), fact.resolution_version, fact.template_hash, fresh, json(fact)]);
  }

  async setResolutionFlags(factKey: string, canonicalResolutionId: U256, latestResolutionId: U256): Promise<void> {
    await this.pool.query('UPDATE resolutions SET is_canonical = (resolution_id = $2), is_latest = (resolution_id = $3), synced_at = now() WHERE fact_key = $1', [factKey.toLowerCase(), numeric(canonicalResolutionId), numeric(latestResolutionId)]);
  }

  async listMutableRequestIds(limit: number): Promise<bigint[]> {
    const result = await this.pool.query(`SELECT request_id FROM requests
      WHERE status IN ('PENDING', 'DISPATCHED') OR callback_status IN ('DISPATCHED', 'FAILED_REPORTED')
      ORDER BY request_id DESC LIMIT $1`, [Math.max(0, Math.min(limit, 100))]);
    return result.rows.map((row) => BigInt(String((row as Record<string, unknown>).request_id)));
  }

  async refreshFactFreshness(nowSeconds = BigInt(Math.floor(Date.now() / 1000))): Promise<number> {
    const result = await this.pool.query(`UPDATE facts SET is_fresh = CASE
      WHEN mutability = 'IMMUTABLE' THEN true
      ELSE valid_until > $1
    END
    WHERE is_fresh IS DISTINCT FROM CASE WHEN mutability = 'IMMUTABLE' THEN true ELSE valid_until > $1 END`, [numeric(nowSeconds)]);
    return result.rowCount ?? 0;
  }

  async replaceEvidence(manifest: EvidenceManifestView & { entries: unknown[] }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM evidence WHERE resolution_id = $1', [numeric(manifest.resolution_id)]);
      for (const [ordinal, item] of manifest.entries.entries()) {
        const value = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        await client.query(`INSERT INTO evidence (resolution_id,ordinal,url,canonical,host,status,error,origin,category,provenance_group,source_class,is_primary,is_independent,policy_eligible,evidence_hash,relevant_timestamp,raw_json)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)`,
          [numeric(manifest.resolution_id), ordinal, String(value.url ?? ''), String(value.canonical ?? ''), String(value.host ?? ''), String(value.status ?? ''), value.error ? String(value.error) : null, String(value.origin ?? ''), String(value.category ?? ''), String(value.provenance_group ?? ''), String(value.source_class ?? ''), Boolean(value.is_primary), Boolean(value.is_independent), Boolean(value.policy_eligible), String(value.evidence_hash ?? ''), value.relevant_timestamp ? String(value.relevant_timestamp) : null, json(value)]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async getFact(factKey: string): Promise<ProjectionFact | null> {
    const result = await this.pool.query('SELECT * FROM facts WHERE fact_key = $1', [factKey.toLowerCase()]);
    if (!result.rowCount) return null;
    const row = result.rows[0] as Record<string, unknown>;
    const fact = rowToFact(row);
    const resolutions = await this.pool.query('SELECT * FROM resolutions WHERE fact_key = $1 AND (is_canonical OR is_latest) ORDER BY resolution_version DESC', [factKey.toLowerCase()]);
    const rows = resolutions.rows as Record<string, unknown>[];
    return {
      fact,
      currentRequest: await this.getRequest(fact.current_request_id),
      canonicalResolution: rows.find((item) => Boolean(item.is_canonical)) ? rowToResolution(rows.find((item) => Boolean(item.is_canonical))!) : null,
      latestResolution: rows.find((item) => Boolean(item.is_latest)) ? rowToResolution(rows.find((item) => Boolean(item.is_latest))!) : null,
      fresh: Boolean(row.is_fresh), syncedAt: new Date(String(row.synced_at)).toISOString(), source: 'cache',
    };
  }

  async listFacts(filters: FactFilters): Promise<{ items: ProjectionFact[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown): void => { params.push(value); where.push(`${sql} $${params.length}`); };
    if (filters.outcome) add('canonical_outcome =', filters.outcome);
    if (filters.fresh !== undefined) add('is_fresh =', filters.fresh);
    if (filters.policy) add('policy_hash =', filters.policy);
    if (filters.template) add('template_hash =', filters.template);
    if (filters.mutability) add('mutability =', filters.mutability);
    if (filters.search) { params.push(`%${filters.search}%`); where.push(`(fact_key ILIKE $${params.length} OR claim_key ILIKE $${params.length} OR policy_hash ILIKE $${params.length} OR template_hash ILIKE $${params.length} OR EXISTS (SELECT 1 FROM requests r WHERE r.fact_key = facts.fact_key AND (r.subject ILIKE $${params.length} OR r.predicate ILIKE $${params.length} OR r.object_value ILIKE $${params.length} OR r.description ILIKE $${params.length} OR r.policy_id ILIKE $${params.length} OR r.template_id ILIKE $${params.length})))`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.pool.query(`SELECT count(*)::int AS count FROM facts ${clause}`, params);
    const order = filters.sort === 'request' ? 'current_request_id DESC' : 'resolved_at DESC, fact_key ASC';
    const listParams = [...params, filters.limit, filters.offset];
    const result = await this.pool.query(`SELECT * FROM facts ${clause} ORDER BY ${order} LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, listParams);
    const factRows = result.rows as Record<string, unknown>[];
    const keys = factRows.map((row) => String(row.fact_key));
    const resolutionRows = keys.length === 0 ? [] : (await this.pool.query('SELECT * FROM resolutions WHERE fact_key = ANY($1::text[]) AND (is_canonical OR is_latest) ORDER BY resolution_version DESC', [keys])).rows as Record<string, unknown>[];
    const requestIds = factRows.map((row) => String(row.current_request_id));
    const requestRows = requestIds.length === 0 ? [] : (await this.pool.query('SELECT * FROM requests WHERE request_id = ANY($1::numeric[])', [requestIds])).rows as Record<string, unknown>[];
    const requests = new Map(requestRows.map((row) => [String(row.request_id), rowToRequest(row)]));
    const byFact = new Map<string, Record<string, unknown>[]>();
    for (const row of resolutionRows) {
      const key = String(row.fact_key);
      const current = byFact.get(key) ?? [];
      current.push(row);
      byFact.set(key, current);
    }
    const items: ProjectionFact[] = factRows.map((row) => {
      const rows = byFact.get(String(row.fact_key)) ?? [];
      const canonical = rows.find((item) => Boolean(item.is_canonical));
      const latest = rows.find((item) => Boolean(item.is_latest));
      return {
        fact: rowToFact(row),
        currentRequest: requests.get(String(row.current_request_id)) ?? null,
        canonicalResolution: canonical ? rowToResolution(canonical) : null,
        latestResolution: latest ? rowToResolution(latest) : null,
        fresh: Boolean(row.is_fresh), syncedAt: new Date(String(row.synced_at)).toISOString(), source: 'cache',
      };
    });
    return { items, total: Number((count.rows[0] as { count: number }).count) };
  }

  async getRequest(requestId: U256): Promise<RequestRecord | null> { const r = await this.pool.query('SELECT * FROM requests WHERE request_id = $1', [numeric(requestId)]); return r.rowCount ? rowToRequest(r.rows[0] as Record<string, unknown>) : null; }
  async getResolution(resolutionId: U256): Promise<ResolutionRecord | null> { const r = await this.pool.query('SELECT * FROM resolutions WHERE resolution_id = $1', [numeric(resolutionId)]); return r.rowCount ? rowToResolution(r.rows[0] as Record<string, unknown>) : null; }
  async getEvidence(resolutionId: U256): Promise<unknown[]> { const r = await this.pool.query('SELECT raw_json FROM evidence WHERE resolution_id = $1 ORDER BY ordinal', [numeric(resolutionId)]); return r.rows.map((row) => parseRaw(row as Record<string, unknown>)); }
  async listResolutions(factKey: string, offset: number, limit: number): Promise<{ items: ResolutionRecord[]; total: number }> { const count = await this.pool.query('SELECT count(*)::int AS count FROM resolutions WHERE fact_key = $1', [factKey.toLowerCase()]); const r = await this.pool.query('SELECT * FROM resolutions WHERE fact_key = $1 ORDER BY resolution_version DESC LIMIT $2 OFFSET $3', [factKey.toLowerCase(), limit, offset]); return { items: (r.rows as Record<string, unknown>[]).map(rowToResolution), total: Number((count.rows[0] as { count: number }).count) }; }
  async listPolicies(offset: number, limit: number): Promise<{ items: unknown[]; total: number }> { const count = await this.pool.query('SELECT count(*)::int AS count FROM policies'); const r = await this.pool.query('SELECT raw_json FROM policies ORDER BY policy_id,version LIMIT $1 OFFSET $2', [limit, offset]); return { items: r.rows.map((row) => parseRaw(row as Record<string, unknown>)), total: Number((count.rows[0] as { count: number }).count) }; }
  async getPolicy(policyId: string, version: number): Promise<unknown | null> { const r = await this.pool.query('SELECT raw_json FROM policies WHERE policy_id=$1 AND version=$2', [policyId, version]); return r.rowCount ? parseRaw(r.rows[0] as Record<string, unknown>) : null; }
  async listTemplates(offset: number, limit: number): Promise<{ items: unknown[]; total: number }> { const count = await this.pool.query('SELECT count(*)::int AS count FROM templates'); const r = await this.pool.query('SELECT raw_json FROM templates ORDER BY template_id,version LIMIT $1 OFFSET $2', [limit, offset]); return { items: r.rows.map((row) => parseRaw(row as Record<string, unknown>)), total: Number((count.rows[0] as { count: number }).count) }; }
  async getTemplate(templateId: string, version: number): Promise<unknown | null> { const r = await this.pool.query('SELECT raw_json FROM templates WHERE template_id=$1 AND version=$2', [templateId, version]); return r.rowCount ? parseRaw(r.rows[0] as Record<string, unknown>) : null; }

  async getStats(): Promise<Record<string, unknown>> { const [facts, requests, resolutions, policies, templates] = await Promise.all([this.pool.query('SELECT count(*)::int AS count FROM facts'), this.pool.query('SELECT count(*)::int AS count FROM requests'), this.pool.query('SELECT count(*)::int AS count FROM resolutions'), this.pool.query('SELECT count(*)::int AS count FROM policies'), this.pool.query('SELECT count(*)::int AS count FROM templates')]); return { facts: Number(facts.rows[0].count), requests: Number(requests.rows[0].count), resolutions: Number(resolutions.rows[0].count), policies: Number(policies.rows[0].count), templates: Number(templates.rows[0].count) }; }

  async listActivity(offset: number, limit: number): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const count = await this.pool.query('SELECT (SELECT count(*) FROM requests) + (SELECT count(*) FROM resolutions) AS count');
    const result = await this.pool.query(`
      SELECT activity_type, activity_id, occurred_at, fact_key, request_id, resolution_id, status, outcome
      FROM (
        SELECT 'request_created' AS activity_type, request_id::text AS activity_id, created_at::text AS occurred_at, fact_key, request_id::text AS request_id, NULL::text AS resolution_id, status, NULL::text AS outcome
        FROM requests
        UNION ALL
        SELECT 'resolution_committed', resolution_id::text, committed_at::text, fact_key, request_id::text, resolution_id::text, NULL, outcome
        FROM resolutions
      ) activity
      ORDER BY occurred_at::numeric DESC, activity_id::numeric DESC
      LIMIT $1 OFFSET $2`, [limit, offset]);
    return { items: result.rows as Array<Record<string, unknown>>, total: Number((count.rows[0] as { count: string }).count) };
  }

  async getProtocolState(): Promise<Record<string, unknown> | null> { const r = await this.pool.query('SELECT * FROM protocol_state WHERE chain_id = 61997'); return r.rowCount ? r.rows[0] as Record<string, unknown> : null; }
  async getSyncStatus(): Promise<ProjectionStatus> {
    const r = await this.pool.query('SELECT * FROM sync_state WHERE id=true');
    if (!r.rowCount) return { lastFinalizedAt: null, lastSuccessAt: null, lastAttemptAt: null, lastError: null, status: 'unknown', observedEventCounts: {}, updatedAt: null, lastRequestId: 0n, lastResolutionId: 0n, lastProtocolConfigCheckAt: null };
    const row = r.rows[0] as Record<string, unknown>;
    return {
      lastFinalizedAt: row.last_finalized_at ? new Date(String(row.last_finalized_at)).toISOString() : null,
      lastSuccessAt: row.last_success_at ? new Date(String(row.last_success_at)).toISOString() : null,
      lastAttemptAt: row.last_attempt_at ? new Date(String(row.last_attempt_at)).toISOString() : null,
      lastError: row.last_error ? String(row.last_error) : null,
      status: String(row.status),
      observedEventCounts: (row.observed_event_counts as Record<string, string>) ?? {},
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
      lastRequestId: row.last_request_id === undefined || row.last_request_id === null ? 0n : BigInt(String(row.last_request_id)),
      lastResolutionId: row.last_resolution_id === undefined || row.last_resolution_id === null ? 0n : BigInt(String(row.last_resolution_id)),
      lastProtocolConfigCheckAt: row.last_protocol_config_check_at ? new Date(String(row.last_protocol_config_check_at)).toISOString() : null,
    };
  }

  async setSyncStatus(status: Partial<ProjectionStatus>): Promise<void> {
    await this.pool.query(`UPDATE sync_state SET
      last_finalized_at=COALESCE($1,last_finalized_at),
      last_success_at=COALESCE($2,last_success_at),
      last_attempt_at=COALESCE($3,last_attempt_at),
      last_error=$4,
      status=COALESCE($5,status),
      observed_event_counts=COALESCE($6::jsonb,observed_event_counts),
      last_request_id=COALESCE($7,last_request_id),
      last_resolution_id=COALESCE($8,last_resolution_id),
      last_protocol_config_check_at=COALESCE($9,last_protocol_config_check_at),
      updated_at=now() WHERE id=true`, [
      status.lastFinalizedAt ?? null,
      status.lastSuccessAt ?? null,
      status.lastAttemptAt ?? null,
      status.lastError ?? null,
      status.status ?? null,
      status.observedEventCounts ? json(status.observedEventCounts) : null,
      status.lastRequestId === undefined ? null : numeric(status.lastRequestId),
      status.lastResolutionId === undefined ? null : numeric(status.lastResolutionId),
      status.lastProtocolConfigCheckAt === undefined ? null : status.lastProtocolConfigCheckAt,
    ]);
  }
}
