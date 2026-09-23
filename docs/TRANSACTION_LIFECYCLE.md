# Evidra Protocol V1 — Transaction and Protocol Lifecycle

This document separates the GenLayer transaction lifecycle from the Evidra request/fact lifecycle. A transaction hash proves submission only. A protocol request is not canonically finalized until the relevant GenLayer write has finalized successfully and finalized reads show the durable state.

## Two linked state machines

```text
wallet approval
    ↓
submitted tx id
    ↓
GenLayer consensus: pending → decided/accepted → finalized
    ↓ (only after successful execution)
Evidra request: PENDING → DISPATCHED → RESOLVED
                         ↘ CANCELLED
                         ↘ retry (new attempt)
Evidra fact: latest resolution always advances; canonical advances only by V1 rules
```

The resolver and callback are triggered messages. Follow their child transaction IDs when the SDK exposes them, but do not treat a trigger’s existence as proof that the child execution succeeded.

## Wallet write handling

1. Validate and normalize form input locally.
2. Read finalized registry configuration, selected policy/template snapshots, and fee inputs immediately before submit.
3. Compute or read the exact protocol amount. The registry’s payable `msg.value` is separate from GenLayer consensus fee/deposit handling.
4. Disable the submit action by an idempotency key derived from the normalized operation and connected wallet until the first submission attempt returns or the user explicitly cancels.
5. After wallet approval returns a GenLayer transaction ID, persist it before any polling or route transition.
6. Poll the transaction by ID. Use stored status and execution result; do not infer success from a non-null hash.
7. At `ACCEPTED`/decided, show “consensus decision recorded; finalization pending.” Do not show a canonical Fact as finalized yet.
8. At `FINALIZED`, require a successful execution result (`FINISHED_WITH_RETURN` or SDK `isSuccessful` equivalent). Only then read the request/fact using `latest-final`.
9. Reconcile request state, then read `get_fact`, `get_current_resolution`, `get_latest_resolution`, and evidence manifest as needed.
10. For resolver/callback child transactions, repeat the same process and preserve parent/child relationships.

## GenLayer status mapping

Use the GenLayer SDK’s stored status and normalized lifecycle. The current SDK exposes raw statuses including `Pending`, `Proposing`, `Committing`, `Revealing`, `Accepted`, `Undetermined`, `Finalized`, `Canceled`, timeout states, and appeal phases. The app-facing lifecycle is:

| SDK lifecycle | Display | Can read as durable Evidra truth? |
|---|---|---|
| `processing` | Pending / consensus in progress | No |
| `decided` with `accepted` | Decided / accepted; wait for finalization if durable completion is required | No for canonical UI |
| `decided` with `undetermined`, timeout, or failed execution | Protocol decision did not produce a successful write | No; inspect receipt |
| `finalized` and successful execution | Finalized | Yes, after a `latest-final` read confirms state |
| `canceled` | Canceled | No state mutation from that transaction |

An `ACCEPTED` or `FINALIZED` status alone is insufficient; execution result must also be successful.

## Evidra request states after a successful write

- `request_fact` / template request: a new request starts with `PENDING`, is dispatched to the default resolver, and normally becomes `RESOLVED` after the resolver commits.
- Reuse: `REUSE_IF_FRESH` can create `REUSED` with no new resolution. The request points to the reused canonical resolution and can still dispatch a callback.
- Retry: only requester or owner, only after `retry_after`, and only before `max_attempts`; increments `active_attempt_id` and `attempt_count`.
- Cancel: requester, owner, or guardian can cancel a stale pending/dispatched request; recorded protocol fee is credited to the requester.
- Refresh: mutable facts only; creates a force-fresh request using prior specification with optionally replaced seeds.
- Reassessment: any existing fact can be reassessed; supplemental URLs are supplemental-first and are not part of the fact identity.

## Duplicate click and reconnect rules

- Use a client-side submit lock, but do not treat it as the source of truth.
- If the browser reloads after wallet approval, recover the pending transaction from server/local durable storage and query by transaction ID.
- If the wallet rejects before a transaction ID exists, no chain reconciliation is needed; allow correction and retry.
- If RPC times out after submission, the outcome is unknown, not “not submitted.” Search by the persisted client operation key and transaction ID before a new write.
- If a user deliberately submits the same operation twice, both valid transactions may exist; reuse can avoid a new resolution only when `REUSE_IF_FRESH` and identity/freshness match.

## Reconciliation truth table

| Transaction observation | App action |
|---|---|
| No hash | Treat as not submitted; show wallet/provider error. |
| Hash, no stored receipt | Keep pending; retry reads with bounded backoff. |
| Stored failure/revert | Record failure and raw code privately; do not project a request/fact. |
| Accepted/decided, execution failed | Record protocol decision but do not read it as successful Evidra mutation. |
| Finalized, execution success | Perform finalized reads and update DB projection. |
| Finalized, execution success, request still pending | Follow triggered child transaction(s); parent success is not resolver completion. |
| Request `RESOLVED` with `UNRESOLVED` | Show completed unresolved result, not a transaction error. |
| Callback `DISPATCHED` | Show sent/awaiting acknowledgement; never label acknowledged. |

## Required persisted transaction fields

At minimum store transaction ID, wallet address, chain ID, contract address, method, normalized arguments hash, value, fee/deposit metadata, submitted time, latest raw status, execution result, finalization time, parent transaction ID, triggered child IDs, and reconciliation timestamps. Never store private keys.

## References

The implementation should follow the current GenLayer SDK guidance for `getTransaction`, `waitForDecision`, `waitForFinalization`, execution-result checks, and restart-safe polling: [Querying a Transaction](https://docs.genlayer.com/developers/decentralized-applications/querying-a-transaction) and [Writing to Intelligent Contracts](https://docs.genlayer.com/developers/decentralized-applications/writing-data).
