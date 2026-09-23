# Evidra Protocol V1 — Phase 0 Contract Audit

> Historical Phase 0 audit from 2026-09-21. Any deployment details below describe that audit snapshot; the authoritative frozen V1 addresses are in [`DEPLOYMENT_RECORD.md`](DEPLOYMENT_RECORD.md).

Audit date: 2026-09-21 UTC  
Scope: frozen V1 contract source, frozen Studio Dev deployment, read-only calls only.

## Scope and safety boundary

This audit did not edit `contracts/`, deploy anything, publish anything, send a state-changing call, or invoke a callback/write path. All live contract reads used the frozen RPC with `TransactionHashVariant.LATEST_FINAL` through the compatible `genlayer-py` 0.19.0rc2 read path. `gen_getContractSchema` and `gen_getContractCode` were also read-only. The deployed schemas matched the local public-method inventory: 90 methods, 64 views, and 26 writes.

Frozen network:

- RPC: `https://studio-dev.genlayer.com/api`
- chain ID: `61997` (`0xf22d`)
- explorer: `https://explorer-studio-dev.genlayer.com`

Historical pre-SSRF addresses (SUPERSEDED; retained only as audit evidence;
never use them for application configuration):

| Contract | Address |
|---|---|
| EvidraPolicyRegistry | `0x2954E162E439d1d626159e2Ada8ee2DF9fF09CD6` |
| EvidraRegistry | `0x885a61c9e72E4E11b98E8054B90D08809C6e3402` |
| EvidraResolver | `0x47B2a9278A3034DEA88feE1B4a1DeB3475418de9` |
| EvidraConsumerProbe | `0x3b3cB8e1711588DBa31efC69c847d68Df3D68086` |

## Source freeze

Local SHA-256 and deployed `gen_getContractCode` SHA-256 both match:

| File | Expected | Local | Deployed | Result |
|---|---|---|---|---|
| `contracts/evidra_consumer_probe.py` | `8af3b940e978b76c1affab807822a8db388a8c676d14801d5ffed55538bcbc36` | `8af3b940e978b76c1affab807822a8db388a8c676d14801d5ffed55538bcbc36` | `8af3b940e978b76c1affab807822a8db388a8c676d14801d5ffed55538bcbc36` | PASS |
| `contracts/evidra_policy_registry.py` | `df2f946f2d265cb8fd8d04012c5eb2beeab1830f60d5146a7761cb35279be247` | `df2f946f2d265cb8fd8d04012c5eb2beeab1830f60d5146a7761cb35279be247` | `df2f946f2d265cb8fd8d04012c5eb2beeab1830f60d5146a7761cb35279be247` | PASS |
| `contracts/evidra_registry.py` | `d51d9fad67c9ca906899ef2fd3b9ab162bdfde0b0e94018d172690c95938ed10` | `d51d9fad67c9ca906899ef2fd3b9ab162bdfde0b0e94018d172690c95938ed10` | `d51d9fad67c9ca906899ef2fd3b9ab162bdfde0b0e94018d172690c95938ed10` | PASS |
| `contracts/evidra_resolver.py` | `7c3a3ea481795ba330509de47e14be2346bd90144e26ae77b9f17c89f455495d` | `7c3a3ea481795ba330509de47e14be2346bd90144e26ae77b9f17c89f455495d` | `7c3a3ea481795ba330509de47e14be2346bd90144e26ae77b9f17c89f455495d` | PASS |

The workspace is not a Git checkout. The only unexpected generated artifacts found were:

```text
contracts/__pycache__/evidra_consumer_probe.cpython-312.pyc
contracts/__pycache__/evidra_policy_registry.cpython-312.pyc
contracts/__pycache__/evidra_registry.cpython-312.pyc
contracts/__pycache__/evidra_resolver.cpython-312.pyc
```

They were reported and left untouched during the initial audit. Later cleanup
removed these generated caches; they are absent from the final tree and
release artifact. No `.env`, private-key, wallet, or deployment-artifact file
was found in the repository tree.

## Independent live verification

The frozen addresses expose the expected schemas and versions. Finalized reads returned:

