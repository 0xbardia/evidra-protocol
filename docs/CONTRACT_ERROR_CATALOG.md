# Evidra Protocol V1 — Contract Error Catalog

Errors are GenLayer `gl.vm.UserError` codes unless noted. Address parsing/runtime failures may surface as SDK/RPC errors rather than one of these codes. End-user text below intentionally avoids exposing authority or resolver internals.

| Error | Contract / operation | Meaning and likely cause | Retryable | Developer/operator | Security-sensitive |
|---|---|---|---|---|---|
| `NOT_OWNER` | Policy/admin writes; Registry admin writes | Caller is not the current owner. | No | Yes | Yes |
| `NOT_PENDING_OWNER` | `accept_owner` | Caller is not the nominated pending owner. | No | Yes | Yes |
| `ZERO_ADDRESS` | Constructors, owner/guardian/resolver config | Zero address is not permitted for a required actor. | After correcting input | Yes | Yes |
| `INVALID_PARAM` | Policy/template/registry writes and hash/spec views | A scalar, string length, version, mutability, schema, mode, or template parameter is invalid. | After correction | Sometimes | No |
| `INVALID_POLICY_CLASS` | Policy publish/hash | Empty/malformed/unknown source class token. | After correction | No | No |
| `DUPLICATE_POLICY_CLASS` | Policy publish/hash | Same canonical class appeared more than once. | After correction | No | No |
| `CONTRADICTORY_POLICY_CLASS` | Policy publish/hash | A class is both allowed and disallowed. | After correction | No | No |
| `POLICY_EXISTS` | `publish_source_policy` | Exact policy ID/version already exists. | No; choose a new version | Yes | No |
| `UNKNOWN_POLICY` | Deprecation, request creation, resolver | Policy ID/version does not exist. | No until configuration is fixed | Yes | No |
| `POLICY_INACTIVE` | Request creation | Policy exists but is inactive/deprecated. | No until another active version is selected | Yes | No |
| `TEMPLATE_EXISTS` | `publish_template` | Exact template ID/version already exists. | No; choose a new version | Yes | No |
| `UNKNOWN_TEMPLATE` | Template request/deprecated/resolver | Template ID/version does not exist. | No until fixed | Yes | No |
| `TEMPLATE_INACTIVE` | `request_fact_by_template` | Selected template is deprecated/inactive. | No; choose active version | Yes | No |
| `TEMPLATE_FACT_TYPE` | `request_fact_by_template` | Template fact type is incompatible with requested mutability. | After correction | No | No |
| `TEMPLATE_REQUIRED_FIELD` | `request_fact_by_template` | A template-required field is missing or blank. | After correction | No | No |
| `PAUSED` | New request paths | New requests are paused by guardian/owner. | Yes after unpause | Operator | Yes |
| `NO_DEFAULT_RESOLVER` | Request creation | Registry has no default resolver. | No until operator config | Yes | Yes |
| `RESOLVER_DISABLED` | Request creation/dispatch | Default or assigned resolver is not registered/enabled. | Yes after operator config | Yes | Yes |
| `FEE_INSUFFICIENT` | Payable request/retry | `msg.value` is below the protocol amount required by the path. | After correcting value | No | No |
| `TOO_MANY_SEEDS` | Request/refresh/reassessment seed parsing | More than the configured initial or supplemental URL bound was supplied. | After reducing list | No | No |
| `INVALID_URL` | Seed URL parsing/validation | URL is not accepted HTTPS, has forbidden host/address, or is not a string. | After correction | No | No |
| `INVALID_PAGINATION` | `get_events`, `get_resolution_history` | Limit is zero or greater than 50. | After correcting limit | No | No |
| `UNKNOWN_FACT` | Refresh/reassessment/fact views | Fact key has no record. | No until key exists | No | No |
| `ALREADY_RESOLVED_IMMUTABLE` | `refresh_fact` | Immutable facts cannot use the refresh path. Reassessment or a force-fresh request is distinct. | No for this operation | No | No |
| `UNKNOWN_REQUEST` | Request/retry/cancel/callback and resolver | Request ID has no record. | No until ID is correct | No | No |
| `NOTHING_TO_RETRY` | Retry/cancel/commit/resolver | Request is not in a state accepted by that operation. | Depends on state | Sometimes | No |
| `MAX_ATTEMPTS` | `retry_resolution` | Attempt count reached the request’s maximum. | No | No | No |
| `NOT_STALE` | Retry/cancel | Retry delay or stale threshold has not elapsed. | Yes, after waiting | No | No |
| `STALE_ATTEMPT` | Commit/resolver | Attempt ID is not the active attempt. | No; reconcile latest request | No | Yes |
| `NOT_ASSIGNED_RESOLVER` | Commit/resolver | Caller/assigned resolver does not match the request. | No until configuration/state is correct | Yes | Yes |
| `BINDING_MISMATCH` | Commit/resolver/template verification | Claim/fact/spec/policy/template data does not match the request snapshot. | No; treat as stale/bug | Yes | Yes |
| `UNKNOWN_RESOLUTION` | Callback retry | Request points to a missing resolution. | No | Yes | No |
| `UNAUTHORIZED` | Retry/cancel/callback ack/consumer/resolver | Caller does not own the requested permission. | No | Sometimes | Yes |
| `CALLBACK_NOT_FAILED` | `request_callback_retry` | Callback is not in `DISPATCHED` or `FAILED_REPORTED`. | Maybe after state changes | No | No |
| `NO_CREDIT` | `withdraw_credit` | Caller has no refundable/overpaid credit. | No until credit exists | No | No |
| `NOT_GUARDIAN` | `pause_new_requests` | Caller is neither guardian nor owner. | No | Yes | Yes |
| `INTERNAL_RESOLUTION_ERROR` | Resolver / resolution commit | Prompt, parsing, or nondeterministic resolver processing failed. | Often, with a new request/retry if allowed | Operator may inspect | No end-user detail |

