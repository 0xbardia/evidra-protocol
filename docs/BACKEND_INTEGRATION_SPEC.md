# Evidra Protocol V1 — Backend Integration Specification

This is a Phase 1 design handoff. It does not implement the backend.

## Boundary

The backend is a read/index/reconciliation service plus a transaction-tracking API. It is not the owner of Fact truth and must never invent a verdict. On-chain `EvidraRegistry` state is canonical; PostgreSQL is a rebuildable projection.

```text
Studio Dev RPC (LATEST_FINAL where supported; finalized-receipt fallback is documented)
        ↓
chain reader → finalized reconciler → PostgreSQL projection → API/search
        ↑                                              ↓
transaction tracker ← wallet-submitted tx IDs       frontend
```

The backend must not hold user wallet secrets or impersonate a user. User-initiated contract writes are signed by the user wallet. Resolver/operator writes are outside the public app role and must not be exposed as generic API actions.

## Responsibilities

### Chain reader

- Use only the frozen Studio Dev endpoint and chain ID `61997`.
- Use the GenLayer RC SDK/read encoding compatible with this deployment. Certification used `genlayer-js` `2.0.0-rc.1` with the GenLayer CLI `0.40.0-rc.3`; the stable 1.x client did not decode these contract calls correctly.
- Normalize `addr#...` and `0x...` addresses to lowercase `0x` internally.
- Decode dataclass returns and parse JSON-in-string fields with schema validation.
- Treat RPC results as untrusted input: bound response size, reject malformed JSON, and preserve raw values for operator diagnosis.

### Finalized-state reconciler

- Never promote a non-final or failed execution to canonical DB state.
- Read the transaction status and execution result first; then perform `latest-final` contract reads.
- Re-read the affected request, fact, current/latest resolution, and manifest after triggered child transactions.
- Make reconciliation idempotent: upsert by chain identity, never append duplicate resolution rows.
- Mark projection mismatches and re-query; do not “repair” on-chain truth from the DB.

### Indexer

- Bootstrap policy/template and registry event pages.
- Discover request IDs/fact keys from event payloads and enumerate request/resolution IDs from protocol stats.
- Hydrate complete records with direct reads; event payloads are discovery hints, not full record truth.
- Maintain history by reading `get_resolution_history` pages and then `get_resolution` for each ID.
- Index the evidence manifest as normalized entries plus the original manifest JSON/hash.

### PostgreSQL cache/index

- Store complete chain-derived records and raw JSON.
- Store derived booleans such as `is_canonical` only as projections with the source pointer and reconciliation timestamp.
- Keep UI metadata, full-text search vectors, display labels, and analytics separate from chain truth.
- Support a full rebuild from chain data. No table is the only copy of a protocol fact.

### Public API

Recommended read endpoints:

```text
GET  /v1/health
GET  /v1/status
GET  /v1/policies
GET  /v1/policies/:id/:version
GET  /v1/templates
GET  /v1/templates/:id/:version
GET  /v1/facts/:factKey
GET  /v1/facts/:factKey/history
GET  /v1/facts/:factKey/evidence/:resolutionId
GET  /v1/requests/:requestId
GET  /v1/activity
GET  /v1/search?q=...
GET  /v1/transactions/:txId
```

Write-adjacent endpoints should only register a client intent or transaction ID, for example `POST /v1/transactions/track`; they must not sign or submit a user wallet transaction on the user’s behalf. All public API responses should carry `chainId`, `contractAddress`, `observedAt`, `finalizedRead=true`, and a projection version.

### Health/status

Expose:

- configured chain/RPC identity and a hard failure if it differs from `61997`/the frozen URL;
- last successful finalized read per contract;
- last event offsets and protocol counters;
- RPC error/rate-limit/backoff state;
- DB projection lag and mismatch count;
- current registry pause/default resolver/policy registry configuration;
- indexer rebuild/sync mode.

Do not expose wallet keys, RPC credentials, internal prompt content, or raw resolver exceptions publicly.

## Canonical data rules

The backend must recover these from the chain:

- facts and their `current_resolution_id`/`latest_resolution_id` pointers;
- requests, attempt IDs, statuses, requester, fee, callback state, and snapshots;
- every resolution and its canonical/latest relationship;
- policy/template records and hashes;
- evidence manifest JSON and manifest hash;
- policy registry and resolver configuration;
- policy fee/limit configuration and event pages.

Historical policy/template snapshots are part of the chain-derived record. A newer active version must never replace the version/hash stored on an existing request, resolution, or fact. Conversely, `refresh_fact` and `request_reassessment` rebuild a request through the Registry’s active-policy check; deprecating the historical policy can therefore make those future operations fail with `POLICY_INACTIVE`. Surface that as protocol configuration state, not as a DB corruption or transient RPC error.

The DB may safely hold only as projection/metadata:

- search indexes and tokenization;
- UI-friendly labels and route slugs;
- cached source host display data;
- analytics and latency metrics;
- transaction polling timestamps and client operation keys;
- moderation/visibility metadata, if clearly marked non-canonical.

Never calculate `TRUE`/`FALSE` from evidence, reasoning, or a private heuristic. Read `FactRecord.current_outcome` and the pointed current resolution. A latest unresolved attempt does not automatically replace an older canonical boolean.