| Check | Result |
|---|---|
| Policy registry version | `evidra-policy-registry-v1` |
| Registry version | `evidra-registry-v1` |
| Resolver version | `evidra-resolver-v1` |
| Registry → policy registry | exact frozen PolicyRegistry address |
| Registry → default resolver | exact frozen Resolver address |
| Resolver → registry | exact frozen Registry address |
| ConsumerProbe → trusted registry | exact frozen Registry address |
| Registry owner | `0x38475c93eC325EcfE39544A7Bf9072616ad7979b` |
| Registry guardian | same as owner |
| Policy owner | `0x38475c93eC325EcfE39544A7Bf9072616ad7979b` |
| Pending owners | zero address on both owner-controlled contracts |
| Registry paused | `false` |
| Resolver registration | enabled, version `evidra-resolver-v1` |
| Resolver capabilities | web, LLM, source isolation, injection-hardened flag; equivalence `critical-fields-only` |

Observed finalized protocol state:

- Policy registry: 3 policies, 2 templates, 5 events.
- Registry: 4 requests, 4 resolutions, 3 facts, 20 events, 0 reused requests, unpaused.
- Fees: `fee_base=0`, `fee_per_attempt=0`, `fee_reuse=0`.
- Limits: 5 attempts, 8 initial seed URLs, 60-second retry delay, 86,400-second stale threshold.
- ConsumerProbe: 4 callback deliveries, 1 duplicate ignored. Registry records remain `DISPATCHED` because the probe was not used to acknowledge them.
- Existing fact `30e6…b3cf8` has history `[1,2]`, canonical/current resolution 2, latest resolution 2, and `TRUE`.
- Existing template-backed fact `320f…5ca8` has `UNRESOLVED` / `INSUFFICIENT_EVIDENCE` at resolution 3.
- Existing official-only fact `8913…b2ef` has `UNRESOLVED` / `SOURCE_POLICY_UNSATISFIED` at resolution 4.

The active policy/template records read from finalized state were:

| Kind | ID/version | Hash | Key configuration |
|---|---|---|---|
| Policy | `core` / 1 | `9873510c8ec0dec312548910acce8207a8022f7c5327c6614c09154f9a268f27` | Allowed `OFFICIAL,PRIMARY,INDEPENDENT_SECONDARY`; minimum primary 1; minimum independent 1; cross-check true |
| Policy | `solo` / 1 | `e432ebeb2d2029505886af9da948b101dceb742cfa539e7459ff8a53b68f1ff8` | Allowed `OFFICIAL,PRIMARY`; minimum primary 1; minimum independent 1; cross-check false |
| Policy | `freeze_official` / 1 | `04503aea6dc06555dc07c659c065f185a8f7d7ed597196892681ab3b04298b9d` | Allowed `OFFICIAL`; minimums 0; cross-check false |
| Template | `launch` / 1 | `ad79e4f13ae379ea23b62568f554436bef80366e7f9b2e968164830d1b88592e` | Fact type `immutable_launch`; default policy `core`/1; required fields `subject,temporal` |
| Template | `launch_announce` / 1 | `e70540d76ba50adac87d03bdb7d0ab948e40883c15949f6c0843069d050156af` | Fact type `immutable_launch`; default policy `solo`/1; required fields `subject,temporal` |

The policy registry’s active flags and the template records’ active/deprecated flags were read directly; all listed records were active and non-deprecated at audit time.

Existing versions are all version 1. No v2 policy or template was present. Existing template facts retain their stored template ID/version/hash; querying a latest template is not a safe substitute.

## Findings summary

