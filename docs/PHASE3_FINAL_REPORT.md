# Evidra Protocol V1 — Production & Real User E2E Certification

> Historical snapshot from 2026-09-21. This records the then-current Phase 3
> attempt and quota block; it is not the v1.0.0 release certification. See
> [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md) for release-specific
> test and wallet status.

## Gate status

The public application is deployed and the first real wallet-backed mutation
was submitted through the public Create Fact UI. The overall Phase 3 gate is
**BLOCKED** because Studio Dev is currently returning `Rate limit exceeded:
5000 requests per day`; the resolver result and resulting Fact cannot be
reconciled while the required finalized reads are unavailable.

This is an external quota blocker, not a substituted or simulated write. No
direct contract write, raw transaction script, database edit, or backend write
endpoint was used in the user journey.

## Contract integrity

The four frozen contract sources were verified before and after this closure
work. All expected hashes match. No contract file was modified and no contract
was redeployed.

Network: GenLayer Studio Dev, chain `61997`.

## Production changes in this closure

- Public web API reads fall back to the same-origin `/api/v1` path when no
  public API override is configured.
- Create Fact disables duplicate submission from the `preparing` stage onward.
- Create Fact supplies the GenLayer execution fee separately from the protocol
  fee quote.
- The shared RPC scheduler stops a queued batch immediately when the provider
  reports an exhausted quota instead of amplifying the outage with retries.
- The API remains live but readiness fails closed while finalized RPC reads are
  unavailable.
- The production axe scan completed with no violations on the five required
  page classes at desktop and mobile viewports.

## Real public UI write

The controlled Chromium harness injected an EIP-1193 provider backed by the
dedicated low-value wallet only inside the browser process. The private key was
not printed, persisted, sent to the backend, or included in repository files,
screenshots, traces, logs, or database data.

- wallet address: `0xD6bD92F526E849cA80a8019551Faa135bc61639B`
- chain: `61997`
- request transaction:
  `0xd6d28e21ffb0448ce52078ac2bdd3e04b3626d245271683780f2ed21ba48240e`
- request id: `4`
- claim key:
  `33b1d96c4e77e633e4a913406801862d90dcde883a56a09be30202b561d153a0`
- fact key:
  `f3f1b9ad892bd1e026e9147b8d325705d4b058511849535088b984292c06ad86`
- child resolver transaction:
  `0x1e95e03985d6503d913caf5201f3e9f7f4e936da956bce16d67a5d9a2df6b432`

The parent request transaction finalized successfully. The provider counted
one transaction submission during the rapid double-click test. Before the
daily quota was exhausted, the child resolver record remained `PROPOSING` with
`NO_MAJORITY`; the registry request remained `DISPATCHED`, so no canonical
resolution, outcome, diagnostic, policy-satisfied result, or finalized Fact
was claimed.

## Remaining certification gap

At the final readiness check the public API returned HTTP `503` with
`readiness_unavailable`. Logs identified the provider response as:

`Rate limit exceeded: 5000 requests per day`

The indexer scheduler now fails closed after one bounded quota failure per
poll cycle. It does not rotate identities, hammer the endpoint, or weaken
readiness. The live UI write cannot be promoted to a completed Fact until the
normal quota resets and finalized chain/API/UI comparison can be performed.

Reassessment was not attempted because the new Fact was not materialized.
Refresh, retry, cancellation, callback retry, and credit withdrawal were
handled by eligibility gating; no artificial failing protocol state was
created.

## Semantic lint

The exact pinned semantic-lint environment is unavailable in the current
shell. The repository retains the prior reproducible certification:
`genvm-linter 0.11.1rc2`, `GenVM v0.6.0-rc5`, four contracts, zero errors.
The source hashes remain identical.

## Local closure checks

- workspace tests: `26/26` passed;
- reconstructed contract regression: `120 passed`, `174 subtests passed`;
- build, typecheck, and lint: passed;
- public axe scan: ten scenarios, zero Critical/Serious/Moderate/Minor
  violations;
- clean archive extraction: required directories present, zero forbidden
  entries, source hashes matched, workspace tests passed.

The rebuilt candidate archive is `artifacts/evidra-protocol-v1.0.0.zip` with
220 entries. Its exact hash and size are recorded in the final handoff; it is
not a published release while this gate is blocked.

## Release status

No Git commit, tag, push, or final `v1.0.0` release was created while the
technical gate is blocked. The empty GitHub remote was not force-written.

## Final gate

PHASE 3 GATE: BLOCKED
