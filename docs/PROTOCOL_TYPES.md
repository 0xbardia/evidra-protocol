# Evidra Protocol V1 — Types and Enum Inventory

All values below are taken from the frozen source. The application must preserve unknown future values instead of crashing or mapping them to success.

## Network and scalar conventions

- Addresses are GenLayer `Address` values. SDK reads may serialize them as `addr#...`; API responses should normalize to lowercase `0x` hex while retaining the original RPC form only for debugging.
- `u256` values are decimal-safe integers; TypeScript must represent them as `bigint` or validated decimal strings, never JavaScript `number` for IDs/timestamps/fees.
- `u32` values are bounded unsigned integers.
- Timestamps are Unix seconds from `_now()`.
- Hashes are lowercase SHA-256 hex strings without a `0x` prefix.
- JSON-in-string fields are not typed by the contract ABI; the client must parse and validate them at the boundary.

## Request statuses

| Stored value | Meaning | UI label/state | Terminal? |
|---|---|---|---|
| `PENDING` | Request exists and is waiting for or entering dispatch; retries also set this before dispatch. | Queued / retrying | No |
| `DISPATCHED` | Resolver message was dispatched and the request records the active attempt. | Resolving | No |
| `RESOLVED` | A resolution was committed, including an `UNRESOLVED` outcome. | Completed / outcome available | Yes |
| `REUSED` | A fresh-enough canonical resolution was reused; no new resolution was created. | Reused | Yes |
| `CANCELLED` | A stale pending/dispatched request was cancelled and its recorded protocol fee was credited back. | Cancelled | Yes |
| `FAILED` | Declared constant, but no V1 path assigns it. | Reserved / do not expect | N/A in V1 |
| `UNKNOWN` | Return value of `get_request_status` for a missing request; not a stored request record. | Not found | Yes |

`PENDING` and `DISPATCHED` are retryable only when the retry delay and max-attempt rules also pass. A resolver failure can be represented by a successful request with `status=RESOLVED`, `outcome=UNRESOLVED`, and a diagnostic reason; it is not necessarily `FAILED`.

## Outcomes

| Value | Meaning | UI state | Terminal semantics |
|---|---|---|---|
| `TRUE` | Resolver adjudicated the claim true and the policy was satisfied at normalization/commit. | Positive / verified | Resolution terminal; canonical only if it advanced |
| `FALSE` | Resolver adjudicated the claim false and the policy was satisfied at normalization/commit. | Negative / verified | Resolution terminal; canonical only if it advanced |
| `UNRESOLVED` | No safe boolean answer was committed. | Unknown / unresolved | Resolution terminal; may be latest without replacing an older canonical boolean |

The registry enforces `diagnostic_reason=NONE` for `TRUE` and `FALSE`. It does not require a particular diagnostic for `UNRESOLVED`; the resolver supplies one.

## Diagnostic reasons

| Value | Meaning | UI state |
|---|---|---|
| `NONE` | Boolean outcome passed the resolver’s normalization. | No diagnostic |
| `AMBIGUOUS` | Evidence did not yield a clear boolean. | Warning / unresolved |
| `INSUFFICIENT_EVIDENCE` | Not enough usable/policy-relevant evidence. | Warning / unresolved |
| `CONFLICTING_EVIDENCE` | Sources conflict without a clear canonical primary. | Warning / unresolved |
| `SOURCE_POLICY_UNSATISFIED` | Evidence did not meet policy class/count/cross-check rules. | Warning / unresolved |
| `SOURCE_UNAVAILABLE` | No usable source was fetched. | Error-like / unresolved |
| `INTERNAL_RESOLUTION_ERROR` | Prompt/execution/normalization failure. | Error / retry candidate |

## Reuse, mutability, and schema