| ID | Severity | Finding | Integration effect |
|---|---|---|---|
| HIGH-001 | HIGH | HTTPS URL validation accepts private IPv4-mapped IPv6 endpoints; DNS/private redirect protection is also absent at the contract boundary. | Resolver/web trust boundary; direct chain callers can submit inputs the contract intended to reject. |
| MEDIUM-001 | MEDIUM | Empty `allowed_classes` is valid and makes `UNKNOWN` usable when policy minima are zero. | Policy UI and verdict interpretation; fail-closed expectations are not met by this policy shape. |
| MEDIUM-002 | MEDIUM | Nondeterministic validation compares only critical verdict fields, not evidence manifest or reasoning. | Evidence can be stored/displayed from the leader even when validator evidence differs. |
| MEDIUM-003 | MEDIUM | Request/reassessment/refresh operations are permissionless and V1 protocol fees are zero; history/events/processed callback IDs grow without a protocol cap. | Direct-chain spam can grow resolver work and state/indexing cost. |
| LOW-001 | LOW | `quote_resolution_fee` does not reject an invalid reuse mode and does not quote retry fees. | Frontend must validate modes and use config for retry quotes. |
| LOW-002 | LOW | `mark_callback_result` accepts a callback target acknowledgement without requiring `DISPATCHED`/terminal request state. | A configured target can create a false callback state before delivery or toggle it after acknowledgement. |
| LOW-003 | LOW | Resolver URL canonicalization drops query strings and ports before evidence deduplication. | Distinct source representations can be collapsed, changing evidence coverage and policy counts. |
| INFO-001 | INFO | Template publication does not validate its default policy immediately. | A dangling template can be published and fail only when used. |
| INFO-002 | INFO | `STATUS_FAILED` is declared but no V1 path assigns it. | Clients must not wait for a `FAILED` request status as a normal terminal outcome. |

### HIGH-001 — URL validation bypasses private-address protection

- Affected contract/function: `EvidraRegistry.validate_seed_url`; shared by `request_fact`, `request_fact_by_template`, `refresh_fact`, and `request_reassessment` through `parse_seed_urls`; fetched by `EvidraResolver._fetch_source`.
- Exact condition: `validate_https_url` rejects literal private IPv4 and a few IPv6 prefixes, but does not reject IPv4-mapped IPv6 literals such as `https://[::ffff:127.0.0.1]/`, does not resolve hostnames before checking their destination, and does not revalidate redirect destinations.
- Reproducible path: finalized read `validate_seed_url("https://[::ffff:127.0.0.1]/")` returned `true`; the same read rejected `https://127.0.0.1/` and `https://localhost/`. A user can pass the accepted URL in a payable request, after which the resolver calls `gl.nondet.web.render` on it.
- Preconditions: the GenLayer web renderer must be able to reach the private destination or follow a redirect to it. The contract does not establish that isolation itself.
- Impact: a resolver execution may fetch internal services or validator-local resources and feed their content into the semantic prompt. That crosses the intended untrusted-public-web boundary and can influence a consensus result or leak internal content into evidence/LLM processing.
- Frontend/backend integration: both. Application validation is required but cannot protect direct public contract callers.
- Recommended remediation: reopen the contract only if the protocol is to guarantee this boundary; parse IP literals with a complete IP library, reject all loopback/link-local/private/multicast/reserved/mapped ranges, resolve DNS and enforce an allow policy at the fetcher, and disable or revalidate redirects. Until then, treat all resolver evidence as untrusted and do not promise “public URL only.”
- Contract change required: yes for protocol-wide protection; app-only URL validation is mitigation, not a fix.
- Frontend/backend mitigation possible: yes, reject the same classes before submit and surface that direct callers are outside the app guard.

This was unresolved and blocked the pre-patch certification under the original Phase 0 gate. The post-SSRF disposition is recorded in the addendum below.

## Post-SSRF V1 re-freeze addendum — 2026-09-21

The preceding sections record the pre-patch audit against the superseded deployment. HIGH-001 was reopened for a surgical fix only. The final source now uses a single strict `validate_https_url` implementation in `EvidraRegistry` for every Registry URL ingress and adds `EvidraResolver._validate_urls` immediately before any `gl.nondet.web.render` path.

The final validator accepts only HTTPS URLs with a normal DNS hostname, rejects every direct IP literal (IPv4, IPv6, IPv4-mapped IPv6, and obvious numeric encodings), localhost/local aliases, userinfo, fragments, malformed authority, whitespace/control characters, invalid labels, and explicit ports other than 443. Deployed negative tests for the mapped IPv6 bypass, loopback, IPv6 loopback, localhost, userinfo, and port 8080 all finalized with execution failure and left request/resolution counters unchanged. Template seed and reassessment supplemental ingress tests also finalized with execution failure.

