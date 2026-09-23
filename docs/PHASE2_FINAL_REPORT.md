# Evidra Phase 2 — Frontend, Wallet & Write Integration Certification

## 1. Contract integrity

`contracts/` was not modified and no contract transaction or deployment was
performed. Final hash verification passed:

| Contract source | SHA-256 |
| --- | --- |
| `evidra_consumer_probe.py` | `8af3b940e978b76c1affab807822a8db388a8c676d14801d5ffed55538bcbc36` |
| `evidra_policy_registry.py` | `df2f946f2d265cb8fd8d04012c5eb2beeab1830f60d5146a7761cb35279be247` |
| `evidra_registry.py` | `1b3a97ec340ad30c381404fecb76d3e4656d48dd550c2fdf02d4a7c2a50af8f7` |
| `evidra_resolver.py` | `3c9007bd1414227193b4459d96fb565e42e0b712661d802caa9477dd91a30bfe` |

## 2. Frontend architecture

`apps/web` is Next.js 15.5.25, React 19, TypeScript, Tailwind, Motion, Zod,
and the pinned `genlayer-js` RC client. The app uses the Phase 1 API for
indexed reads and `@evidra/protocol` for frozen constants, finalized reads,
wallet-owned credit reads, and explorer helpers. There is no frontend verdict
logic, server signer, or write proxy.

Routes cover the landing page, app overview, Fact Registry, Fact detail/history,
requests, resolutions, policies, templates, activity, developers, Create Fact,
and built-in documentation.

## 3. Visual system

The UI uses warm paper, graphite, vermilion, amber, acid/chartreuse, and moss
signals. It avoids purple/cyan AI gradients, fake social proof, decorative card
spam, and generic AI copy. Motion communicates protocol flow, evidence,
canonical/latest separation, and transaction progress. Reduced motion is
honored in both Motion and CSS.

## 4. Product surfaces

The landing page contains the protocol flow visual, real network status, fact
examples, lifecycle, evidence/provenance explanation, real API-backed registry
preview, developer entry point, and documentation links. The app provides
real-data loading, empty, error, stale, canonical, latest, evidence, policy,
template, and activity states. Evidence URLs are displayed as untrusted
metadata and never fetched or rendered as HTML.

## 5. Create Fact and writes

The eight-step wizard maps to the frozen V1 methods and exact argument order:

- `request_fact` for custom specifications;
- `request_fact_by_template` for exact template ID/version requests;
- `refresh_fact` for mutable facts;
- `request_reassessment` for supplemental evidence;
- `retry_resolution` with the configured `fee_per_attempt`;
- `cancel_stale_request`;
- `request_callback_retry`;
- `withdraw_credit` for the connected account’s own credit.

The UI validates the strict V1 HTTPS/domain-only source model for UX and still
leaves contract validation authoritative. Admin, guardian, resolver, commit,
ownership, and configuration methods are not exposed as product actions.

## 6. Wallet and transaction lifecycle

The EIP-1193 integration handles connect, disconnect, account changes, chain
changes, wrong-network messaging, and Studio Dev chain `61997`. Writes require
the connected user wallet and frozen Registry address. The lifecycle is:

`preparing → wallet → submitted → consensus → decided → finalizing → finalized`

The transaction ID is persisted locally as a recovery pointer. Reload
reconciliation waits for decision/finalization before clearing it, and a
pending pointer blocks duplicate submission. The UI never calls a submitted
or decided transaction a finalized Fact.

## 7. Documentation and security

Built-in docs cover the requested protocol topics. Repository handoff docs are
provided in `FRONTEND_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`,
`WALLET_INTEGRATION.md`, `WRITE_FLOWS.md`, `TRANSACTION_UX.md`,
`FRONTEND_SECURITY.md`, `ACCESSIBILITY.md`, and
`PHASE2_BROWSER_CERTIFICATION.md`.

Controls include frozen chain/address validation, no secret bundling, strict
external URL handling, no arbitrary HTML/iframe rendering, safe explorer
links, bounded form inputs, accessible status/error semantics, reduced motion,
and no wallet secret storage.

## 8. Tests and build

- workspace typecheck: PASS;
- workspace lint: PASS;
- workspace tests: **20/20 PASS** (protocol 6, web 7, config 2, database 1,
  API 4);
- web production build: PASS;
- workspace production build: PASS;
- Playwright browser smoke: **2/2 PASS**, 0 skipped, using system Chrome;
- browser visual inspection: landing at 1440×900 and Create Fact at 390×844;
- final contract hash verification: 4/4 PASS.

The Next build emits an informational warning that the repository’s flat ESLint
configuration does not load the optional Next ESLint plugin; the explicit web
and workspace lint commands pass with zero errors.

## 9. Remaining limitations

- The reserved public domain/nginx/TLS deployment is intentionally deferred to
  Phase 3.
- No live wallet write was sent during Phase 2, per scope. Phase 3 must run a
  controlled real-user Studio Dev E2E for approval, consensus, finalization,
  and resulting Fact reconciliation.
- A manual screen-reader/axe pass against the deployed production shell is
  still a Phase 3 release check.
- The current workspace production audit still reports the existing Phase 1
  `fastify@5.6.1` dependency with two high and two moderate advisories. It
  was not changed here because Phase 2 change control limits backend changes
  to proven frontend integration fixes; upgrade Fastify to the patched `5.12.x`
  line before public deployment.

## 10. Final gate

**PHASE 2 GATE: PASS**

FRONTEND + WALLET + WRITE INTEGRATION READY.  
SAFE TO BEGIN PHASE 3 PRODUCTION DEPLOYMENT + REAL USER E2E.
