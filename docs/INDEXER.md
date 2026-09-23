# Evidra Finalized Indexer

The indexer is a polling reconciler. It does not assume websocket or event-subscription support from Studio Dev.

## Bootstrap and incremental sync

Bootstrap reads the finalized protocol configuration and starts from checkpoint
zero. Normal cycles:

1. read the Registry stats counter and PolicyRegistry event counter;
2. refresh immutable protocol configuration/version metadata only on the
   configured refresh interval;
3. page only new events after the persisted event offsets;
4. read only request IDs after `last_request_id` and resolution IDs after
   `last_resolution_id`;
5. reread a small bounded set of mutable/pending requests for lifecycle and
   callback changes;
6. read affected Facts and new evidence manifests only;
7. recompute TTL freshness locally from finalized Fact fields and persist the
   finalized checkpoint.

The current contracts expose counters rather than an explicit list of fact keys. Facts are therefore discovered from requests/resolutions and are not fabricated when no chain record makes them reachable.

## Rate limits and failures

`RpcScheduler` limits concurrency to at most two, applies a minimum inter-request interval, retries transient 429/5xx/timeout failures with bounded exponential backoff and jitter, honors parsed `Retry-After` values, and enters a long cooldown for daily-quota responses. Calls during that cooldown are rejected locally and do not reach the RPC. Database statement and connection timeouts are bounded.

The interval, checkpoint, mutable-request cap, and retry settings are environment-controlled but the chain and RPC URL are not: startup rejects a different network. A failed cycle leaves the last good projection intact, marks `sync_state.status=degraded` or `rate_limited`, and is retried on the next bounded interval. Process restart resumes from the persisted database checkpoints; correctness does not depend on an in-memory cursor.

## Freshness and lag

`facts.is_fresh` is recomputed locally from finalized `mutability`, `valid_until`, and the current time. Immutable facts remain fresh under V1 semantics; mutable facts become stale after `valid_until`. This avoids an RPC call merely because time passed. If cache age or a canonical pointer is unacceptable, consumers should request `source=chain` for an explicit finalized read.

## Operational limits

- Event pages and API pages are capped at 50.
- Bootstrap records are capped by `INDEXER_MAX_RECORDS` (100,000 default in code).
- There is no arbitrary URL fetcher in the backend. Evidence URLs are indexed/displayed as chain metadata only.
- A complete old-history rebuild is limited by whatever event pages and record counters the contract still exposes.
