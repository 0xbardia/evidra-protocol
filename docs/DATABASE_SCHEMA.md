# Evidra Projection Database

PostgreSQL is a rebuildable cache/index. Losing it is not protocol-data loss: the indexer reconstructs reachable state from finalized contract reads and retained event pages.

## Tables

| Table | Primary key | Purpose |
| --- | --- | --- |
| `protocol_state` | `chain_id` | Latest verified deployment/config/stats snapshot. |
| `sync_state` | singleton `id=true` | Checkpoint, status, event counts, and lag diagnostics. |
| `policies` | `(policy_id, version)` | Immutable source-policy versions. |
| `templates` | `(template_id, version)` | Immutable template versions. |
| `facts` | `fact_key` | Current fact projection and canonical/latest IDs. |
| `requests` | `request_id` | Exact request lifecycle projection. |
| `resolutions` | `resolution_id` | Append-preserving resolution history, including canonical/latest flags. |
| `evidence` | `(resolution_id, ordinal)` | Normalized manifest entries linked to a resolution. |
| `transactions` | `tx_id` | Future write-phase lifecycle records; no Phase 1 API writes them. |

All u256 values are stored as `numeric(78,0)` and serialized by the API as decimal strings. Raw chain records are retained in `jsonb` where useful. Queries use PostgreSQL parameters; no string-built user SQL is used.

## Relationships

- `requests.fact_key` points to `facts.fact_key` logically; it is not a database foreign key because an unresolved request may not yet have a fact record.
- `resolutions.fact_key` points to `facts.fact_key` logically.
- `evidence.resolution_id` references `resolutions.resolution_id` with cascade on projection deletion.
- `facts.canonical_resolution_id` and `facts.latest_resolution_id` are chain-derived pointers, not independently selected by the database.

## Reconciliation rules

- Chain reads win over cached values.
- A resolution ID is upserted by identity; historical rows are not collapsed into the latest row.
- Canonical/latest flags are recomputed from the fact record on each hydration.
- `is_fresh` is refreshed from `is_fact_fresh`; it is not treated as permanent and must be refreshed as time advances.
- New policies/templates are inserted by exact `(id, version)` identity. “Latest” is never used as a replacement for historical versions.

## Migration and recovery

Migrations are in `packages/db/migrations` and recorded in `schema_migrations`. To rebuild, create an empty database, run `pnpm db:migrate`, then start the indexer. The current implementation deliberately bounds enumeration using `INDEXER_MAX_RECORDS`; deployments larger than that require an operational backfill plan rather than an unbounded startup query.
