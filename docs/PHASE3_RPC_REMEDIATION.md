# Evidra Phase 3.3A — RPC Budget Remediation

## Root cause

The prior `ChainIndexer.syncOnce()` called `verifyDeployment()` on every
five-minute cycle, reread all event pages from offset zero, reread every
request and resolution ID, fetched every reachable Fact and evidence manifest,
and called `is_fact_fresh` for every Fact. `/ready` also initiated a full
deployment verification after its short cache expired. These paths multiplied
even while the chain was idle. Anonymous browser pages already used the Phase 1
API and were not the primary source of direct RPC traffic.

The deployment audit found exactly one Evidra API process, one supervised web
process, no Evidra PM2 process, no duplicate indexer service, and no Evidra
cron/timer. Unrelated PM2 applications and cron jobs were left untouched.

## Changes

- Added centralized scheduler accounting by subsystem and method.
- Added single-flight coalescing for identical concurrent ProtocolClient reads.
- Distinguished transient 429/5xx retryable failures from daily quota exhaustion.
- Added a one-hour hard-quota cooldown that rejects future work locally and
  drains queued work without another network call.
- Replaced per-request readiness verification with a background HealthMonitor.
- Added light health probes every 15 minutes and full frozen-deployment checks
  every six hours after startup.
- Added persisted request/resolution/config checkpoints to `sync_state`.
- Changed the indexer to read only new events/records and a bounded mutable
  request set.
- Removed per-cycle on-chain freshness calls; TTL freshness is recomputed from
  finalized Fact fields in PostgreSQL.
- Kept explicit `source=chain` Fact verification and wallet-owned browser reads
  available; they are not part of anonymous normal rendering.

## Budget result

The deterministic simulation is in
`artifacts/evidra/rpc_budget_simulation.json`. It models:

- 808 calls/day with no mutable requests;
- 1,384 calls/day with one active mutable request;
- 1,960 calls/day at the configured two-request bounded ceiling;
- approximately 8–12 incremental server reads for one Create Fact lifecycle;
- approximately 4–6 incremental server reads for one reassessment.

The bounded idle design is below the requested 2,500/day hard ceiling and the
normal one-active-request model is below the preferred 1,500/day target.

## Exhausted-quota behavior

The production quota was already exhausted at the start of this work. The
public `/ready` probe returned 503 with a provider daily-quota error while
`/health` remained 200. No wallet, contract write, or live RPC retry loop was
used during remediation. After deployment of this change, health/indexer
timers may wake, but the shared scheduler suppresses network calls during its
cooldown. `/ready` continues to fail closed until the cached snapshot becomes
healthy again.

## Local evidence

The local suite covers:

- zero RPC calls from readiness HTTP requests;
- health full/light cadence;
- health suppression during hard quota cooldown;
- incremental idle sync without immutable rereads;
- duplicate sync suppression;
- hard-quota cooldown and queue draining;
- bounded transient retry;
- single-flight and subsystem/method metrics.

Live quota recovery and real-wallet E2E remain Phase 3.3B work by explicit
change control.