## Conceptual schema

All tables include `chain_id=61997`, `observed_at`, `finalized_at` where applicable, and `raw_json` or an equivalent lossless representation.

| Entity | Primary key | Chain identity and relationships | Canonical nature | Reconciliation |
|---|---|---|---|---|
| `facts` | `fact_key` | `claim_key`, policy hash, schema, template hash; points to current/latest resolution and current request | Canonical projection of `FactRecord` | Replace fields from `get_fact`; compare current/latest pointers and outcome exactly |
| `requests` | `request_id` | requester, fact key, assigned resolver; has current resolution ID and callback target | Canonical | Upsert `get_request`; status and attempt must match finalized read |
| `resolutions` | `resolution_id` | request ID, fact key, supersedes ID; belongs to a fact history | Canonical | Never delete/update identity; upsert immutable payload and verify fact pointers |
| `evidence` | `(resolution_id, ordinal)` | one row per parsed manifest entry; parent resolution | Canonical manifest projection; normalized fields retain raw manifest | Recompute manifest JSON/hash from canonical raw JSON and flag mismatch |
| `policies` | `(policy_id, version)` | policy hash; referenced by requests/resolutions | Canonical | Discover from policy events, then read exact version; never replace stored snapshot with latest |
| `templates` | `(template_id, version)` | template hash; referenced by request/resolution/fact hash | Canonical | Same historical-version rule as policies |
| `transactions` | `tx_id` | chain transaction; optional parent/triggered IDs and operation key | Operational projection, not protocol truth | Poll by ID; only successful finalized transactions trigger chain hydration |
| `sync_state` | `contract_address` | event offset/count, last successful read, schema/source hash | Operational | Rebuildable; reset on mismatch or deployment identity change |

Recommended indexes:

- `facts(claim_key)`, `facts(current_outcome)`, `facts(valid_until)`, `facts(updated_at)`;
- `requests(status)`, `requests(requester)`, `requests(fact_key)`, `requests(created_at)`;
- `resolutions(fact_key, resolution_id)`, `resolutions(request_id)`, `resolutions(outcome)`;
- `evidence(source_class)`, `evidence(provenance_group)`, `evidence(url_hash)`;
- immutable composite indexes for policy/template hashes;
- full-text/search index only on denormalized claim fields and metadata.

## Fact projection rules

For each fact:

1. Read `get_fact(fact_key)`.
2. Read `get_current_resolution(fact_key)` by the current pointer.
3. Read `get_latest_resolution(fact_key)` by the latest pointer.
4. Mark `current_resolution.is_canonical=true` only when its ID equals `FactRecord.current_resolution_id`.
5. Mark latest separately; it is not canonical merely because it is newest.
6. Read history pages with `limit<=50`; hydrate each resolution ID.
7. Read a manifest for each resolution that has one.
8. Compute freshness only by `is_fact_fresh(fact_key)` or exact V1 rules; do not use HTTP cache age or DB timestamp as protocol freshness.

## Search and pagination

Search is DB-backed and can be stale. Every search result should expose `projectionObservedAt` and link to a refresh/reconciliation state. Detail pages should perform a finalized chain read when freshness/canonical correctness matters.

Contract pagination is offset-based with `limit` from 1 through 50. The backend must cap public API page sizes, use stable ordering by chain IDs/timestamps, and tolerate new events between pages by reconciling event counts and re-reading the tail.

## Fees and credits

The live V1 protocol surcharge is zero. Network execution/consensus fees are separate and can still require a fee deposit. The backend may display a fee estimate but must label it:

- protocol value (`msg.value` expected by the registry);
- GenLayer network/consensus fee estimate;
- total wallet requirement.

Do not claim “free” solely because `fee_base`, `fee_per_attempt`, and `fee_reuse` are zero. Credit balances are chain state; use `get_credit(account)` and never infer a refund from a failed client request.

## Resolver and callback operations

The backend may read resolver capabilities/configuration. It must not call `resolve_request` or `commit_resolution`; those are contract-to-contract lifecycle methods. It must not call `mark_callback_result` as a substitute for the real callback target. It may track callback states and present `DISPATCHED`, `ACKNOWLEDGED`, and `FAILED_REPORTED` distinctly.

Because V1 does not enforce a dispatched-before-acknowledged callback transition, the projection should record callback events and state changes in order and never infer successful delivery from `ACKNOWLEDGED` alone (LOW-002).

## Phase 1 acceptance checks

- `contracts/` is unchanged.
- all reads use `LATEST_FINAL` and chain/address assertions;
- a DB rebuild from empty reaches the same facts/resolutions/policies/templates as direct reads;
- a latest unresolved resolution does not overwrite canonical UI fields;
- malformed/oversized JSON and 429/502 responses are bounded and retried safely;
- transaction tracking survives process restart and never duplicates a write after an unknown timeout;
- HIGH-001 is closed for direct contract-level URL ingress. Keep the strict app URL preflight and treat GenVM DNS/redirect filtering as a required runtime security dependency. Phase 0 is certified PASS using the independent reconstructed suite; implementation remains a separate Phase 1 task.
