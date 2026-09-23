# User Write Flows

All writes originate in the connected browser wallet and target the frozen
Registry address. The backend has no write endpoint and cannot impersonate a
user.

## Create Fact

The wizard maps directly to the frozen Registry methods:

| UI path | Contract method | Value |
| --- | --- | --- |
| Custom fact | `request_fact(subject, predicate, object_value, qualifiers, temporal, mutability, schema_version, ttl_seconds, description, policy_id, policy_version, seed_urls_json, callback_target, reuse_mode)` | `quote_resolution_fee(reuse_mode)` |
| Template fact | `request_fact_by_template(template_id, template_version, subject, predicate, object_value, qualifiers, temporal, mutability, ttl_seconds, description, seed_urls_json, callback_target, reuse_mode)` | `quote_resolution_fee(reuse_mode)` |

The form validates obvious URL problems for user feedback, but the Registry
remains authoritative. It limits the visible seed list to the contract’s
bounded source count and sends JSON strings exactly as required by V1.

## Existing Fact actions

- `refresh_fact(fact_key, seed_urls_json, callback_target)` for eligible mutable
  facts; fee is quoted with `FORCE_FRESH_RESOLUTION`.
- `request_reassessment(fact_key, supplemental_urls_json, notes,
  callback_target)` for new real-world evidence; supplemental URLs are sent
  first by the Resolver according to V1 semantics.
- `retry_resolution(request_id)` when the request state permits another
  attempt; the configured fee is quoted before submission.
- `cancel_stale_request(request_id)` only as a stale recovery action; no fee
  value is supplied.
- `request_callback_retry(request_id)` only for callback recovery; no fee value
  is supplied.
- `withdraw_credit()` for the connected account’s own finalized protocol
  credit; the credit read is direct finalized chain state.

Administrative/resolver operations such as commit, resolver registration,
ownership, guardian, pause, and configuration are not user product actions.

## Submission gates

The UI requires a connected account on chain `61997`, validates method-specific
state from the API, quotes payable writes, and disables the submit control
while a transaction is pending. An unknown wallet outcome does not trigger an
automatic resubmission.

## Completion

Wallet submission is followed by SDK decision and finalization waits. The app
then re-reads the resulting Fact through the finalized API path before showing
the create flow as complete. A successful callback is never used as a
substitute for canonical resolution success.