The hash/spec views are not all non-throwing helpers: `compute_policy_hash` can return `INVALID_PARAM`, `INVALID_POLICY_CLASS`, `DUPLICATE_POLICY_CLASS`, or `CONTRADICTORY_POLICY_CLASS`; `compute_template_hash` can return `INVALID_PARAM`; and `compute_spec_hash` can return `INVALID_PARAM`, `INVALID_URL`, or `TOO_MANY_SEEDS`. `validate_seed_url` can revert `INVALID_URL`. Refresh/reassessment reload the stored policy and can therefore return `UNKNOWN_POLICY` or `POLICY_INACTIVE` if that historical policy has been removed or deprecated before the new request is created. Resolver execution can surface `UNKNOWN_POLICY`, `UNKNOWN_TEMPLATE`, or `BINDING_MISMATCH` in addition to the lifecycle errors listed above.

## Operation-specific handling

### Request creation

Validate fields locally before the wallet prompt. If a request write returns a transaction ID but later execution fails, reconcile the transaction first; do not blindly resubmit. `PAUSED`, policy/template errors, resolver configuration errors, and URL errors are not transient RPC failures.

### Resolution and retry

`STALE_ATTEMPT`, `BINDING_MISMATCH`, and `NOT_ASSIGNED_RESOLVER` should be logged with request/attempt IDs for operators, but the end user should see “This attempt is no longer current; refresh the request.” `NOT_STALE` is a wait state, not a failure.

### Callback

`CALLBACK_NOT_FAILED` means no retry is currently permitted. A callback being `DISPATCHED` is not proof that the target processed it. External consumers should use `callback_id` idempotency and call `mark_callback_result` only after their own durable processing decision. V1 does not reject a target acknowledgement made before dispatch or a later status toggle (LOW-002); the app should show the raw callback state separately from protocol success.

### End-user message policy

Do not show owner addresses, resolver binding details, internal prompts, raw RPC traces, private URLs, or contract state dumps as the primary error. Keep the exact code and transaction ID in an operator-visible diagnostic field.
