# Evidra Protocol

Evidra records claims that cannot be established by a conventional data feed as versioned, policy-bound resolutions. It preserves the claim, evidence provenance, source policy, canonical result, later attempts, and freshness state so an application can inspect why a result exists and whether it is still valid.

- Public application: <https://evidra-protocol.bydx.fun>
- Documentation: <https://evidra-protocol.bydx.fun/docs>
- Network: GenLayer Studio Dev, chain ID `61997`

## What it does

An API can report a price or a database field. It cannot necessarily establish a semantic claim such as whether a product shipped, a milestone was met, or a rule changed. Evidra accepts an explicit fact specification and bounded evidence URLs, evaluates the evidence against a versioned source policy through GenLayer consensus, then records the resulting resolution in the Registry.

Evidence is metadata, not a vote: source classes, provenance groups, independence, and policy eligibility are recorded separately. The application does not fetch or render evidence pages on its server.

## Protocol lifecycle

1. Specify a claim using subject, predicate, optional object value, qualifiers, and time scope.
2. Select an exact template and its bound policy, or choose a source policy directly.
3. Choose immutable validity or a positive TTL for a mutable fact and provide HTTPS evidence URLs.
4. Review the request and approve it with a wallet on Studio Dev.
5. GenLayer validators evaluate the request; finalized protocol state is written to the Registry.
6. The indexer projects finalized state into PostgreSQL for search and the public read API.

The wallet transaction, consensus decision, finalization, and appearance in the indexed read model are separate events. A delayed index is not a reason to resubmit an already-finalized transaction.

## Canonical result and latest attempt

The Fact record's `current_resolution_id` identifies the canonical resolution. `latest_resolution_id` identifies the newest committed attempt. A newer unresolved attempt does not replace an existing canonical `TRUE` or `FALSE` unless the Registry advances the canonical head. Clients should display these values separately and use the Fact's freshness state for validity; age alone is not confidence.

Immutable facts have no expiry. Mutable facts are fresh only while their contract validity period has not elapsed. A stale Fact retains its historical resolution and provenance.

## Frozen V1 deployment

Contracts are frozen for this release. Application and documentation changes must not edit `contracts/` or trigger a redeployment.

| Contract | Address |
| --- | --- |
| PolicyRegistry | `0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71` |
| Registry | `0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6` |
| Resolver | `0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477` |
| ConsumerProbe | `0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F` |

The authoritative source hashes are verified by `pnpm verify:contracts` and recorded in [`docs/DEPLOYMENT_RECORD.md`](docs/DEPLOYMENT_RECORD.md).

## Architecture

- `apps/web` — Next.js application, public landing and documentation, Fact registry/detail, and browser-wallet writes.
- `apps/api` — Fastify read API, cached health/readiness, and incremental chain indexer.
- `packages/protocol` — typed GenLayer client, frozen deployment constants, serialization, and shared RPC scheduler.
- `packages/db` — PostgreSQL schema, migrations, checkpoints, and projection repository.
- `packages/config` — validated server configuration.
- `contracts` — deployed GenLayer Intelligent Contracts; frozen for V1.
- `docs` — protocol, security, operations, architecture, and release records.

PostgreSQL is a rebuildable projection, not the authority for contract state. The API serves indexed data and bounded direct reads; the frontend never receives server credentials or a server-side signing wallet.

## Local development

Requirements: Node.js 20+, pnpm 9, and PostgreSQL.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
# Set DATABASE_URL to a PostgreSQL database you control.
pnpm db:migrate
pnpm dev:all
```

The API listens on port `3000` by default. Next.js selects the next available port if that port is occupied. The web example points browser reads at the local API. `API_INTERNAL_URL` is used by server-rendered Fact metadata, the sitemap, and the Fact existence check that returns a real HTTP 404; it should point to the local read API. Public network and contract values in the examples are not credentials. Never put a wallet private key in this project.

## API and database

The public API is versioned under `/api/v1`. Common read routes include:

- `GET /api/v1/health` and `GET /api/v1/ready`
- `GET /api/v1/network`, `/protocol`, and `/stats`
- `GET /api/v1/facts` and `/api/v1/facts/:factKey`
- `GET /api/v1/requests/:requestId`, `/resolutions/:resolutionId`, and resolution evidence
- `GET /api/v1/policies`, `/templates`, and `/activity`

List endpoints use bounded `limit` and `offset` pagination. Fact search and filters are applied to the indexed projection. `source=chain` requests a bounded latest-final read; it is subject to the hosted RPC's availability and quota. Database migrations are in `packages/db/migrations` and run through `pnpm db:migrate`.

## RPC budget and indexer behavior

Readiness uses a cached health snapshot rather than an RPC call per HTTP request. API reads, health checks, and indexer work share the protocol RPC scheduler, which bounds concurrency and retries and enters a hard-quota cooldown after provider throttling. The indexer checkpoints event offsets and request/resolution IDs, reads bounded batches, and separately revisits a capped set of mutable requests. It does not rescan full history while idle.

Studio Dev can impose hourly or daily RPC quotas. The hard-quota cooldown is restored from the persisted checkpoint after an API restart. In the final production check, `/api/v1/health`, `/api/v1/network`, `/api/v1/protocol`, and `/api/v1/facts` return `200`; `/api/v1/ready` truthfully returns `503` with `rpc_quota` while the provider cooldown is active, and the indexer remains paused. Indexed reads are available from PostgreSQL, but they do not certify a fresh chain read or a wallet transaction. Do not run broad chain sweeps or retry a finalized transaction to work around quota limits. This source release is not a real-wallet certification.

## Security model

- Writes are submitted by the user's browser wallet on chain 61997; the API has no signing key.
- Evidence URLs are validated as HTTPS input and remain untrusted metadata. The backend does not fetch them, and the frontend does not iframe or inject their content.
- API inputs are schema-validated and SQL values are parameterized. Public endpoints are rate-limited behind the loopback reverse proxy.
- `.env` files, wallet stores, browser profiles, database dumps, and runtime logs do not belong in source control.

See [`SECURITY.md`](SECURITY.md), [`docs/APP_SECURITY_BOUNDARY.md`](docs/APP_SECURITY_BOUNDARY.md), and [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Checks

```sh
pnpm verify:contracts
pnpm typecheck
pnpm lint
pnpm test
pnpm test:browser
pnpm build
```

The database integration test uses `EVIDRA_TEST_DATABASE_URL` when provided; otherwise it targets the local `evidra_test` database over the Unix socket using the current OS role. Browser tests require the configured Playwright browser. Do not run state-changing wallet tests against a production wallet.

## Documentation

- [Protocol API](docs/API.md)
- [Frontend architecture](docs/FRONTEND_ARCHITECTURE.md)
- [Production deployment](docs/PRODUCTION_DEPLOYMENT.md)
- [Operations and recovery](docs/OPERATIONS.md)
- [Backup and recovery](docs/BACKUP_RECOVERY.md)
- [Release notes](docs/RELEASE_NOTES_v1.0.0.md)
- [Browser documentation](https://evidra-protocol.bydx.fun/docs)

The repository does not include a `LICENSE`; no software license has been selected for the owner.
