# Evidra Protocol — Phase 0 Architecture Decisions

Status: recommended handoff; application implementation intentionally not started.

## Decision 1 — Separate protocol truth from application projections

Adopt a read-first backend with PostgreSQL projections and a shared protocol client. Chain state remains authoritative. DB/search/UI metadata is rebuildable and must carry observation/finality metadata.

Reason: the Registry exposes canonical and latest pointers, finalized reads, event pages, and history records. A conventional app cache is useful, but it cannot replace those pointers or invent verdict logic.

## Decision 2 — Preferred stack

- Frontend: Next.js + TypeScript.
- Backend: Node.js + TypeScript + Fastify.
- Database: PostgreSQL.
- Shared package: `packages/protocol`.

This is a direction, not a locked dependency manifest. A compatibility spike must verify the GenLayer SDK/runtime and browser-wallet behavior against chain `61997` before exact package versions are pinned. Post-SSRF certification used the RC toolchain (`genlayer-js` `2.0.0-rc.1`, GenLayer CLI `0.40.0-rc.3`); the installed stable 1.x client produced malformed contract-call decoding on this chain. This is evidence for the spike, not permission to assume package versions are interchangeable.

## Decision 3 — Ownership boundaries

```text
contracts          frozen V1 canonical state and lifecycle
packages/protocol  addresses, encoders, readers, types, errors, tx normalization
backend            finalized reads, indexing, reconciliation, API, transaction tracking
frontend           wallet UX, display, form validation, user-signed writes
postgres           rebuildable projection/search/operational state
```

The backend does not own user signing. The frontend does not independently calculate verdicts. Both use the shared client and the same frozen network constants.

## Decision 4 — Resolver/evidence trust boundary

The resolver performs web/LLM semantic work. The contract binds claim/fact/spec/policy/template identifiers and checks resolver authorization, but the current equivalence is `critical-fields-only`; evidence manifest and reasoning are not consensus-equivalent. The app must display this as an attestation limitation and never use reasoning/evidence to override the stored outcome.

## Decision 5 — Finalized-first reads

Canonical API/detail reads use `LATEST_FINAL`. Non-final reads are allowed only for progress/status surfaces and must be labeled provisional. The application may show a submitted transaction before the protocol state exists but must not show a finalized Fact verdict before successful finalization plus a durable read.

## Decision 6 — No websocket assumption

No websocket/event stream was verified. The initial indexer uses event pagination, bounded polling, and transaction ID reconciliation. A future subscription optimization may be added only after the deployment exposes and tests it.

## Decision 7 — Phase gate before implementation

The surgical HIGH-001 patch is certified closed for direct contract-level URL
ingress. The historical 128-test suite was unavailable and was not recovered;
the independent reconstructed suite closed that evidence gap under the final
Phase 0 criteria. The residual GenVM DNS/redirect security assumption, app
SSRF controls, and SDK/browser-wallet compatibility spike remain required
Phase 1 acceptance checks. No application implementation was started in
Phase 0.