The new Studio Dev 61997 deployment was source-verified against the final local hashes. A valid `example.com` HTTPS source reached a finalized `TRUE` resolution with an evidence manifest and ConsumerProbe callback delivery; a reassessment reached resolution version 2 with supplemental evidence first. The complete post-patch certification is in `SSRF_PATCH_CERTIFICATION.md`, `DEPLOYMENT_RECORD.md`, and `READ_CERTIFICATION.md`.

The runtime limitation remains explicit: contract code does not perform DNS resolution and cannot prove redirect destinations. Those controls remain GenVM Web Module responsibilities and are also mandatory application controls. MEDIUM-001 remains intended empty-allow-list semantics; MEDIUM-002 remains an informational/audit metadata boundary and was not changed.

Final HIGH-001 status: **CLOSED for direct contract-level URL ingress**. The old addresses are superseded; final addresses are recorded in `PROTOCOL_CLIENT_SPEC.md` and `DEPLOYMENT_RECORD.md`.

Final addresses: PolicyRegistry `0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71`, Registry `0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6`, Resolver `0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477`, ConsumerProbe `0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F`.

### MEDIUM-001 — Empty source allow-list is fail-open for UNKNOWN

- Affected contract/function: `EvidraPolicyRegistry.publish_source_policy`; `EvidraResolver._apply_source_policy` and `_policy_eval`.
- Exact condition: `allowed_classes=""` is accepted. With no disallowed class, zero minimum primary/independent counts, and `require_cross_check=false`, a usable `UNKNOWN` source remains eligible because `len(allowed)==0`; `eligible_usable>0` is enough for `policy_ok=true`.
- Impact: a policy author can unintentionally treat unknown/unclassified evidence as sufficient. This is not an unauthorized-policy mutation; it is a fail-open semantic default.
- Reproducible path: publish or inspect a policy with empty allow-list and zero minima, submit a fact whose source is heuristically `UNKNOWN`, and observe that the source can satisfy `eligible_usable` and the resolver can retain a boolean outcome. Existing frozen policies all use non-empty allow-lists, so live state did not trigger it.
- Frontend/backend integration: yes; policy editors must not present empty allow-list as “safe default.”
- Recommended remediation: require an explicit non-empty allow-list and reject `UNKNOWN`/`INVALID` as allowed classes, or change the resolver to treat an empty allow-list as no eligible classes. Document the chosen semantics before reopening V1.
- Contract change required: yes for fail-closed protocol semantics.
- Frontend/backend mitigation possible: yes for app-created policies, not for direct owner calls or existing policies.

### MEDIUM-002 — Evidence details are not consensus-bound

- Affected contract/function: `EvidraResolver.resolve_request`, inner `validator_fn`.
- Exact condition: the validator recomputes the resolution and compares only `claim_key`, `fact_key`, `spec_hash`, `policy_hash`, `outcome`, `diagnostic_reason`, and `policy_satisfied`. `evidence_manifest` and `reasoning_summary` are not compared.
- Impact: the committed manifest and summary come from the leader result even if the validator saw different URLs, source classes, hashes, or prose. The canonical boolean is protected by the selected critical fields, but evidence provenance is not independently equivalent.
- Reproducible path: inspect the equality at `evidra_resolver.py:1156-1161`; any two executions that agree on critical fields but differ in manifest/summary pass validation, and the leader manifest is passed to `commit_resolution` at `1171-1185`.
- Frontend/backend integration: yes. Evidence must be presented as a leader-produced on-chain manifest, not as a separately consensus-proven transcript.
- Recommended remediation: either include a canonicalized manifest digest/manifest fields in the equivalence-critical set or explicitly version the manifest as advisory output and expose the `critical-fields-only` limitation in the UI/API.
- Contract change required: only for stronger evidence attestation.
- Frontend/backend mitigation possible: yes; never derive verdicts from evidence, and show the manifest hash plus the resolver equivalence capability.

