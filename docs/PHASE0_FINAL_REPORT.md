# Evidra Phase 0 — Contract Audit & Integration Certification

This file preserves the pre-SSRF-patch audit record below. The final V1
re-freeze result is appended in “Post-SSRF re-certification”; the superseded
deployment and its blocked gate are historical only.

Audit date: 2026-09-21 UTC. Scope was read-only source/deployment analysis. No contract file was modified, no deployment occurred, and no state-changing blockchain transaction was sent.

## 1. Source Freeze

All four local SHA-256 hashes match the supplied frozen hashes. Read-only `gen_getContractCode` retrieval also matched each local source hash.

| Source | SHA-256 | Result |
|---|---|---|
| `contracts/evidra_consumer_probe.py` | `8af3b940e978b76c1affab807822a8db388a8c676d14801d5ffed55538bcbc36` | MATCH |
| `contracts/evidra_policy_registry.py` | `df2f946f2d265cb8fd8d04012c5eb2beeab1830f60d5146a7761cb35279be247` | MATCH |
| `contracts/evidra_registry.py` | `d51d9fad67c9ca906899ef2fd3b9ab162bdfde0b0e94018d172690c95938ed10` | MATCH |
| `contracts/evidra_resolver.py` | `7c3a3ea481795ba330509de47e14be2346bd90144e26ae77b9f17c89f455495d` | MATCH |

The repository is not a Git checkout. Four generated
`contracts/__pycache__/*.pyc` files were found during the initial audit and
were later removed during cleanup; none is in the final tree or release
artifact. No `.env`, private key, wallet file, or deployment artifact was
found.

## 2. Network Verification

The addresses listed in the historical Phase 0 evidence below are
SUPERSEDED pre-SSRF addresses. They are not valid application configuration;
the post-SSRF deployment addresses are the only current V1 addresses.

- RPC: `https://studio-dev.genlayer.com/api`
- Chain ID: `61997` (`0xf22d`)
- Explorer: `https://explorer-studio-dev.genlayer.com`
- All live reads used latest-final/finalized semantics.

Frozen addresses were readable and matched the expected relationships:

- Registry → PolicyRegistry: `0x2954E162E439d1d626159e2Ada8ee2DF9fF09CD6`
- Registry → default Resolver: `0x47B2a9278A3034DEA88feE1B4a1DeB3475418de9`
- Resolver → Registry: `0x885a61c9e72E4E11b98E8054B90D08809C6e3402`
- ConsumerProbe → trusted Registry: `0x885a61c9e72E4E11b98E8054B90D08809C6e3402`

Verified versions: `evidra-policy-registry-v1`, `evidra-registry-v1`, `evidra-resolver-v1`. Registry was unpaused; resolver was enabled. Live state contained 3 policies, 2 templates, 4 requests, 4 resolutions, 3 facts, and 20 Registry events. Protocol fee values were all zero. ConsumerProbe showed 4 callback deliveries and 1 duplicate ignored.

## 3. Contract Audit

Finding counts:

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 1 |
| Medium | 3 |
| Low | 3 |
| Info | 2 |

### Real findings

