# Phase 3 Real User E2E

> Historical attempt from 2026-09-21. One public-UI wallet submission was
> observed, but hosted RPC quota prevented finalized reconciliation. This is
> not a completed end-to-end certification and does not certify v1.0.0. The
> release's wallet status is recorded in
> [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md).

## Required journey

The certification journey used a real Chromium browser at
`https://evidra-protocol.bydx.fun`, an EIP-1193 provider backed by a dedicated
low-value Studio Dev wallet, and the public Create Fact UI. The private key
was supplied only to the browser harness environment. It was not committed,
logged, sent to the backend, persisted by the application, or included in
traces/screenshots.

## Completed public UI write

The following inputs were entered through the public wizard:

- subject: `example.com`
- predicate: `publishes the Example Domain page`
- object: `Example Domain`
- custom fact, `solo` policy v1, immutable fact
- source: `https://example.com/`
- reuse: `FORCE_FRESH_RESOLUTION`

The wallet approval produced exactly one request transaction:

`0xd6d28e21ffb0448ce52078ac2bdd3e04b3626d245271683780f2ed21ba48240e`

The public wallet was `0xD6bD92F526E849cA80a8019551Faa135bc61639B` on chain
`61997`. The transaction finalized successfully at the request layer. A
rapid second click resulted in one provider send and one request transaction.

The resulting request metadata was:

- request id: `4`
- claim key:
  `33b1d96c4e77e633e4a913406801862d90dcde883a56a09be30202b561d153a0`
- fact key:
  `f3f1b9ad892bd1e026e9147b8d325705d4b058511849535088b984292c06ad86`
- resolver transaction:
  `0x1e95e03985d6503d913caf5201f3e9f7f4e936da956bce16d67a5d9a2df6b432`

## Why the Fact is not certified

The child resolver remained `PROPOSING` with `NO_MAJORITY` in the last
available finalized read. The registry request remained `DISPATCHED`, and no
resolution record was available. The subsequent Studio Dev provider quota was
exhausted at `5000 requests per day`, so the API readiness check correctly
returned `503` and the indexer could not perform the required reconciliation.

Therefore the following values are intentionally **not** asserted:

- resolution id or version;
- canonical or latest outcome;
- diagnostic reason;
- policy-satisfied result;
- resolved-at or valid-until timestamps;
- finalized Fact page agreement.

The parent transaction is evidence of a successful UI-originated request, not
evidence of a completed canonical Fact.

## Transaction UX evidence

The UI emitted the expected request lifecycle labels through submission,
consensus/decision handling, and transaction finalization. The finalized
claim was not shown as a completed Fact because the application requires a
finalized state read and API reconciliation before doing so. Live reload timing
was too short to observe a mid-flight browser reload without delaying the
network artificially; the deterministic reload/reconciliation tests remain
the evidence for that path. The rapid-click test observed one wallet send.

## Other write paths

- Reassessment: not eligible because the new Fact was not materialized.
- Refresh: correctly gated for the immutable test fact.
- Retry/cancel/callback retry: no naturally eligible state; deterministic
  gating only.
- Credit withdrawal: zero-credit state; no write sent.

## Gate

Real UI write evidence is partial and valid, but final real-user certification
remains blocked until quota recovery permits resolver finalization, indexer
reconciliation, and chain/API/UI agreement.