### MEDIUM-003 — Permissionless zero-surcharge growth has no protocol cap

- Affected contract/functions: `request_fact`, `request_fact_by_template`, `refresh_fact`, `request_reassessment`, `_append_history`, event arrays, and ConsumerProbe’s `processed_ids_json`.
- Exact condition: request and reassessment paths have no requester quota or per-fact limit. The verified deployment has all three protocol fee values set to zero. Every committed resolution appends to an unbounded JSON history string and an unbounded event array; the probe appends callback IDs without a cap.
- Impact: a caller still pays GenLayer network execution costs, but can create unbounded protocol requests and resolver/web/LLM work relative to those costs, grow read payloads, and make per-fact history increasingly expensive to parse/reconcile.
- Reproducible path: any account can call `request_reassessment` for an existing fact or submit a new `request_fact` without matching requester ownership. Each successful commit increments `resolution_count`, event count, and the fact history; no contract check bounds total history length.
- Frontend/backend integration: yes; indexers need bounded reads, backpressure, and reconciliation. This is not a reason to trust a database projection over chain state.
- Recommended remediation: consider a non-zero fee or rate/quota policy, bounded history/event storage, or a separately indexed append-only log design before a production deployment. For V1, use RPC and app-level rate limits as operational mitigation.
- Contract change required: yes for protocol-level limits.
- Frontend/backend mitigation possible: partially; an app can throttle its own clients but cannot stop direct chain callers.

### LOW-001 — Fee quote surface is narrower than write surface

- Affected contract/function: `EvidraRegistry.quote_resolution_fee` and payable request/retry paths.
- Exact condition: any mode other than exact `REUSE_IF_FRESH` is quoted as `fee_base + fee_per_attempt`; invalid modes are not rejected by the quote view, while `retry_resolution` actually charges `fee_per_attempt`.
- Preconditions: a client trusts the quote view for an invalid mode or for a retry transaction.
- Reproducible path: read `quote_resolution_fee("INVALID")` and compare it with `retry_resolution`; the former follows the non-reuse branch while retry uses `fee_per_attempt`.
- Impact: a client can display a wrong quote or submit an invalid write. No live loss was observed because verified protocol fees are zero.
- Frontend/backend integration: yes; fee UI and transaction preflight are affected.
- Recommended remediation: validate modes in the client, use `get_protocol_config` for retry fees, and treat the quote view as an estimate for new request paths only. A contract change would be optional strict validation, not required for the app mitigation.
- Contract change required: no for safe application integration; optional for a stricter quote API.
- Frontend/backend mitigation possible: yes, fully for app-originated requests; direct callers remain subject to the V1 behavior.

### LOW-002 — Callback acknowledgement has no delivery-state guard

- Affected contract/function: `EvidraRegistry.mark_callback_result` (source line 1432).
- Exact condition: after checking only that the request exists, has a nonzero callback target, and the sender equals that target, the method writes `ACKNOWLEDGED` or `FAILED_REPORTED`. It does not require the request to be `RESOLVED`/`REUSED` or the callback state to be `DISPATCHED`/`FAILED_REPORTED`.
- Preconditions: the configured callback target can submit a call for a known request ID.
- Reproducible path: call `mark_callback_result(request_id, true|false)` for a request before its callback dispatch, or call it again after `ACKNOWLEDGED`; the source accepts the state mutation because no callback-state predicate is evaluated.
- Impact: callback telemetry can claim acknowledgement or failure for a delivery that was never dispatched, and an acknowledged delivery can be changed to failed. This can suppress or mislead retry logic and UI/audit state, but does not change canonical resolution truth.
- Frontend/backend integration: yes. Treat acknowledgement as advisory and require the observed finalized callback dispatch event plus a monotonic callback-state policy in the projection.
- Recommended remediation: require request status `RESOLVED`/`REUSED` and callback state `DISPATCHED` or `FAILED_REPORTED`; reject transitions out of `ACKNOWLEDGED` unless an explicit retry dispatch resets the state.
- Contract change required: yes for an on-chain callback-state invariant.
- Frontend/backend mitigation possible: yes, but it cannot prevent a direct callback target from changing the frozen on-chain field.