| Domain | Exact value | Meaning |
|---|---|---|
| Reuse | `REUSE_IF_FRESH` | Reuse only if the same fact identity has a boolean canonical outcome and passes V1 freshness rules. |
| Reuse | `FORCE_FRESH_RESOLUTION` | Do not reuse an existing fact; create a new request/resolution for the same fact identity. |
| Mutability | `IMMUTABLE` | `valid_until=0`; `is_fact_fresh` stays true for boolean canonical outcomes, but reassessment is still allowed. |
| Mutability | `MUTABLE_WITH_TTL` | Fresh only while `now <= valid_until`; TTL must be greater than zero at request time. |
| Schema | `1` | Only accepted schema version in V1. Blank public input defaults to `1` for custom requests. Template requests hardcode `1`. |

## Source classes

Exact source-class domain:

`OFFICIAL`, `PRIMARY`, `INDEPENDENT_SECONDARY`, `DERIVED`, `COMMUNITY`, `SOCIAL`, `UNKNOWN`, `INVALID`.

Accepted aliases are `official`, `primary`, `docs`, `documentation`, `independent`, `independent_secondary`, `secondary`, `derived`, `mirror`, `community`, `social`, `unverified`, `unknown`, and `invalid` (case/whitespace normalized). Unknown tokens and duplicate canonical classes revert with policy errors.

Resolver classification rules:

- `PRIMARY_CLASSES`: `OFFICIAL`, `PRIMARY`.
- `INDEPENDENT_ELIGIBLE`: `OFFICIAL`, `PRIMARY`, `INDEPENDENT_SECONDARY`, `COMMUNITY`.
- `SOCIAL`, `INVALID`, `DERIVED`, and duplicates cannot satisfy the policy.
- `UNKNOWN` can be eligible only under the current policy algorithm when the allow-list is empty or explicitly contains it; this is the MEDIUM-001 fail-open finding.
- Independence is counted once per provenance group. `require_cross_check` requires at least two independent eligible groups.

For UI, render source classes as evidence classifications, not verdicts: `OFFICIAL`/`PRIMARY` as primary-source badges, `INDEPENDENT_SECONDARY` as secondary-source, `COMMUNITY` as community, `DERIVED` as derivative, `SOCIAL` as social, and `UNKNOWN`/`INVALID` as warning/error states. Source class is descriptive rather than terminal; `policy_eligible` and the committed outcome determine protocol effect.

## Source fetch statuses

| Value | Meaning | UI state |
|---|---|---|
| `USABLE` | Web content was returned and included in semantic processing. | Available |
| `UNAVAILABLE` | Fetch returned empty/raised; content is blank. | Unavailable |
| `DUPLICATE` | Canonical URL duplicate of an earlier source. | Deduplicated |
| `DERIVED` | Content was detected as a mirror/attribution/similarity derivative. | Non-independent |
| `INVALID` | Resolver-side invalid/unusable classification; the standard fetch path uses it for unavailable inputs during classification. | Invalid / excluded |

## Callback statuses

| Value | Meaning | UI state | Terminal? |
|---|---|---|---|
| `NOT_REQUESTED` | Request has zero callback target. | No callback | Yes |
| `DISPATCHED` | Registry emitted the callback message. It does not mean delivery succeeded or was acknowledged. | Sent / awaiting acknowledgement | No |
| `ACKNOWLEDGED` | Callback target called `mark_callback_result(request_id, true)`. | Acknowledged | Yes for current delivery |
| `FAILED_REPORTED` | Callback target called `mark_callback_result(request_id, false)`. | Delivery failure reported | Retryable via callback retry |

Callback retry is permitted while status is `DISPATCHED` or `FAILED_REPORTED`, so duplicate delivery is possible. Consumers must deduplicate by `callback_id`. V1 authenticates the callback target but does not enforce a dispatched-before-acknowledged transition; applications must not treat `ACKNOWLEDGED` as proof of a correctly dispatched callback (LOW-002).

## Resolution and fact type shapes

### `RequestRecord`