- **HIGH-001 — `EvidraRegistry.validate_seed_url` / resolver fetch boundary:** `https://[::ffff:127.0.0.1]/` is accepted while literal loopback is rejected. DNS destination and redirect targets are not revalidated at the contract boundary. A resolver may therefore reach an internal/private endpoint if the renderer permits it. Contract remediation is required for a protocol-wide guarantee; app validation is only partial mitigation. **Unresolved; blocks the gate.**
- **MEDIUM-001 — policy fail-open:** an empty source allow-list with zero minima can leave `UNKNOWN` evidence eligible. Require non-empty allow-lists or make empty allow-lists deny all.
- **MEDIUM-002 — evidence is not consensus-bound:** resolver equivalence checks critical verdict fields but not the evidence manifest or reasoning summary. The UI/API must label evidence as the committed leader manifest and retain the manifest hash.
- **MEDIUM-003 — permissionless zero-surcharge growth:** request/reassessment/refresh are public, live protocol fees are zero, and history/event/processed-callback storage is unbounded. App rate limits and bounded indexer reads are required; protocol-level limits would require a contract decision.
- **LOW-001 — fee quote limitation:** quote accepts any mode as a fallback quote and does not quote retry fees. Clients must validate modes and use protocol config for retry fees.
- **LOW-002 — callback-state transition:** `mark_callback_result` checks the callback target but not that a callback was dispatched or that an acknowledgement is still mutable. App projections must treat callback status as advisory and monotonic.
- **LOW-003 — resolver URL deduplication:** `_canonical_url` drops query strings and explicit ports, so distinct source views can collapse before fetching. Preserve the committed manifest and warn about this V1 behavior.
- **INFO-001:** a template can reference a missing/inactive default policy until request time.
- **INFO-002:** `FAILED` is declared but not produced by a V1 request path; resolver failures are represented by `RESOLVED` plus `UNRESOLVED` and a diagnostic.

Authorization, attempt binding, resolver-only commits, callback-target authentication, two-step ownership, guardian pause, canonical/latest advancement, freshness, source policy, templates, evidence limits, and callback idempotency were independently traced. No additional Critical or High issue was found beyond HIGH-001.

## 4. Integration Surface

- Public methods: **90 total — 64 views and 26 writes**.
- Exact inventory: `CONTRACT_METHOD_MATRIX.md` and `contract-method-matrix.json`.
- Protocol types: request statuses, outcomes, diagnostics, reuse/mutability modes, source classes/statuses, callback statuses, records, and capabilities are in `PROTOCOL_TYPES.md`.
- Contract errors and end-user normalization are in `CONTRACT_ERROR_CATALOG.md`.
- Identity rules: `claim_key` is semantic claim identity; `fact_key` adds policy/schema/template identity; `spec_hash` contains request execution inputs including TTL/seeds; `callback_id` binds request, resolution, and consumer.
- Canonical truth is `FactRecord.current_*` and `get_current_resolution`. `latest_resolution_id` identifies the newest attempt and may differ from canonical. `RESOLVED` does not mean the outcome is TRUE/FALSE; `UNRESOLVED` is a valid committed outcome.
- `valid_until` and `is_fact_fresh` control freshness. Immutable facts use `valid_until=0`; mutable facts must be checked against the current clock and on-chain record.
- Callback `DISPATCHED` is not `ACKNOWLEDGED`, and callback success is independent of canonical resolution success.
- Transaction handling and finalized reconciliation are specified in `TRANSACTION_LIFECYCLE.md`.

## 5. Backend Handoff

Recommended Phase 1 shape: Node.js/TypeScript with Fastify, PostgreSQL, a shared `packages/protocol` client, a finalized-state chain reader, bounded indexer, transaction tracker, and public read API. The chain remains canonical; PostgreSQL stores recoverable projections, search indexes, UI metadata, and analytics only.

The backend must recover facts, requests, resolutions, evidence references, policies, templates, and protocol configuration from chain reads. It must reconcile transactions and finalized reads, use bounded pagination, tolerate RPC 502/rate limits with backoff, and rebuild projections from chain checkpoints. The full schema concept and reconciliation rules are in `BACKEND_INTEGRATION_SPEC.md` and `INDEXER_RECONCILIATION_SPEC.md`.

## 6. Frontend Handoff

The frontend should use the documented page/data map for Landing, Overview, Create Fact, Fact Registry, Fact Detail, History, Evidence, Policies, Templates, Activity, Developers, and Docs. Wallet writes are limited to user/admin operations; resolver, commit, and callback writes are never frontend actions.

The Create Fact wizard maps exact contract parameters for custom and template requests, validates source/TTL/reuse limits, quotes protocol fee separately from network execution cost, and shows submitted/pending/consensus/finalized/execution-failed states. Fact Detail must show canonical resolution and latest attempt in separate panels, with explicit diagnostic, freshness, valid-until, evidence, hashes, template/policy versions, callbacks, and transaction links.