### LOW-003 — Query and port are discarded for resolver URL deduplication

- Affected contract/function: `EvidraResolver._canonical_url` / `merge_resolution_urls` (source line 341).
- Exact condition: canonicalization keeps only lowercased host and path, removes the query, fragment, and explicit port, and then deduplicates supplemental-plus-seed URLs against that value.
- Preconditions: two submitted HTTPS URLs share host/path but differ by query or port.
- Reproducible path: provide `https://example.com/report?month=1` and `https://example.com/report?month=2` (or distinct explicit ports) in the accepted seed/supplemental lists; the resolver keeps only the first canonical key before fetching.
- Impact: distinct evidence views can be silently omitted; source counts, independence checks, and the manifest no longer represent every submitted source. This can change whether a policy is satisfied.
- Frontend/backend integration: yes. Do not promise that every submitted URL becomes an evidence entry; preserve the resolver’s manifest as authoritative.
- Recommended remediation: retain query and meaningful port in the canonical key, or explicitly define query/port-insensitive source identity and expose the deduplication rule.
- Contract change required: yes for full source-selection fidelity.
- Frontend/backend mitigation possible: partially; warn or reject query-varying duplicates before submission.

### INFO-001 — Dangling template publication is possible

- Affected contract/functions: `EvidraPolicyRegistry.publish_template`; `EvidraRegistry.request_fact_by_template`.
- Exact condition: publication does not check that `default_policy_id/default_policy_version` resolves to an active policy.
- Preconditions: owner publishes a template with a blank, unknown, or inactive default policy.
- Reproducible path: publish such a template, then call `request_fact_by_template`; request-time lookup fails with `INVALID_PARAM`, `UNKNOWN_POLICY`, or `POLICY_INACTIVE`.
- Impact: a public catalog can expose a template that cannot create a request.
- Frontend/backend integration: yes; template selection and catalog health are affected.
- Recommended remediation: validate the referenced policy during publication or have the backend hide invalid templates. Existing deployed templates point to active policies.
- Contract change required: no for application safety; yes only if publication-time invariant is desired.
- Frontend/backend mitigation possible: yes, by validating the exact historical policy before offering the template.

### INFO-002 — Declared but unreachable request status

- Affected contract/function surface: `EvidraRegistry.STATUS_FAILED` and all request status consumers.
- Exact condition: `STATUS_FAILED` is declared but no V1 public or internal path assigns it. Resolver failures are represented by `RESOLVED` plus `UNRESOLVED` and a diagnostic; write failures revert or fail execution.
- Preconditions: a client assumes every declared enum value is currently emitted.
- Reproducible path: static control-flow search finds no assignment to `STATUS_FAILED`; finalized live requests were `RESOLVED`/other active terminal states only.
- Impact: a client waiting for `FAILED` can remain stuck or mislabel an unresolved protocol outcome.
- Frontend/backend integration: yes; state-machine handling is affected.
- Recommended remediation: keep `FAILED` in forward-compatible decoders, but render current V1 resolver failure from `RESOLVED + UNRESOLVED + diagnostic`.
- Contract change required: no.
- Frontend/backend mitigation possible: yes, fully.

## Authorization conclusion

No missing resolver-only or callback-target-only caller guard was found in the frozen source:

- `commit_resolution` requires the request’s assigned resolver.
- `EvidraResolver.resolve_request` requires the frozen registry address.
- `EvidraConsumerProbe.on_evidra_result` requires its trusted registry.
- callback acknowledgement requires the configured callback target address, but the callback-state transition itself is under-validated (LOW-002).
- owner transfer is two-step on both owner-controlled contracts.
- guardian can pause; owner can pause/unpause and is accepted as guardian for the pause path.

Public request/reassessment operations are permissionless by design and must be treated as public protocol operations, not user-owned writes.

## State machine and lifecycle verification

The valid V1 request lifecycle is:

```text
new request → PENDING → DISPATCHED → RESOLVED
                         ├─ retry → PENDING/DISPATCHED with a new attempt
                         └─ cancel after stale → CANCELLED
new request → REUSED (fresh canonical resolution reused; no new resolution)
```

