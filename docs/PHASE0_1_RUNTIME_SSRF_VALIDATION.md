# Evidra Phase 0.1 — Runtime Security Validation

> Historical runtime validation from 2026-09-21, not a v1.0.0 production health report. Current frozen deployment details are in [`DEPLOYMENT_RECORD.md`](DEPLOYMENT_RECORD.md); release status is in [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md).

Audit date: 2026-09-21  
Scope: HIGH-001 runtime validation only  
Network checked: GenLayer Studio Dev, chain `61997`  
Frozen RPC: `https://studio-dev.genlayer.com/api`

This document retains the historical runtime-only CASE C result below. The
post-SSRF contract patch and re-freeze certification are recorded in the final
section; they close direct URL-ingress risk without claiming hosted Web Module
parity or implementing DNS inside the contracts.

## Executive result

This validation is **CASE C — hosted runtime parity cannot be proven**.

The current public GenVM reference implementation inspected here contains
substantial SSRF controls:

- `Request` uses a DNS resolver that removes non-globally-routable addresses,
  explicitly handles IPv4-mapped IPv6 addresses, and rechecks redirect hops.
- `Render` uses a browser-side request-interception guard that resolves every
  request, blocks loopback/private/link-local/unique-local/mapped addresses,
  and checks redirects and subresources as they occur.

The local environment does not contain a production-equivalent GenVM/Webdriver
runtime, and Studio Dev exposes no public runtime-version or web-module-config
RPC. Therefore the inspected implementation cannot be treated as proof that
the validators serving chain `61997` run the same version and configuration.

The superseded pre-patch contract parser accepted the HIGH-001 input. No
exploit against Studio Dev was attempted in the runtime-only audit, and no
claim that Studio Dev is protected by runtime configuration alone is made.

## 1. Safety and read-only boundary

Completed actions:

- inspected public GenVM source, configuration, documentation, and tests;
- inspected the local GenLayer test/simulator installation;
- queried only read-only Studio Dev RPC methods;
- used a local HTTP server only for harness characterization.

Not performed:

- no contract source modification;
- no deployment or write transaction;
- no contract method that creates, refreshes, reassesses, retries, commits, or
  callbacks;
- no cloud-metadata, private-service, validator-infrastructure, network-scan,
  credential, DNS-rebinding, or third-party internal probe.

## 2. Runtime and deployment evidence

The deployment addresses recorded in this historical validation are the
pre-SSRF deployment and are SUPERSEDED. They remain only for audit provenance;
current application configuration must use the post-SSRF V1 addresses.

### Local artifacts

