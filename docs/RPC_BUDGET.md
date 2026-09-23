# Evidra RPC Budget

The Studio Dev observed quota is 5,000 RPC requests per day. This budget is a
design calculation for normal production operation; it excludes user wallet
writes and explicit operator verification.

## Configuration used by the model

| Setting | Value |
|---|---:|
| Index interval | 300 seconds |
| Index cycles/day | 288 |
| Indexer base calls/cycle | 2 |
| Indexer config refresh | 5 calls every 21,600 seconds |
| Mutable request reread cap | 2 |
| Calls per mutable request | 2 (request + affected Fact) |
| Light health interval | 900 seconds |
| Light health calls | 2 |
| Full verification interval | 21,600 seconds |
| Full verification calls | 5 |
| Hard-quota cooldown | 3,600 seconds |

## Previous cycle estimate

The old cycle performed deployment verification and reread historical state:

```text
5 deployment checks
+ 5 config/version checks
+ 2 event pages
+ N request reads
+ R resolution reads
+ F Fact reads
+ R evidence-manifest reads
+ F freshness reads
```

For the small current deployment this was approximately 28 calls per five
minutes, or about 8,064 calls/day before browser and operational traffic. It
could therefore exhaust a 5,000/day quota without any user writes.

## New idle estimate

With no mutable requests:

```text
indexer: 2 × 288 = 576/day
indexer config refresh: 5 × 4 = 20/day
light health: 2 × 96 = 192/day
full health: 5 × 4 = 20/day
total: 808/day
```

With one active mutable request (the current Request #4 shape):

```text
(2 + 1 request + 1 Fact) × 288 = 1,152/day
indexer config refresh = 20/day
health = 212/day
normal active-idle total = 1,384/day
```

The configured bounded worst case of two mutable requests is:

```text
(2 + (2 × 2)) × 288 + 212 = 1,940/day
```

Adding the independent indexer config refresh (20/day) gives **1,960/day**.
The first process start also has a bounded five-call config refresh burst; it
is not repeated on every idle cycle.

That is below the 2,500/day hard design ceiling and leaves approximately
3,060 requests/day under the observed quota in the bounded model.

## User-initiated lifecycle estimates

These are incremental server reads, not part of idle operation:

- one Create Fact: approximately 8–12 extra finalized reads while the new
  request, resolution, affected Fact, and evidence manifest become visible;
- one reassessment: approximately 4–6 extra finalized reads for the new
  request/resolution, affected Fact, and manifest.

The browser’s wallet fee estimation and write lifecycle use the user’s wallet
provider/client and are not added to the API indexer budget. The explicit API
`source=chain` verification route remains bounded and is not used by normal
page rendering.

## Hard-quota behavior

The scheduler recognizes daily-quota responses such as `Rate limit exceeded:
5000 requests per day`, records them by subsystem/method, rejects queued work,
and enters a one-hour cooldown. During cooldown:

- `/ready` reads only PostgreSQL and the health snapshot;
- indexer timer wakeups do not call the RPC;
- health timer wakeups do not call the RPC;
- API projection routes do not call the RPC;
- no retry loop amplifies the exhausted quota.

After cooldown expiry, the next bounded scheduled probe is the recovery
attempt. A repeated daily-quota response starts another cooldown.

## Measurement status

Live Studio Dev counters could not be sampled during Phase 3.3A because the
quota was already exhausted. The local scheduler metrics and deterministic
24-hour simulation are the evidence for the new budget. Live wallet E2E is
explicitly deferred to Phase 3.3B after quota recovery.