`RESOLVED` means a resolution was committed, not that the outcome is boolean. The outcome may be `TRUE`, `FALSE`, or `UNRESOLVED`. A retry requires the requester or owner, a non-terminal pending/dispatched request, elapsed `retry_after`, and remaining attempts. A stale cancellation also refunds recorded fee to the requester. `commit_resolution` requires the assigned resolver, matching active attempt, and matching claim/fact/spec/policy bindings; it can commit once per active attempt.

Every new resolution advances `latest_resolution_id` and appends history. Canonical advancement is separate: a policy-satisfied `TRUE`/`FALSE` advances; a new result advances when no prior fact exists or when prior canonical outcome was non-boolean; otherwise an `UNRESOLVED` result can remain latest without replacing an older canonical boolean. `resolution_version` and `supersedes_resolution_id` describe latest-history order, not canonical truth.

## Identity and cache semantics

- `claim_key = SHA256("EVIDRA_CLAIM_V1|" + compact_sorted_json(normalized subject, predicate, object_value, qualifiers, temporal, mutability))`.
- `fact_key = SHA256("EVIDRA_FACT_V1|" + compact_sorted_json(claim_key, policy_hash, schema_version, template_hash))`.
- `spec_hash = SHA256("EVIDRA_SPEC_V1|" + compact_sorted_json(description, normalized claim fields, mutability, schema_version, ttl_seconds, seed_urls))`.
- `policy_hash` and `template_hash` are hashes of their respective compact canonical record payloads with `EVIDRA_POLICY_V1|` and `EVIDRA_TEMPLATE_V1|` domains.
- `callback_id = SHA256("EVIDRA_CB_V1|" + request_id + "|" + resolution_id + "|" + lowercase consumer address)`.

Claim identity is semantic. Fact identity is claim plus policy/schema/template identity. TTL, description, seed URLs, reuse mode, callback target, and supplemental URLs do not change `fact_key`; TTL/seeds/description do affect `spec_hash`, while supplemental evidence is reassessment execution input. A backend must not use a fact-key cache as a substitute for current freshness or current/latest pointers.

## Canonical/latest and freshness

`FactRecord.current_resolution_id`, `current_outcome`, `resolved_at`, and `valid_until` are canonical fields. `FactRecord.latest_resolution_id` is only the newest committed attempt. The backend/frontend must read both pointers and never rename latest to canonical. `TRUE` and `FALSE` require `diagnostic_reason=NONE` at commit; `UNRESOLVED` is terminal for that resolution but may not replace an older canonical boolean.

`is_fact_fresh` is false for a missing fact or non-boolean canonical outcome. Immutable boolean facts are fresh with `valid_until=0`; mutable boolean facts are fresh only while `now <= valid_until`. `can_reuse_fact` and `can_reuse_with_freshness` additionally require matching policy hash, schema version, template hash, `REUSE_IF_FRESH`, and the V1 freshness rules. `FORCE_FRESH_RESOLUTION` bypasses reuse. Reassessment is supplemental-first, then seed URLs, deduplicated and capped at 12 total resolution sources.

## Source policy, templates, and evidence

Policies store allowed classes, disallowed classes, minimum primary sources, minimum independent sources, cross-check requirement, semantic rules, active/deprecated state, and a policy hash. A source entry records URL, source class, fetch status, provenance group, primary/independent flags, policy eligibility, evidence hash, relevant timestamp, and source origin. Primary classes are `OFFICIAL`/`PRIMARY`; independent grouping is counted once per provenance group; `DERIVED`, duplicates, `SOCIAL`, `INVALID`, unavailable entries, and disallowed classes cannot satisfy the policy. `SOURCE_POLICY_UNSATISFIED` is fail-closed for the normal configured policies, subject to MEDIUM-001’s empty-allow-list defect.

The resolver uses at most 8 initial seeds, 6 supplemental entries, and 12 total deduplicated URLs; URL length is 2048 and rendered content is bounded. The resolver deduplicates using host/path only, dropping query strings and explicit ports (LOW-003). The manifest hash is the hash of the committed manifest JSON, while each evidence entry’s hash is SHA-256 over the first 4096 rendered characters (Python strings encoded by the hash helper), not the full response. Evidence is provenance data, not an independently trusted verdict.

