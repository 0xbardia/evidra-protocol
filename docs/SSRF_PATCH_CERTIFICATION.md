# Evidra Protocol V1 — SSRF Patch Certification

## Scope

This was a surgical HIGH-001 patch. Contracts were not modified after the
final deployment, no old deployment was upgraded in place, and no unrelated
protocol semantics were changed. The old addresses are superseded by the
stack in `DEPLOYMENT_RECORD.md`.

Changed contract files:

- `contracts/evidra_registry.py`: one strict URL validator shared by all
  Registry URL ingress paths.
- `contracts/evidra_resolver.py`: defensive Registry-backed URL validation
  immediately before Web fetch execution.

Unchanged contract files:

- `contracts/evidra_policy_registry.py`
- `contracts/evidra_consumer_probe.py`

The validator is a strict allow model: HTTPS only; non-empty ordinary DNS
hostname; ASCII DNS labels; no direct IP literal; no localhost/local alias;
no userinfo; no fragment; no control/whitespace character; no malformed
authority; and only implicit port or explicit port 443. URL length and source
count bounds remain unchanged. The contract deliberately does not resolve DNS
or inspect redirect destinations.

## URL ingress coverage

The shared Registry validator covers `request_fact`,
`request_fact_by_template`, `refresh_fact`, and `request_reassessment` seed or
supplemental URLs. The Resolver collects supplemental URLs first, then seeds,
and calls the Registry validator on every collected URL before the leader
function and before `gl.nondet.web.render`.

The local regression harness also statically verifies the ingress routing and
the Resolver guard. Deployed tests separately exercised request, template,
and reassessment paths.

## Local adversarial tests

`PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest discover -s tests -v`

Result: **10/10 passed**. Coverage includes accepted normal HTTPS domains and
`:443`; rejected non-HTTPS schemes, localhost aliases, every direct IPv4 and
IPv6 class including mapped IPv6, numeric encodings, userinfo, malformed
brackets/authority, non-443 ports, fragments, whitespace/control characters,
empty hosts, and malformed labels.

## Deployed negative tests

Each transaction below reached `FINALIZED` with `FINISHED_WITH_ERROR`. The
Registry protocol stats were unchanged (`request_count=2`,
`resolution_count=2`) across the tests, proving no request or Resolver
dispatch was created.

| Input | Ingress | Transaction | Result |
|---|---|---|---|
| `https://[::ffff:127.0.0.1]/` | `request_fact` | `0xc310f5806365f27b706882eab036bc195a6e1410b9471b59104adb7cc0015350` | PASS — rejected |
| `https://127.0.0.1/` | `request_fact` | `0x2eca34eeb347de2d0b9f8dab190dafd7ad9dc486857a3177aabd9283f97597e1` | PASS — rejected |
| `https://[::1]/` | `request_fact` | `0x4200d8a0d3e4f467162bfa7530949f8ca07035b6178529bb411e067d762dc35e` | PASS — rejected |
| `https://localhost/` | `request_fact` | `0xf6166cbc6b8bc6d54a5c7073487dfb015258a3f92092972d439b96e1894d5a8e` | PASS — rejected |
| `https://user@example.com/` | `request_fact` | `0x5774ae002e4f77f9f04102dd664626e93e16bb2450ea2a4648c93df57928d5f0` | PASS — rejected |
| `https://example.com:8080/` | `request_fact` | `0x75ec5800382f760746ef19b3a8eca6ffb0e1c39d4cebe64194debfc24e977b4d` | PASS — rejected |
| `https://[::ffff:127.0.0.1]/` | `request_fact_by_template` | `0x07e3285173fac46aad72f7583b25871fdec685d5ab4d5116309eb50d59d04b8c` | PASS — rejected |
| `https://example.com:8080/` | `request_reassessment` supplemental | `0x83b65a244b9dc8b1875fe544516cad740897ec45f6cfef7e2134d698ebe0acf8` | PASS — rejected |

No private service, cloud metadata endpoint, validator infrastructure, DNS
rebinding target, or network scan was used.

## Lint and compilation

`genvm-lint check` was run for all four contract files with the official
`genvm-linter 0.11.1rc2` prebuilt-tree path and the cached GenVM
`v0.6.0-rc5` runner tree. The header-pinned `py-genlayer` artifact
`5j/ycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng.zip` and its exact
`py-lib-genlayer-std` dependency were loaded. AST lint returned `passed=3`
and semantic validation returned `ok=true` for all four contracts: 12, 25,
48, and 5 methods respectively. Python compilation and deployed
schema/source verification also passed. The stable `genvm-linter 0.11.0`
path remains incompatible with this newer SDK layout; it was not substituted
for the pinned semantic run.

The cached exact runner ZIP SHA-256 values were:

- `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` →
  `2cbcc8389744c4321852d2c0b4bfcef0729bfd22467e2aaf0d4d204cf6f015eb`.
- `py-lib-genlayer-std:kzr02ndm9et4qkmbqpq5djjt5sme2yt76n7sz1qbzax0knt6mam0` →
  `9ff00155b44bb44bce8bbdae56ca5a2e68e17b47354f9f86ebfaba09d746a2a8`.

## Runtime residual

The public RPC does not expose hosted Studio Dev Web Module version or
configuration parity with the inspected reference implementation. This patch
therefore closes direct contract-level dangerous URL ingress, not DNS or
redirect SSRF in the runtime. GenVM Web remains responsible for resolving
hostnames safely, rejecting prohibited resolved destinations, and revalidating
redirect hops. The future app must retain its own SSRF-safe URL/display rules.

## Other findings

- MEDIUM-001 is intended V1 semantics: an explicitly empty `allowed_classes`
  value means unrestricted source classes. It was not changed.
- MEDIUM-002 is a LOW informational provenance limitation: evidence manifest
  and reasoning text are not verdict-equivalence fields. It was not changed.

## Classification

**HIGH-001: CLOSED for direct contract-level URL ingress.**

**PHASE 0 GATE: BLOCKED**

Blocker: this checkout contains no historical 128-test freeze suite and the
remote repository is empty, so the required “entire old suite still passes”
regression cannot be independently demonstrated. The available post-patch
suite is 10/10, the deployed lifecycle/read certifications pass, and semantic
lint now passes; this evidence gap is not a new contract security finding, but
the user-specified gate must remain closed until the historical suite is
restored and rerun.
