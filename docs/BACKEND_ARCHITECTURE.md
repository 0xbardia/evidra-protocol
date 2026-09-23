# Evidra Phase 1 Backend Architecture

Phase 1 is read-only infrastructure around the frozen GenLayer Studio Dev V1 deployment. The chain is canonical; PostgreSQL is a disposable projection used for list views, search, pagination, and diagnostics.

## Boundaries

```text
Studio Dev 61997 (canonical)
        |
  @evidra/protocol
        |
  finalized reconciler  ---> PostgreSQL projection/cache/search index
        |                                  |
        +------------------------------> Fastify /api/v1
```

- `packages/protocol` is the only application-facing contract integration layer. It centralizes the frozen network, addresses, 64 view wrappers, latest-final reads, normalization, error classification, pagination, and explorer links.
- `packages/config` validates the frozen chain, RPC URL, and addresses at startup.
- `packages/db` owns migrations and rebuildable projection repositories.
- `apps/api` owns the polling indexer, reconciliation status, and public read API.
- `contracts/` remains outside the build graph and is unchanged.

## Read consistency

The client requests `latest-final` by default. It probes that mode once and only falls back to `latest-nonfinal` when the SDK/RPC explicitly rejects the variant; the selected mode is exposed in readiness and read metadata. Product-facing canonical state should use the projection only when its sync timestamp is acceptable. `GET /facts/:factKey?source=chain` bypasses the projection and reads the fact and canonical/latest resolutions from the chain.

The API never treats a latest unresolved attempt as canonical truth. Responses contain separate `canonical_resolution` and `latest_resolution` objects.

## Data flow

1. Startup validates configuration, connects to PostgreSQL, and applies ordered migrations.
2. The indexer verifies chain 61997 and all frozen contract relationships.
3. It reads finalized policy/template events, hydrates the referenced immutable versions, enumerates bounded request/resolution counters, and hydrates facts, canonical/latest resolutions, and evidence manifests.
4. Upserts are idempotent. Resolution rows are never deleted or overwritten by a newer version; canonical/latest flags are refreshed from the on-chain fact record.
5. The API serves bounded, parameterized projection queries and exposes sync/finality metadata.

## No-write posture

The Phase 1 client exposes only read operations. There are no wallet, private-key, mutation, admin, or arbitrary evidence-fetching paths in the API. The `transactions` table is reserved for future explicitly authorized write phases and does not cause chain activity in this phase.

## Known reconstruction limit

The contract exposes event pages and aggregate request/resolution counters, but no policy/template ID enumerators. Bootstrap discovers policy/template versions from finalized policy-registry events. If a deployment prunes events or an event is unavailable, the projection cannot invent that historical version; the reconciler reports the chain-backed state it can prove.

## Runtime operations

```bash
pnpm install
DATABASE_URL=... pnpm db:migrate
pnpm build
pnpm test
pnpm lint
pnpm dev
```

The default production process binds to `127.0.0.1`; reverse proxy/domain configuration is intentionally deferred.
