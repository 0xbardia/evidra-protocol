# Phase 3 Performance

> Historical performance snapshot from 2026-09-21. Treat its timings and
> service-state observations as measurements from that run, not current
> production metrics. See [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md)
> for the current release record.

## Read deployment observations

Public browser checks were run against the real HTTPS origin at desktop and
mobile sizes. Landing, overview, Fact Registry, Fact detail, Create Fact, and
docs routes loaded without hydration errors, mixed content, or horizontal
overflow.

The frozen Studio Dev state is small. The API indexer intentionally uses one
worker and a 2.4-second minimum RPC interval; the initial bootstrap took
approximately 80 seconds. The production poll interval is five minutes, and
readiness verification is cached for five minutes with concurrent checks
sharing one RPC operation.

## Request behavior

- `/api/v1/health` is a process-local liveness check;
- `/api/v1/facts`, detail, stats, and protocol reads use bounded projection
  queries;
- `/api/v1/ready` performs cached finalized deployment verification and fails
  closed when RPC is unavailable;
- list routes enforce a maximum limit of 50;
- the RPC scheduler applies bounded concurrency, pacing, retry/backoff for
  transient failures, and immediate queue cancellation for exhausted quota.

## Current provider limitation

Studio Dev currently reports `Rate limit exceeded: 5000 requests per day`.
The application no longer amplifies this with a retry storm; the indexer emits
one bounded failure per poll cycle and readiness returns `503`. This is an
external quota limitation, not a reason to weaken finalized reads or poll more
aggressively.

## Follow-up measurement

Record Lighthouse/field Web Vitals and API latency again after quota recovery
and completion of the resolver-backed Fact journey. Do not optimize away
finalized verification or reduce RPC backoff solely to improve synthetic
latency.
