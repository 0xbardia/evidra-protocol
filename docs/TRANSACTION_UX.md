# Transaction UX

The browser represents a GenLayer write as a state machine rather than a
single spinner:

`preparing → wallet → submitted → consensus → decided → finalizing → finalized`

Any conclusive failed or canceled decision produces `failed`. A submitted
transaction is not a finalized Fact and is never described as one.

## User-visible behavior

- `preparing`: validate network and construct the exact Registry call;
- `wallet`: request wallet approval;
- `submitted`: show the transaction ID and explorer link when available;
- `consensus`: wait for GenLayer’s decision;
- `decided`: the decision was accepted, but durable protocol state is still
  pending;
- `finalizing`: wait for finalized state;
- `finalized`: clear the pending pointer, re-read chain-backed state, and only
  then update the relevant Fact page;
- `failed`: explain the safe next step without silently retrying.

## Reload and duplicate protection

The pending method/account/transaction ID is persisted locally. On the next
application load, the app attempts read-only reconciliation using the SDK.
The pending pointer is removed only after finalization. While it exists, a new
write is rejected with a reconciliation message. This protects against a
browser timeout being mistaken for a failed submission.

## Error presentation

Known contract and wallet errors are shown as short user-facing messages with
technical detail only where it helps support. Raw RPC payloads and secrets are
not placed in normal UI copy.
