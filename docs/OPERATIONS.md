# Operations

## Service commands

```sh
sudo systemctl status evidra-api evidra-web
sudo systemctl restart evidra-api evidra-web
sudo journalctl -u evidra-api -f
sudo journalctl -u evidra-web -f
sudo nginx -t && sudo systemctl reload nginx
```

Restart the API only when no user write is being certified. The API stops its
indexer before closing its database pool. A restart may trigger a fresh
finalized bootstrap and the readiness endpoint can remain `503` until that
bootstrap succeeds.

## Health checks

```sh
curl -fsS https://evidra-protocol.bydx.fun/api/v1/health
curl -fsS https://evidra-protocol.bydx.fun/api/v1/ready
curl -fsS https://evidra-protocol.bydx.fun/api/v1/network
curl -fsS https://evidra-protocol.bydx.fun/api/v1/protocol
```

`health` is process liveness. `ready` requires database access plus a cached
background RPC-health snapshot that is within its age thresholds, has verified
the frozen deployment, and has an acceptable indexer status. `/ready` makes
zero RPC calls per request. `protocol` exposes only public network/configuration
and projection sync status.

## Indexer operations

The indexer polls finalized state with bounded concurrency and a shared RPC
scheduler. Production polling is five minutes apart, uses persisted request /
resolution / event checkpoints, and revisits only a bounded mutable set. Health
verification runs in the background rather than inside readiness requests. A
daily quota failure enters a long scheduler cooldown, preventing retry
amplification. It is idempotent:
requests, resolutions, policies, templates, facts, and evidence are upserted
from chain reads. A process restart is safe; the database projection can be
rebuilt from an empty database.

Studio Dev reads are intentionally conservative. The clean production uses one
worker, a 2.4-second minimum RPC interval, a two-request mutable reread cap,
and a 15-minute light health cadence. Do not increase concurrency or poll
frequency merely to make a dashboard look faster. See `RPC_BUDGET.md` for the
daily calculation.

## Logs

Logs are structured JSON. Review `lastError`, repeated 5xx/429 messages, and
unexpected parse errors. Never put the production environment file, wallet
material, Authorization headers, or database credentials in logs.

## Incident response

1. Check `/health` and `/ready`.
2. Check service and nginx status.
3. Check PostgreSQL connectivity and disk space.
4. Check the latest indexer error and RPC availability.
5. If the projection is suspect, stop API writes/reads as appropriate, take a
   backup, migrate a disposable database, and bootstrap from chain.
6. Restore the service only after chain-derived state and the public API agree.

If the RPC reports a daily quota exhaustion, do not restart repeatedly or call
`/ready` in a loop. Inspect scheduler metrics in the API journal, confirm the
one-hour cooldown is active, and wait for the normal provider reset window.

The database is not protocol custody. If it is lost, recreate it and rerun
the migrations/indexer bootstrap.