| Artifact | Observed value | Security meaning |
|---|---|---|
| GenLayer CLI | `0.39.2` | CLI version only; it does not identify the hosted Web module. |
| `genlayer-test` | `0.30.0rc2` | Local test package; its direct VM is a mock-based harness. |
| `glsim` | `0.30.0-rc.2` | Local simulator; its live I/O uses ordinary browser/http clients and is not production GenVM SSRF enforcement. |
| Cached universal bundle | `genvm-universal-v0.6.0-rc5` | Targeted archive inspection showed runner artifacts, including executor runner `v0.2.17`; no runnable Web module/Webdriver pair was available for this audit. |
| Reference Web implementation | `genvm-manager` commit [`89c20400f77b647b0e7649f58be0212a4bd6f004`](https://github.com/genlayerlabs/genvm-manager/tree/89c20400f77b647b0e7649f58be0212a4bd6f004) | Exact source revision inspected below; not proven to be the Studio Dev validator revision. |
| Executor source reference | `genvm-executor` branch `v0.3.x`, commit `acb37c7bf7b1e6d9fbfe004414a93fb6306135c0` | Source context only; not a hosted-runtime attestation. |

The available `gltest` direct VM is explicitly mock-oriented. Its optional
`glsim` live I/O implementation uses `httpx` with redirects enabled and
Playwright without the GenVM SSRF guard. A local-server characterization was
attempted, but the environment did not have `httpx`, so it returned a harness
502 before connecting. This result is neither a safe nor unsafe GenVM result.

### Studio Dev read-only observations

| Read | Result |
|---|---|
| `eth_chainId` | `0xf22d` = `61997` |
| `net_version` | `61997` |
| `gen_getContractCode` for all four frozen addresses | Non-empty result for each address |
| `eth_getBlockByNumber("finalized", false)` | Unsupported: `Invalid block number format: finalized` |
| `eth_getBlockByNumber("latest", false)` | Successful |
| `gen_version`, `gen_getVersion`, `gen_getRuntimeVersion`, `gen_getConfig`, `gen_getNetworkInfo` | Unsupported: JSON-RPC `-32601 Method not found` |

The frozen deployment is reachable on the requested chain. Public RPC reads do
not expose the GenVM Web module version, its `extra_tld`, its
`always_allow_hosts`, or its resolver/browser image configuration.

The four addresses checked were:

- PolicyRegistry: `0x2954E162E439d1d626159e2Ada8ee2DF9fF09CD6`
- Registry: `0x885a61c9e72E4E11b98E8054B90D08809C6e3402`
- Resolver: `0x47B2a9278A3034DEA88feE1B4a1DeB3475418de9`
- ConsumerProbe: `0x3b3cB8e1711588DBa31efC69c847d68Df3D68086`

## 3. Exact Web implementation inspected

The public GenLayer validator documentation identifies
`genvm-module-web.yaml` as the Web access configuration and
`genvm-web-default.lua` as the implementation of `Render` and `Request`:
[GenVM configuration](https://docs.genlayer.com/validators/genvm-configuration).

### Contract-facing URL parser and first policy gate

The Lua Web module calls `lib.rs.split_url`. The Rust binding implements it in
[`implementation/src/scripting/ctx/dflt.rs`](https://github.com/genlayerlabs/genvm-manager/blob/89c20400f77b647b0e7649f58be0212a4bd6f004/implementation/src/scripting/ctx/dflt.rs):

```text
reqwest::Url::parse(url)
```

It returns the parsed scheme, optional port, and host string.

[`lib-web.lua`](https://github.com/genlayerlabs/genvm-manager/blob/89c20400f77b647b0e7649f58be0212a4bd6f004/install/lib/genvm-lua/lib-web.lua)
then applies:

1. only `http` and `https` schemes;
2. only port `80` or `443`, unless the host is allowlisted;
3. an IANA TLD table plus configured `extra_tld` values, unless the host is
   allowlisted;
4. no DNS resolution;
5. no IP-range classification itself;
6. no redirect processing itself.

The reference default configuration sets:

```yaml
extra_tld: []
always_allow_hosts: []
```

Source: [`genvm-module-web.yaml`](https://github.com/genlayerlabs/genvm-manager/blob/89c20400f77b647b0e7649f58be0212a4bd6f004/install/config/genvm-module-web.yaml).

`always_allow_hosts` is security-significant. A matching host bypasses the Lua
port/TLD checks and makes `Request` use the unfiltered client. It is intended
for operator-trusted endpoints, not user-controlled source URLs. Its Studio Dev
value is unknown.

The frozen Evidra input
`https://[::ffff:127.0.0.1]/` therefore passes Evidra's contract parser, but
the reference GenVM Lua gate does not provide a contract-independent IP
guarantee. Under the default TLD table it is rejected by the Web module's TLD
check before network access; if an operator adds a matching `extra_tld` or
allowlist entry, the downstream network guards become the relevant control.

### `gl.nondet.web.request`

The reference [`genvm-web-default.lua`](https://github.com/genlayerlabs/genvm-manager/blob/89c20400f77b647b0e7649f58be0212a4bd6f004/install/config/genvm-web-default.lua)
passes normal contract URLs through the filtered client. The production Web
handler creates its execution context with `filter_dns = true`:
[`handler.rs`](https://github.com/genlayerlabs/genvm-manager/blob/89c20400f77b647b0e7649f58be0212a4bd6f004/implementation/src/web/handler.rs).

The filtered client in
[`common/mod.rs`](https://github.com/genlayerlabs/genvm-manager/blob/89c20400f77b647b0e7649f58be0212a4bd6f004/implementation/src/common/mod.rs)
has these properties:

- uses Hickory DNS and asks for both A and AAAA results;
- drops every resolved address classified as non-globally-routable;
- returns `ADDRESS_FORBIDDEN` when no routable address remains;
- keeps the hostname in the URL for TLS SNI, certificate validation, and the
  Host header;
- does not perform a second unfiltered DNS lookup for the contract URL;
- if a name resolves to both public and private addresses, drops the private
  answers and can continue with the public answers;
- uses a redirect policy with a maximum of 10 hops;
- rejects a redirect to a non-globally-routable IP literal, which would
  otherwise bypass DNS filtering;
- resolves and filters hostname redirect targets on the next connection;
- rejects HTTPS-to-HTTP downgrade redirects.

The direct initial IP-literal path deserves separate attention: reqwest does
not send an IP literal through the DNS resolver. The default Lua TLD policy
normally rejects ordinary IP-literal URLs first. If `extra_tld` or
`always_allow_hosts` is changed to admit such a host, the unfiltered allowlist
path is an explicit operator configuration and not a user URL safety guarantee.

### Request IP classification

The Rust reference code classifies these IPv4 ranges as bad:

- unspecified `0.0.0.0/8`;
- RFC1918 `10/8`, `172.16/12`, `192.168/16`;
- loopback `127/8`;
- link-local `169.254/16`;
- CGNAT `100.64/10`;
- documentation ranges through `Ipv4Addr::is_documentation()`;
- broadcast and `224.0.0.0/3` multicast/reserved space.

For IPv6 it rejects unspecified, `::1`, unique-local `fc00::/7`,
link-local `fe80::/10`, and multicast `ff00::/8`. It explicitly converts
IPv4-mapped IPv6 (`::ffff:a.b.c.d`) to IPv4 and applies the IPv4 checks.

The Request implementation does **not** contain the browser guard's explicit
`fec0::/10` deprecated site-local check, nor an equivalent complete “all
reserved IPv6” table. This is a residual implementation difference. It was not
probed, because doing so would require access to a local IPv6 service and is
not necessary to establish the Studio parity blocker.

### `gl.nondet.web.render`

`Render` first calls the same Lua `check_url`, but it does not send the target
URL through the filtered Rust client. It sends an unfiltered request only to
the configured local Webdriver sidecar, with the contract URL encoded as a
query parameter:

Source: [`genvm-web-default.lua`](https://github.com/genlayerlabs/genvm-manager/blob/89c20400f77b647b0e7649f58be0212a4bd6f004/install/config/genvm-web-default.lua).

The browser-side guard in
[`webdriver/src/prj/src/ssrf.ts`](https://github.com/genlayerlabs/genvm-manager/blob/89c20400f77b647b0e7649f58be0212a4bd6f004/webdriver/src/prj/src/ssrf.ts)
does the target protection:

- Node WHATWG `URL` parses the browser request URL;
- `http`, `https`, `ws`, and `wss` are network schemes;
- malformed, unsupported, or DNS-failing targets are blocked;
- `dns.lookup(..., { all: true })` resolves hostnames;
- IP literals are treated as themselves;
- the request is blocked if **any** resolved address is bad;
- IPv4-mapped IPv6 is converted to IPv4 and checked;
- loopback, unspecified, RFC1918, link-local, CGNAT, documentation,
  multicast/reserved IPv4, ULA, IPv6 link-local, deprecated IPv6 site-local,
  and multicast addresses are blocked;
- the interception handler is installed before navigation;
- every browser request is intercepted, including top-level navigation,
  subresources, and each redirect hop;
- unexpected popup targets are closed, and Chrome is launched with
  `--block-new-web-contents`;
- `data:`, `blob:`, and `about:` are networkless schemes allowed by the browser
  guard itself, but the public GenVM Lua API admits only HTTP(S) target URLs.

The source documents a remaining low-TTL race: the guard's DNS resolution and
Chrome's connection resolution are separate operations. The guard fails closed
when any returned address is bad, but this is not a cryptographic DNS-binding
guarantee.

## 4. Controlled tests and results

No production-equivalent local GenVM/Webdriver pair was available to execute
the tests end-to-end. The results below distinguish reference-source behavior
and upstream controlled tests from local execution. No external private
endpoint was contacted.

| Test | render | request | result |
|---|---|---|---|
| `127.0.0.1` | Lua default TLD gate rejects; browser guard would reject if reached | Lua default TLD gate rejects a raw IP literal; if admitted by configuration, an initial IP literal does not traverse the DNS resolver | Reference source says blocked under default configuration; not a Studio Dev execution |
| `127.1` | URL normalization/guard path is fail-closed if it resolves to loopback | Same default TLD/configuration caveat as other raw IP literals | No live GenVM execution; unusual short IPv4 form not separately executed |
| `::1` | Lua gate rejects; browser `ipv6IsBad` rejects loopback | Lua gate rejects; filtered resolver/redirect IP check rejects when reached | Reference source says blocked; no hosted parity proof |
| `::ffff:127.0.0.1` | Explicit IPv4-mapped handling returns blocked | Explicit Rust IPv4-mapped handling returns bad; default Lua TLD gate also rejects the literal | This is blocked by the inspected reference implementation; Studio configuration/version remains unverified |
| `10.0.0.1`, `172.16.0.1`, `192.168.0.1` | Browser IPv4 policy blocks RFC1918 | Filtered resolver drops RFC1918 answers; raw literals normally fail Lua TLD policy | Blocked in reference source; no connection attempted |
| `169.254.x.x` | Browser IPv4 policy blocks link-local | Filtered resolver drops link-local answers; raw literals normally fail Lua TLD policy | Blocked in reference source; no metadata endpoint was probed |
| `fc00::/7` / `fd00::/8` | Browser IPv6 policy blocks ULA | Rust IPv6 policy blocks unique-local addresses | Blocked in reference source; no connection attempted |
| IPv6 link-local `fe80::/10` | Browser policy blocks | Rust policy blocks | Blocked in reference source; no connection attempted |
| IPv4-mapped or encoded alternate forms | Browser parser plus explicit mapped check is fail-closed for a normalized mapped IP | Rust mapped check is explicit once parsed as an IP; direct unusual forms were not separately run | No exhaustive alternate-representation claim; hosted parser parity remains unverified |
| Hostname resolving only to loopback | Browser resolves all answers and blocks if any is bad | Upstream `test_filtering_resolver_rejects_loopback_host` uses `localhost.direct` and expects non-fatal `ADDRESS_FORBIDDEN` | Controlled upstream test demonstrates rejection in the reference Request path |
| Public-looking URL redirecting to `127.0.0.1` | Every browser redirect request is intercepted and blocked | Upstream `test_redirect_to_private_ip_is_rejected` uses a local redirect server and expects `ADDRESS_FORBIDDEN` | Redirect revalidation is present in both reference paths |
| Public-looking URL redirecting to a private hostname | Browser checks the redirect hop's DNS answers | The next hostname hop is passed through the filtered resolver | Source-derived; no third-party/private target contacted |
| Local owned HTTP server | Available local simulator could not run live I/O because `httpx` is absent; no production GenVM result | Same | Local harness is not suitable evidence of GenVM SSRF enforcement |

The two relevant upstream controlled tests are:

- [`implementation/tests/request_localhost.rs`](https://github.com/genlayerlabs/genvm-manager/blob/89c20400f77b647b0e7649f58be0212a4bd6f004/implementation/tests/request_localhost.rs), which tests a loopback-only hostname, an unfiltered allowlisted client, and a redirect to a private IP literal;
- [`implementation/tests/web_render_webdriver.rs`](https://github.com/genlayerlabs/genvm-manager/blob/89c20400f77b647b0e7649f58be0212a4bd6f004/implementation/tests/web_render_webdriver.rs), which proves the Webdriver sidecar hop is deliberately unfiltered while contract-driven `Request` traffic remains filtered. Its loopback server is the trusted sidecar, not the contract target.

## 5. DNS and redirect conclusions

### DNS order

For `Request`, the reference path is:

```text
Lua syntax/TLD check
  -> filtered Hickory DNS lookup at connection time
  -> remove non-global addresses
  -> connect only to remaining address
```

This is stronger than a hostname-only precheck and avoids a second ordinary
resolver lookup. A mixed public/private DNS answer is not an all-or-nothing
hostname rejection: private answers are removed and a remaining public answer
may be used.

For `Render`, the path is:

```text
Lua syntax/TLD check
  -> Webdriver
  -> browser request interception
  -> Node DNS lookup of every request target
  -> abort if any answer is non-global
  -> Chrome connection
```

Render blocks if any answer is unsafe, but Chrome resolves separately. The
implementation documents the resulting low-TTL race as a residual limitation.

### Redirect order

`Request` revalidates redirect hops through both the custom redirect policy and
the filtered resolver. `Render` receives a new interception event for each
redirect hop and applies the guard again. A contract URL that passes the first
Lua check is therefore not automatically allowed to reach a prohibited
redirect destination in the inspected reference implementation.

No external DNS rebinding, private-network scan, metadata request, or hosted
redirect test was performed.

## 6. Studio Dev relevance and unresolved parity

The frozen RPC endpoint is the requested chain `61997`, and the four frozen
contracts are readable. That verifies the contract deployment boundary only.

The following cannot be established from the public endpoint:

- validator GenVM manager commit or release;
- Web module Lua script revision;
- Webdriver/Chromium image revision;
- `extra_tld` value;
- `always_allow_hosts` value;
- whether Studio Dev includes the Rust mapped-IPv6 and redirect fixes from the
  inspected reference commit;
- whether all validators run the same Web policy.

The unavailable `gen_version`/configuration RPCs are evidence of missing public
attestation, not evidence that Studio Dev is old or unsafe. The local cached
bundle and the reference GitHub source are also not proof of hosted parity.

## 7. HIGH-001 classification

### Status

**UNVERIFIED**

### Severity

**HIGH pending hosted-runtime parity.**

This is not a claim that SSRF was observed. It is the conservative status for a
contract-level bypass whose safety depends on an unverified external runtime
policy and configuration.

### Reasoning

The inspected reference implementation materially mitigates the original
`::ffff:127.0.0.1` path and the common loopback/private/redirect paths. The
contract itself still accepts the URL, and the hosted runtime cannot be tied to
the inspected source/configuration through public evidence. The `Request`
allowlist escape hatch and the difference between raw IP literals and DNS
resolution add configuration-sensitive residual risk.

Under CASE C, HIGH-001 must not be called “confirmed exploitable” and must not
be downgraded to a defense-in-depth finding until Studio Dev parity is pinned
or a safe hosted rejection test is independently authorized and completed.

If parity is formally pinned to a configuration with an empty allowlist,
standard TLD table, filtered Request client, and guarded Render sidecar, the
appropriate reclassification is **LOW** (or **INFO** only if that runtime
policy is an explicit operational invariant). The contract gap would remain a
defense-in-depth issue, but the SSRF impact would be runtime-mitigated.

### Contract change required

**YES for a protocol-wide guarantee independent of GenVM configuration.**

No contract change is authorized or made in Phase 0.1. If the owner accepts a
formally pinned runtime as the security boundary, a contract change is not
required to close the specific SSRF impact; the contract parser should still be
reopened later if the protocol must guarantee public-only source URLs to every
caller and every future runtime.

### Smallest remediation if V1 is reopened

At the contract boundary, normalize URLs with a complete URL/IP parser and
reject all loopback, unspecified, link-local, RFC1918, unique-local,
multicast/reserved, and IPv4-mapped destinations before accepting seed URLs.
Retain runtime DNS and redirect enforcement because contract code alone cannot
reliably observe validator DNS or every redirect hop.

## 8. Other reclassification

### MEDIUM-001 — empty `allowed_classes`

**Reclassified: INFO — intended V1 semantics, not a bypass outside that case.**

The frozen V1 resolver explicitly treats an empty `allowed_classes` value as an
unrestricted source-class policy, subject to disallowed classes, source status,
and the configured primary/independence/cross-check minima. The source-policy
implementation makes `UNKNOWN` eligible when the allow-list is intentionally
empty; that is the defined meaning of an unrestricted allow-list.

This is still a product and operator footgun if a UI describes an empty list as
“no sources allowed” or silently creates an unrestricted policy. The backend and
frontend must label it **unrestricted source classes** and must not call it
fail-closed. No contract semantic change is recommended for this item.

### MEDIUM-002 — evidence manifest and reasoning summary

**Reclassified: LOW — informational provenance limitation, not verdict or fact
identity corruption.**

The resolver's equivalence check compares these consensus-critical fields:

- request-bound `claim_key`;
- request-bound `fact_key`;
- request-bound `spec_hash`;
- request-bound `policy_hash`;
- `outcome`;
- `diagnostic_reason`;
- `policy_satisfied`.

`commit_resolution` also requires the resolver to submit the request-bound
identity fields and the Registry derives the canonical Fact identity from the
request. Canonical advancement depends on `outcome` and `policy_satisfied`,
not on the manifest or prose. `valid_until` is derived/normalized from the
request's mutability and TTL rules; it is not free-form reasoning output.

The `evidence_manifest_json` and `reasoning_summary` are stored and hashed as
leader-produced audit metadata. They can differ from an independent validator's
manifest/prose without changing the consensus outcome, policy flag, or
canonical fact identity. The manifest is therefore not an independently
consensus-certified transcript.

Required application rule:

> Present the outcome, diagnostic, policy flag, and identity bindings as
> consensus-bound. Present evidence and reasoning as committed leader metadata
> with its on-chain hash; never describe free-form evidence wording or
> reasoning as validator-certified truth.

## 9. Phase 1 decision

Do not start backend or frontend implementation from this validation alone.

The reference runtime evidence is strong enough to support a future LOW/INFO
reclassification, but the exact Studio Dev Web runtime and configuration remain
unattested. The owner should choose one of these closure paths before treating
HIGH-001 as resolved:

1. provide a pinned Studio Dev validator/runtime/config attestation matching the
   inspected guards; or
2. authorize a safe hosted test using only a project-owned endpoint and a
   project-owned loopback/private rejection target; or
3. reopen V1 and add contract-level URL normalization/rejection.

## 10. Final phase gate

The frozen contracts remain untouched and no blockchain write was sent.

Because Studio Dev parity is materially unresolved, this Phase 0.1 validation
does not certify that the application can safely rely on the runtime guard.

**PHASE 0 GATE: BLOCKED**

## 11. Post-SSRF contract defense and final classification

The historical gate above applied to the superseded deployment. The surgical
patch changed only the URL trust boundary:

- `EvidraRegistry.validate_https_url` now uses a strict HTTPS/domain-only
  allow model, rejects all direct IP literals including IPv4-mapped IPv6,
  localhost/local aliases, userinfo, fragments, malformed authority,
  whitespace/control characters, invalid labels, and explicit ports other than
  443;
- `request_fact`, `request_fact_by_template`, `refresh_fact`, and
  `request_reassessment` all route URL strings through that shared validator;
- `EvidraResolver.resolve_request` revalidates every collected seed or
  supplemental URL through the Registry before entering the leader function or
  any `gl.nondet.web.render` call.

The new Studio Dev deployment rejected the mapped IPv6 bypass, loopback,
IPv6-loopback, localhost, userinfo, and port-8080 inputs with finalized
execution failures. Template seed and reassessment supplemental invalid URL
tests also failed before request creation; request and resolution counters did
not change. A valid `https://example.com/` source completed a real Web/LLM
resolution, canonical commit, evidence-manifest write, and ConsumerProbe
callback. All 64 public view methods passed the fresh read certification.

### Final runtime boundary

Hosted Studio Dev runtime version/configuration parity with the inspected
reference Web implementation remains unprovable through public RPC. The patch
therefore does not claim that the runtime alone blocks SSRF. Contract code does
not resolve DNS or inspect redirect destinations. Those controls remain
GenVM Web Module responsibilities and mandatory future application controls.

### Final HIGH-001 classification

**HIGH-001: CLOSED for direct contract-level URL ingress.** The former
`https://[::ffff:127.0.0.1]/` bypass is rejected by the final Registry and by
the Resolver’s defensive pre-fetch guard. The residual DNS/redirect runtime
dependency is not a contract validation bypass.

**PHASE 0 GATE: BLOCKED**

The direct HIGH-001 URL-ingress defect is closed, but the overall gate remains
blocked because the historical 128-test freeze suite is not present in this
checkout and could not be rerun.
