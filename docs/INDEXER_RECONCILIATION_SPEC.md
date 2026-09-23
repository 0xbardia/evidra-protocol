# Evidra Protocol V1 — Indexer and Reconciliation Specification

This is a design handoff for a correctness-first indexer. It does not implement the indexer.

## Verified RPC constraints

- Frozen endpoint: `https://studio-dev.genlayer.com/api`.
- Frozen chain: `61997`.
- Finalized reads work with GenLayer SDK `LATEST_FINAL`.
- Studio Dev returned `Rate limit exceeded: 30 requests per minute` during the audit. Treat 30/min as a measured lower-bound operational constraint, not a guaranteed quota.
- No websocket/event subscription capability was verified for this deployment. Design around paged reads and transaction polling.
- Event pages accept `limit` 1–50; larger limits revert `INVALID_PAGINATION`.

## Bootstrap

1. Assert RPC chain ID and frozen address set.
2. Read finalized versions and relationship/configuration views.
3. Read policy registry event pages from offset 0. Parse `PolicyPublished`, `PolicyDeprecated`, `TemplatePublished`, and `TemplateDeprecated` payloads.
4. Hydrate each exact policy/template ID/version. Never replace a historical version with `get_latest_*`.
5. Read registry stats and event pages. Parse request/fact/resolution/callback topics to discover IDs and fact keys.
6. Enumerate request IDs from 1 through `request_count` and resolution IDs from 1 through `resolution_count`; missing IDs are represented as gaps, not fabricated records.
7. For every discovered request, read `get_request`; for every discovered fact key, read `get_fact`.
8. For every fact, page `get_resolution_history`, hydrate each resolution and evidence manifest.
9. Persist `sync_state` only after a complete finalized pass and record the observation timestamp.

The contracts do not expose a fact-key iterator. Event payloads/request records are therefore required for fact discovery. A DB rebuild must preserve this discovery path.

## Incremental sync

For each contract:

- read finalized event count;
- read pages from the last confirmed offset using a page size no greater than 50;
- parse events as hints, then hydrate affected IDs/keys from direct reads;
- re-read the event count and tail page before committing the new offset;
- if count moved during the pass, leave a small overlap (for example 5 events) and deduplicate by `(contract,index)`;
- periodically run a bounded full counter reconciliation for all known IDs.

Event payloads are not canonical records. A malformed or missing event must trigger direct re-enumeration rather than a guessed projection.

## Canonical/latest reconciliation

For each affected fact, read `get_fact`, `get_current_resolution`, `get_latest_resolution`, paged `get_resolution_history`, and `get_evidence_manifest` for every referenced resolution.

Rules:

- `FactRecord.current_resolution_id` defines canonical truth.
- `FactRecord.latest_resolution_id` defines the newest committed attempt.
- `ResolutionRecord.supersedes_resolution_id` links history order and is not a canonical pointer.
- Never infer canonical advancement from resolution version, timestamp, or outcome alone.
- If the DB canonical pointer differs from chain, mark a mismatch, re-read with `LATEST_FINAL`, and replace the projection from chain.
- If the pointer references a missing resolution, keep the fact in an error/mismatch state and alert; do not fall back to latest.

## Transaction reconciliation

Persist transaction IDs immediately after submission. Poll stored transaction state, require successful execution at finalization, follow triggered child transaction IDs when available, and hydrate request/fact state only after the relevant child’s successful finalization.

On process restart, resume by transaction ID. A timeout or 502 after submit is an unknown state, never authorization to submit again.

## Rate limiting and retries

Implement a single bounded RPC scheduler per process:

- token bucket at or below 20–25 calls/minute initially, leaving headroom below the measured 30/minute limit;
- concurrency 1–2 for finalized reads;
- exponential backoff for 429/502/503/timeouts, with jitter and a finite attempt ceiling;
- no retry for deterministic contract errors (`INVALID_PAGINATION`, `UNKNOWN_FACT`, `NOT_OWNER`, etc.);
- circuit-break after repeated rate limits and expose lag in health status;
- batch only if the endpoint is verified to count and decode batched requests correctly; do not assume JSON-RPC batch support.

The scheduler must bound response bytes and parse cost, especially for `manifest_json`, event payloads, and history pages.

## Restart and DB rebuild

`sync_state` should store contract address, source hash/identity, chain ID, event offset, observed event count, last finalized read time, and a rebuild generation. On restart: validate deployment identity, resume from an overlap offset, reconcile counters and known IDs, mark unresolved jobs for rehydration, and expose projection lag until the pass completes.

A full DB rebuild must not require the old DB. It may use a temporary staging schema, then swap projections after counts/pointers match.

## Mismatch handling

Classify `MISSING_EVENT` (record exists but event was absent), `MISSING_RECORD` (event references a record not yet visible), `POINTER_MISMATCH`, `HASH_MISMATCH`, `CONFIG_MISMATCH`, and `NONFINAL_OBSERVATION`. Retry temporary cases, alert on persistent cases, and do not mutate chain state. Persist raw observations for debugging while redacting secrets and prompt content.

## Polling cadence

Use adaptive starting values: active transaction/request 5–15 seconds with backoff; normal event sync 30–120 seconds; full reconciliation hourly or operator-triggered; after a rate-limit response, pause the queue and surface lag. Measure Studio Dev before increasing any cadence.