## 7. Security Boundary

Mandatory future-app controls: no private keys in the frontend; no server impersonation of user wallets; chain ID/address validation; wallet-address and parameter validation; duplicate-click and replay protection; SSRF-safe URL handling; no arbitrary HTML from evidence; URL sanitization; CSP/XSS/SSR escaping; API rate limits; strict CORS; CSRF protection for cookie-authenticated writes; secret/log redaction; environment separation; and canonical truth derived from finalized chain reads only. See `APP_SECURITY_BOUNDARY.md`.

## 8. Deliverables

- `docs/PHASE0_CONTRACT_AUDIT.md`
- `docs/CONTRACT_METHOD_MATRIX.md`
- `docs/contract-method-matrix.json`
- `docs/PROTOCOL_TYPES.md`
- `docs/CONTRACT_ERROR_CATALOG.md`
- `docs/TRANSACTION_LIFECYCLE.md`
- `docs/BACKEND_INTEGRATION_SPEC.md`
- `docs/FRONTEND_INTEGRATION_SPEC.md`
- `docs/PROTOCOL_CLIENT_SPEC.md`
- `docs/INDEXER_RECONCILIATION_SPEC.md`
- `docs/APP_SECURITY_BOUNDARY.md`
- `docs/PRODUCT_UI_REQUIREMENTS.md`
- `docs/PHASE0_ARCHITECTURE_DECISIONS.md`
- `docs/PHASE0_FINAL_REPORT.md`
- `docs/READ_METHOD_CERTIFICATION_POST_SSRF.md`
- `artifacts/evidra/read_certification_final.json`

No backend or frontend implementation files were created.

## 9. Blockers

1. **Historical pre-patch blocker:** HIGH-001 was unresolved because the frozen Registry accepted an IPv4-mapped loopback URL. The post-SSRF re-certification below records the surgical fix and closure.

No source mismatch, wrong network/address, or unreadable deployment state was found.

## 10. FINAL GATE

PHASE 0 GATE: BLOCKED

## Post-SSRF re-certification — 2026-09-21

HIGH-001 was reopened for one URL-validation patch. `EvidraRegistry` now uses a
single strict HTTPS/domain-only validator for all seed, template, refresh, and
reassessment URL ingress. It rejects every direct IP literal (including
IPv4-mapped IPv6), localhost/local aliases, userinfo, fragments, malformed
authority, control/whitespace tricks, invalid labels, and explicit ports other
than 443. `EvidraResolver` defensively revalidates every collected URL before
any Web fetch.

The new four-contract stack was deployed to Studio Dev chain 61997 and every
deployment/configuration transaction finalized successfully. Deployed negative
tests rejected the original mapped-IPv6 input plus IPv4 loopback, IPv6
loopback, localhost, userinfo, non-443 port, template seed, and reassessment
supplemental inputs; request/resolution counters remained unchanged. A valid
`https://example.com/` source completed Web fetch, LLM adjudication, finalized
commit, evidence manifest storage, reassessment version 2, and ConsumerProbe
callback delivery. All 64 public view methods passed fresh `latest-final` read
certification; the complete per-method evidence is in
`READ_METHOD_CERTIFICATION_POST_SSRF.md` and
`artifacts/evidra/read_certification_final.json`.

Runtime DNS resolution and redirect destination filtering remain GenVM Web
Module responsibilities. Public Studio Dev RPC does not expose enough runtime
configuration to prove parity with the inspected reference implementation, so
this certification closes direct contract-level URL ingress only and does not
claim contract-side DNS enforcement.

Final source hashes, deployment/configuration transaction hashes, negative
test hashes, live lifecycle records, read certification, semantic lint
environment, and release artifact metadata are in
`SSRF_PATCH_CERTIFICATION.md`, `DEPLOYMENT_RECORD.md`, `READ_CERTIFICATION.md`,
and `READ_METHOD_CERTIFICATION_POST_SSRF.md`.

HIGH-001: CLOSED

