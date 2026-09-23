# Evidra Protocol V1 — Frontend Integration Specification

This is a Phase 1/2 handoff. It specifies data and state handling; it does not implement the frontend.

## Global UI rules

- Read public data from the backend projection for list/search surfaces, then use finalized contract reads for canonical/freshness-sensitive detail states.
- Always show chain `61997`, frozen contract identity, observation time, and a link to the Studio Dev explorer when transaction data exists.
- Keep canonical resolution and latest resolution in separate visual blocks and separate API fields.
- `UNRESOLVED` is a valid completed protocol outcome, not a network error.
- `DISPATCHED` callback status is sent/awaiting acknowledgement, never “delivered.”
- `valid_until=0` means immutable in the V1 fact model; it is not “expired.”
- Hashes, IDs, addresses, URLs, and transaction IDs use truncated display with copy-to-clipboard and full accessible text.
- Do not render evidence HTML. Display sanitized URL text and normalized manifest fields only.

## Surface map

| Surface | Data source/read methods | Writes | Wallet? | Finalization | Loading/error/empty/stale |
|---|---|---|---|---|---|
| Landing | Backend aggregate/status; registry config/version | None | No | Status is informational | Skeleton; RPC degraded banner; no-facts empty state |
| Overview | `get_protocol_stats`, `get_protocol_config`; backend aggregates | None | No | Show last finalized observation | Loading cards; stale projection timestamp; paused banner |
| Create Fact | Policies/templates from backend and finalized `get_source_policy`/`get_template`; config and fee quote | `request_fact` or `request_fact_by_template` | Yes | Do not show resulting Fact as final until write + resolver child finalize | Field errors, policy/template inactive, paused, fee/network rejection, pending/decided/finalized |
| Fact Registry | Backend search/list; periodic finalized stats | None or link to detail | No | List indicates projection time | Empty registry; rate-limit retry; stale projection badge |
| Fact Detail | `get_fact`, `get_current_resolution`, `get_latest_resolution`, `get_evidence_manifest`, `get_request`, `get_resolution_history`; backend enrichment | `refresh_fact`, `request_reassessment`, optional callback retry, retry/cancel where authorized | Yes for writes | Freshness/canonical block must be finalized | Unknown key, unresolved, stale, pending child, callback pending |
| Resolution History | `get_resolution_history`, `get_resolution`, manifests | None | No | Read finalized only | Empty history; pagination; missing manifest warning |
| Evidence | `get_evidence_manifest`; backend normalized entries | None | No | Show manifest hash/observed final state | Unavailable/derived/duplicate source states; no raw HTML |
| Policies | Policy registry reads/events/backend | Admin-only publish/deprecate outside public app | No for public | Finalized policy snapshot | Empty, deprecated, dangling default policy warning |
| Templates | Template reads/events/backend | Admin-only publish/deprecate outside public app | No for public | Finalized historical version | Empty, deprecated, invalid default policy warning |
| Activity | Registry/policy event pages and backend transaction feed | None | No | Event pages read final | Pagination and projection lag states |
| Developers | Client/method/type/error docs, network constants | None | No | N/A | SDK compatibility notice; frozen deployment warning |
| Docs | Static product/protocol docs | None | No | N/A | Static loading only |

## Create Fact wizard

The wizard must choose one of two exact contract methods. Do not present controls that have no contract representation.

### 1. Fact specification

| UI field | Custom request parameter | Template request parameter | Rules |
|---|---|---|---|
| Subject | `subject` | `subject` | Required, trimmed, max 1024 chars by registry. |
| Predicate | `predicate` | `predicate` | Required, max 1024. |
| Object value | `object_value` | `object_value` | Optional, max 1024. |
| Qualifiers | `qualifiers` | `qualifiers` | Optional, max 1024. |
| Temporal | `temporal` | `temporal` | Optional custom; required when selected template lists it. |
| Schema version | `schema_version` = `"1"` | Fixed internally to `"1"` | Not an end-user choice; V1 rejects other schema versions. |
| Description/user context | `description` | `description` | Optional, max 2048; never treated as protocol authority. |

Custom call order:

```text
request_fact(
  subject, predicate, object_value, qualifiers, temporal,
  mutability, schema_version, ttl_seconds, description,
  policy_id, policy_version, seed_urls_json, callback_target, reuse_mode
)
```

### 2. Template selection / custom

- Custom mode exposes an explicit policy ID/version and uses `request_fact`.
- Template mode exposes `template_id` and exact `template_version`, then uses `request_fact_by_template`.
- Template mode obtains its policy ID/version, required fields, fact type, and resolution instructions from the selected template. The user cannot override the template’s default policy through this method.
- “Latest template” is a selection convenience only. Store and submit the exact version selected; historical facts retain their original version/hash.

Template call order:

```text
request_fact_by_template(
  template_id, template_version,
  subject, predicate, object_value, qualifiers, temporal,
  mutability, ttl_seconds, description,
  seed_urls_json, callback_target, reuse_mode
)
```

### 3. Source policy

- Custom: select an active policy ID/version; read and display its hash, source classes, minimums, cross-check rule, and semantic rules.
- Template: display the template’s default policy snapshot; do not silently substitute the latest policy.
- Distinguish “policy active” from “policy satisfied by this resolution.”
- Do not let an empty allow-list look like a safe default because of MEDIUM-001.

### 4. Mutability / freshness

