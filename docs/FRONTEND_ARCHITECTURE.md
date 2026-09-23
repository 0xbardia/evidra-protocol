# Evidra Frontend Architecture

Phase 2 uses a single Next.js application at `apps/web` with a small set of
shared browser libraries. It consumes the Phase 1 API for indexed reads and
uses the shared `@evidra/protocol` package for finalized verification and
wallet-owned reads.

## Boundaries

- `apps/web/src/lib/api.ts` is the typed HTTP boundary for `/api/v1`.
- `apps/web/src/lib/config.ts` is the only web configuration boundary. It
  validates the Studio Dev chain and frozen addresses at startup/build time.
- `apps/web/src/lib/writes.ts` is the only browser write adapter. It uses the
  connected EIP-1193 provider and `genlayer-js`; there is no server signer or
  write proxy.
- `packages/protocol` remains the source for chain constants, normalized read
  types, finalized read modes, and explorer URL helpers.
- React components format and explain contract state. They do not calculate
  verdicts, policy satisfaction, canonical heads, or fact identity locally.

## Routes

Public routes are `/`, `/docs`, and `/docs/[topic]`. Application routes live
under `/app`: overview, facts, fact detail/history, create, requests,
resolutions, policies, templates, activity, and developers.

The route tree is intentionally server-rendered where possible. Interactive
pieces are client components: wallet state, motion, filters, the create
wizard, protocol actions, and credit withdrawal.

## Data policy

The API projection is the default list/detail source because it supports
search, pagination, and sync metadata. Important verification reads can use
the `source=chain` API path, which performs a finalized chain read. A cached
projection is never described as an independently authoritative verdict.

The landing page omits protocol metrics when the API cannot provide them. It
does not invent users, partners, TVL, or resolution volume.

## Build and run

```bash
pnpm install
pnpm --filter @evidra/web dev
pnpm --filter @evidra/web typecheck
pnpm --filter @evidra/web lint
pnpm --filter @evidra/web test
pnpm --filter @evidra/web test:browser
pnpm --filter @evidra/web build
```

The browser app requires only public environment variables. Phase 2 does not
configure the reserved public domain.
