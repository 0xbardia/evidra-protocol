# Evidra Phase 1 — Backend & Read Infrastructure Certification

This report records the final local and Studio Dev read-only checks completed on 2026-09-21.

## Scope

Implemented: shared TypeScript protocol client, frozen configuration validation, PostgreSQL projection/migrations, finalized polling indexer/reconciler, normalized read API, rate-limit/backoff handling, health/readiness, tests, and backend documentation.

Not implemented: frontend, wallet UX, mutation/admin routes, contract changes, redeployment, public-domain/nginx configuration, and arbitrary evidence fetching.

## Contract integrity

No contract source was edited and no chain write was issued. Final source hashes:

```text
evidra_consumer_probe.py  8af3b940e978b76c1affab807822a8db388a8c676d14801d5ffed55538bcbc36
evidra_policy_registry.py df2f946f2d265cb8fd8d04012c5eb2beeab1830f60d5146a7761cb35279be247
evidra_registry.py        1b3a97ec340ad30c381404fecb76d3e4656d48dd550c2fdf02d4a7c2a50af8f7
evidra_resolver.py        3c9007bd1414227193b4459d96fb565e42e0b712661d802caa9477dd91a30bfe
```

## Architecture and client

The monorepo contains `packages/protocol`, `packages/config`, `packages/db`, and `apps/api`. The protocol package wraps all 64 public views across the four frozen addresses, defaults to `latest-final`, preserves the selected read mode, normalizes IC-to-IC records/JSON-string pages/evidence aliases, bounds inputs, and centralizes explorer links and error handling.

## Database and indexer

Ordered PostgreSQL migrations cover protocol state, sync state, policies, templates, facts, requests, immutable resolutions, evidence, and future transaction records. The finalized polling indexer is bounded, idempotent, restart-safe, and uses rate-limit-aware retry/backoff. Empty-database bootstrap projected 3 requests, 3 resolutions, 2 facts, 3 policies, and 2 templates in 87.7 seconds.

## API

The Fastify API exposes 16 read/diagnostic route patterns under `/api/v1`: health, readiness, network, protocol, facts/list/detail/history, resolutions/detail/evidence, requests, policies/list/detail, templates/list/detail, activity, and stats. All result pages are bounded to 50. There are no mutation/admin routes.

## Security

Startup configuration rejects wrong chain/RPC/addresses. The service uses Zod validation, parameterized SQL, Helmet, explicit CORS, rate limiting, request IDs, bounded bodies, DB/RPC timeouts, structured logs, graceful shutdown, and no arbitrary server-side evidence fetch. Canonical/latest/freshness/cache-age are separate fields.

## Canonical boundary

The four frozen contracts on Studio Dev chain 61997 remain canonical. PostgreSQL is rebuildable and is never allowed to redefine fact identity, outcome, policy satisfaction, canonical resolution, latest resolution, template semantics, or freshness.

## Certification records

- Source-hash verification: the four post-SSRF hashes remain unchanged.
- Local suite: 13 tests, 13 passed, 0 failed, 0 skipped, across five test files, using the dedicated PostgreSQL integration database.
- Static quality: `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass.
- Live read-only views: 64/64 unique views passed with `latest-final` on `https://studio-dev.genlayer.com/api`, chain 61997, using the final frozen addresses, in `artifacts/evidra/phase1_read_certification.json`.
- Indexer bootstrap: 87.7 seconds; 3 requests, 3 resolutions, 2 facts, 3 policies, and 2 templates projected from finalized reads.
- Local API smoke: health, facts pagination/filtering, stats, evidence normalization, and readiness passed; readiness confirmed chain 61997 and `latest-final`.
- No chain writes were issued by Phase 1.

## Build quality and performance

- `pnpm build`: PASS
- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm test`: 13/13 PASS, 0 FAIL, 0 SKIP
- Local fact-list projection query: bounded page with a single resolution-batch query (no per-fact RPC waterfall)
- Local API health/facts/stats: sub-second in smoke testing
- Readiness chain verification: approximately 10 seconds under the conservative RPC interval
- Finalized indexer bootstrap: 87.7 seconds under a 3-second RPC interval and 1-request concurrency

## Documentation

`docs/BACKEND_ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`, `docs/INDEXER.md`, `docs/API.md`, `docs/PHASE1_SECURITY.md`, `docs/PHASE1_PROTOCOL_READ_CERTIFICATION.md`, and this report are included.

## Limitations

Historical discovery is bounded by contract-exposed counters/events. Studio Dev rate limits require conservative polling and can make bootstrap slow. Evidence URLs are not fetched by the backend. Public deployment and frontend integration are intentionally deferred.

## Gate

PHASE 1 GATE: PASS

BACKEND READ INFRASTRUCTURE READY.
SAFE TO BEGIN PHASE 2 FRONTEND + WALLET + WRITES.