`exists`, `request_id`, `requester`, `claim_key`, `fact_key`, `spec_hash`, `policy_hash`, `policy_id`, `policy_version`, `assigned_resolver`, `created_at`, `status`, `active_attempt_id`, `last_attempt_at`, `retry_after`, `max_attempts`, `attempt_count`, `callback_target`, `callback_status`, `reuse_mode`, `fee_paid`, `mutability`, `schema_version`, `ttl_seconds`, `seed_urls_json`, `subject`, `predicate`, `object_value`, `qualifiers`, `temporal`, `description`, `current_resolution_id`, `supplemental_urls_json`, `template_id`, `template_version`, `template_hash`, `fact_type`, and `template_resolution_instructions`.

`RequestRecord.current_resolution_id` is the resolution created by that request and can point to a non-canonical latest attempt. It is not the same as `FactRecord.current_resolution_id` in the stale/unresolved case.

### `ResolutionRecord`

`exists`, `resolution_id`, `request_id`, `attempt_id`, `claim_key`, `fact_key`, `spec_hash`, `policy_hash`, `outcome`, `diagnostic_reason`, `policy_satisfied`, `resolver_version`, `evidence_manifest_hash`, `reasoning_summary`, `evaluated_at`, `committed_at`, `valid_until`, `resolution_version`, `supersedes_resolution_id`, `template_id`, `template_version`, and `template_hash`.

`resolution_version` is the monotonic history version based on the immediately previous latest resolution, not the canonical version.

### `FactRecord`

`exists`, `fact_key`, `claim_key`, `policy_hash`, `schema_version`, `mutability`, `current_resolution_id`, `latest_resolution_id`, `current_request_id`, `current_outcome`, `resolved_at`, `valid_until`, `resolution_version`, and `template_hash`.

### `EvidenceManifestView`

`exists`, `resolution_id`, `manifest_hash`, `manifest_json`. The standard resolver’s manifest entries are:

```json
{
  "url": "https://…",
  "category": "web",
  "provenance_group": "example.com",
  "source_class": "OFFICIAL",
  "fetch_status": "USABLE",
  "is_primary": true,
  "is_independent": true,
  "policy_eligible": true,
  "evidence_hash": "sha256-of-first-4096-rendered-characters-as-hex",
  "relevant_timestamp": "",
  "source_origin": "seed"
}
```

The evidence hash is deliberately bounded to the first 4096 rendered characters in the frozen resolver. The hash helper operates on that Python string (UTF-8 encoded by the SHA-256 helper); it is not a full-content or first-4096-byte hash.

## Policy and template states

Policies and templates have `exists`, `active`, and `deprecated` flags:

| Exact state | Meaning | UI label/state | Terminal? |
|---|---|---|---|
| `exists=true, active=true, deprecated=false` | Selectable current version. | Active | No; a newer version may supersede selection |
| `exists=true, active=false, deprecated=true` | Historical version cannot be selected for new requests. | Deprecated / historical | Yes for selection; historical records remain readable |
| `exists=false` | Requested ID/version is absent. | Not found | Yes / error |

A new published version is active and not deprecated. Deprecation sets `active=false` and `deprecated=true`; historical records remain readable. Existing requests/resolutions snapshot their IDs, versions, and hashes. A latest lookup must not replace a historical snapshot. Resolver registration similarly has `exists` plus `enabled`; disabled registrations are operator state, not a resolution outcome.

## Resolver capabilities

The deployed resolver returns:

```json
{
  "version":"evidra-resolver-v1",
  "registry":"0xb18f84f0de3f7ab600c6a07ec85408a7000b93b6",
  "web_access":true,
  "llm_access":true,
  "source_isolation":true,
  "injection_hardened":true,
  "equivalence":"critical-fields-only"
}
```

`injection_hardened` and `source_isolation` are declared capabilities, not a cryptographic proof. `equivalence=critical-fields-only` is a material evidence limitation documented in the audit.