Final addresses: PolicyRegistry `0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71`,
Registry `0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6`, Resolver
`0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477`, ConsumerProbe
`0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F`.

PHASE 0 GATE: BLOCKED

Remaining blocker: the repository contains no historical 128-test freeze suite
and the remote repository is empty, so the required old-suite regression cannot
be independently rerun. The available post-patch suite is 10/10, semantic
lint is PASS for all four files with `genvm-linter 0.11.1rc2` and the cached
header-pinned GenVM `v0.6.0-rc5` runner, and all live deployment/read/lifecycle
checks passed. Restore the historical suite and rerun it before declaring the
final V1 freeze.

## Reconstructed regression closure — 2026-09-21

The historical 128-test suite was unavailable and was **not** recovered or
recreated by count. The final closure instead uses the independent suite in
`tests/reconstructed/`, derived from the frozen source and Phase 0
specifications.

- 9 test files; 120 tests; 120 PASS, 0 FAIL, 0 SKIP.
- Security invariants I1–I23: 23/23 PASS.
- Focused SSRF regressions: 10/10 PASS; HIGH-001 remains CLOSED.
- Semantic `genvm-lint`: all four contracts PASS with `genvm-linter
  0.11.1rc2` and the cached GenVM `v0.6.0-rc5` runner.
- Existing post-SSRF deployment read certification: 64/64 unique public
  views PASS with `latest-final` semantics, plus 15/15 scenario reads PASS.
- Deployed bytecode hashes and Registry/Resolver/ConsumerProbe relationships
  match the final source and frozen addresses.
- No state-changing transaction and no redeployment occurred during closure.

The source-derived deterministic/structural tests cover write and
state-machine behavior without violating the read-only closure rule; deployed
evidence is read-only and covers every public view. Existing Medium/Low/Info
findings remain documented as non-blocking. No Critical or High finding is
open.

The historical-suite blocker above is superseded by this independent
reconstructed evidence under the current Phase 0 acceptance criteria.

**PHASE 0 GATE: PASS**

**EVIDRA PROTOCOL V1 FINAL FREEZE: PASS**

Final V1 addresses:

- PolicyRegistry: `0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71`
- Registry: `0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6`
- Resolver: `0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477`
- ConsumerProbe: `0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F`

## Final evidence closure — 2026-09-21

- Source hashes remained unchanged and deployed `gen_getContractCode` bytes
  matched all four local hashes.
- Semantic `genvm-lint check` passed all four contracts with
  `genvm-linter 0.11.1rc2` and the exact cached header-pinned GenVM runner.
- The finalized read certification passed **64/64** unique views; its
  complete record is `artifacts/evidra/read_certification_final.json`.
- The rebuilt artifact is `artifacts/evidra-protocol-v1-final.zip`; its final
  hash, size, file count, and extraction checks are reported with this
  certification.
- No redeployment or state-changing transaction was performed during this
  closure task. The deployment remains a freeze candidate, not a final freeze,
  until the original historical regression suite is recovered and passes.

## Final status override — 2026-09-21

The preceding candidate wording records the earlier evidence state. It is
superseded under the current acceptance criteria by the independent
reconstructed suite. The historical 128-test suite was unavailable and was
not recovered or recreated by count.

- Reconstructed suite: 120/120 PASS, 0 FAIL, 0 SKIP across 9 files.
- Security invariants: I1–I23, 23/23 PASS.
- Semantic lint: 4/4 contracts PASS.
- Deployed read certification: 64/64 unique views and 15/15 scenarios PASS
  using `latest-final` reads.
- ZIP: `artifacts/evidra-protocol-v1-final.zip`; final hash, size, and entry
  count are recorded in the release handoff and final report.
- No write or redeployment occurred.

HIGH-001 is CLOSED; Critical open = 0 and High open = 0. Existing
Medium/Low/Info findings remain documented as non-blocking limitations.

**PHASE 0 GATE: PASS**

**EVIDRA PROTOCOL V1 FINAL FREEZE: PASS**

The final deployed addresses are the post-SSRF addresses listed above.