Templates are identified by exact ID/version/hash and store fact type, required fields, resolution instructions, and default policy ID/version. Deprecation affects future selection; it does not rewrite historical requests or facts. Existing facts must display their stored template version/hash, never the latest template.

## Callbacks, fees, and bounds

Callback state is `NOT_REQUESTED`, `DISPATCHED`, `ACKNOWLEDGED`, or `FAILED_REPORTED`. Registry computes the callback ID from request/resolution/target, emits the fixed `on_evidra_result` call on finalized, and accepts acknowledgement only from the recorded callback target. V1 does not enforce that the acknowledgement follows a dispatched callback or that `ACKNOWLEDGED` is immutable (LOW-002). Retry is allowed while `DISPATCHED` or `FAILED_REPORTED`, so consumers must deduplicate callback IDs. Callback success is not canonical resolution success.

The verified deployment has protocol fee values `fee_base=0`, `fee_per_attempt=0`, and `fee_reuse=0`. Network/consensus execution still costs GenLayer fees. Credits are chain state and are withdrawn by the credit owner. Event/history pages cap `limit` at 50; request/source/resolution payloads have bounded individual fields but aggregate history/event/callback-ID storage is not protocol-capped (MEDIUM-003).

## Prompt/web and IC-to-IC boundaries

The resolver places template rules, source policy, user context, and fetched pages into explicit prompt sections; fetched content is marked untrusted, template rules are authoritative, and user context cannot override template/policy rules. This is a semantic LLM boundary, not a cryptographic guarantee against prompt injection. The contract binds identity fields and resolver authorization but does not make evidence/reasoning consensus-equivalent (MEDIUM-002).

The Registry emits the Resolver call with `on="finalized"`; the Resolver later emits `commit_resolution` to the Registry with `on="finalized"`; a committed resolution emits the optional Consumer callback with `on="finalized"`. These are child messages, so a parent transaction hash/decision is not proof that the child state is durable. Before finalization the app may show progress only. After each successful finalized child, it must perform latest-final reads of the affected request/fact/resolution/callback state.

## Gate recommendation

The pre-patch gate above is historical. The post-SSRF source and new deployment satisfy the direct URL-ingress gate. DNS resolution and redirect destination filtering remain runtime/app responsibilities, not a contract claim. The overall Phase 0 gate remains blocked only because the historical 128-test freeze suite is absent from this checkout and cannot be rerun.

**PHASE 0 GATE: BLOCKED**

> The status above records the evidence state before the independent
> reconstructed regression suite was completed. The closure below supersedes
> that historical-suite blocker; it does not claim historical test recovery.

## Final reconstructed evidence closure — 2026-09-21

- The historical 128-test suite was unavailable and was **not** recovered.
- A new independent suite was reconstructed from the immutable contract
  sources, Phase 0 specifications, method/type/error inventories, security
  invariants, SSRF requirements, and deployed read behavior.
- The reconstructed suite contains 120 meaningful tests in 9 test files:
  120 passed, 0 failed, and 0 skipped. Security invariants I1–I23 passed
  23/23; focused SSRF regressions passed 10/10.
- Semantic validation passed all four contracts with `genvm-linter
  0.11.1rc2` and the cached header-pinned GenVM `v0.6.0-rc5` runner.
- Existing deployment read certification invoked 64/64 unique public views
  successfully with `latest-final` semantics, plus 15 meaningful state
  scenarios. No write or redeployment was performed.
- Read-only deployed bytecode/source identity and all four cross-contract
  relationships matched the final local source and frozen addresses.

The independent suite is source-derived for write/state-machine behavior and
the deployed certification is read-only by design. This is the permitted
closure evidence for the current candidate; it is not a historical 128-test
recovery claim.

HIGH-001 remains CLOSED. No Critical or High finding is open. Existing
Medium/Low/Info findings remain documented as non-blocking application or
operational limitations.

**PHASE 0 GATE: PASS**