- `IMMUTABLE`: set `ttl_seconds=0` in the UI. The contract accepts a value but canonical `valid_until` is forced to zero.
- `MUTABLE_WITH_TTL`: require positive `ttl_seconds` and show the resulting `valid_until` only after resolution.
- Explain that immutable facts can still be reassessed; immutable means reuse/freshness behavior, not permission to prohibit later resolutions.

### 5. Seed evidence

- Accept only the final Registry’s strict HTTPS/domain-only model: max 8 configured initial entries, each max 2048 characters; no direct IP literal, localhost/local alias, userinfo, fragment, malformed authority, control/whitespace character, invalid label, or explicit port other than 443.
- Deduplicate client-side but preserve the JSON array form submitted to the contract.
- Keep app-level SSRF validation even though HIGH-001 is closed: contract validation removes direct IP-literal/local ingress, while DNS resolution and redirect destination filtering remain GenVM Web responsibilities. If the app fetches or previews a URL itself, reject loopback, link-local, private, reserved, mapped, and DNS-resolved private targets.
- Supplemental evidence is not a Create Fact field; it is used by reassessment and is consumed before original seeds.

### 6. Reuse mode

- `REUSE_IF_FRESH`: default. Read `can_reuse_with_freshness` when previewing a known fact, but the write remains the authority.
- `FORCE_FRESH_RESOLUTION`: use only when the user explicitly requests a new resolution.
- The same fact identity can have multiple requests/resolutions; reuse creates a `REUSED` request without a new resolution.

### 7. Callback (optional)

- `callback_target` is an address string; blank means no callback.
- There is no callback method-name field. The registry calls fixed `on_evidra_result`.
- Public product UI should default blank unless the user is a developer integrating a consumer contract.
- Display callback status separately from outcome; `DISPATCHED` is not `ACKNOWLEDGED`. V1 authenticates the target but does not enforce callback-state ordering, so even `ACKNOWLEDGED` is delivery telemetry rather than canonical resolution proof (LOW-002).

### 8. Review

Show exact normalized values, selected policy/template snapshots and hashes, seed JSON, mutability/TTL, reuse mode, callback target, chain ID, and target Registry address. Show that policy/template hashes and fact key are chain-derived.

### 9. Fee quote

- For a new request, call `quote_resolution_fee(reuse_mode)` and read `get_protocol_config`.
- For retry, use `fee_per_attempt` from config; the quote view is not a retry quote.
- Show protocol value and separate GenLayer network/consensus fee requirement.
- Verified V1 protocol fees are zero, but network execution still costs network fees.

### 10–11. Submit and transaction lifecycle

Use the lifecycle in `TRANSACTION_LIFECYCLE.md`: wallet submit, persist hash, poll stored status, check execution result, wait for finalization, follow resolver child, then hydrate the resulting Fact. A successful parent request transaction can leave the request at `DISPATCHED`; that is expected.

### 12. Resulting Fact page

Route by `fact_key` only after the request ID and fact key are known. Until finalized child resolution state is observed, show a request activity page rather than a canonical Fact verdict.

## Fact detail UI model

### Identity block

Show claim fields from the request; `claim_key`, `fact_key`, `spec_hash`, `policy_hash`, and `template_hash`; exact policy/template ID and version from the request/resolution snapshot; schema version; and mutability.

Hashes are identifiers, not user-readable verdicts. Copy buttons must expose the full value to screen readers.

### Canonical truth block

Read `FactRecord.current_resolution_id`, `current_outcome`, `resolved_at`, `valid_until`, and `current_request_id`; hydrate the resolution with `get_current_resolution`.

Labels:

- `TRUE` → “Canonical: True”
- `FALSE` → “Canonical: False”
- `UNRESOLVED` → “Canonical: Unresolved”
- no fact → “Not found,” not unresolved.

Freshness is a separate badge:

- immutable boolean outcome → Fresh/immutable;
- mutable and `is_fact_fresh=true` → Fresh until `valid_until`;
- mutable and false → Stale; offer refresh;
- unresolved → freshness is not a successful truth signal.

### Latest attempt block

Read `latest_resolution_id` and `get_latest_resolution`. Label it “Latest attempt,” even when it equals canonical. If latest differs from current, show both IDs and explain that the latest attempt did not replace canonical truth. Common case: previous canonical `TRUE`, latest `UNRESOLVED`.

### Evidence/history block

Read history IDs with pagination, hydrate resolutions and manifests, display outcome/diagnostic/policy satisfaction/resolver version/manifest hash, and show source entries with source class, origin, status, provenance group, independent/primary/policy eligibility flags, URL, and evidence hash. Never show raw rendered HTML or treat a manifest entry as an independent verdict.

### Callback/transaction block

Show request ID, transaction IDs, parent/child links, callback target, callback ID when available, and callback state. Keep “protocol resolution succeeded” and “callback acknowledged” as separate statuses.

## State treatments

- Loading: preserve the previous known canonical value while showing a refresh indicator; never replace it with `UNRESOLVED` merely because a latest read is pending.
- Empty: explain “no resolution history” versus “fact not found.”
- Stale: show the prior canonical outcome with a stale badge; do not relabel it as a current fresh truth.
- Error: distinguish RPC/read failure, transaction failure, protocol unresolved, and callback failure.
- Mobile: stack canonical/latest blocks vertically and keep hashes copyable without horizontal scroll.
