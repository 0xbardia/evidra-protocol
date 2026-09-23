# Evidra Read API v1

Base path: `/api/v1`. Responses are JSON. Decimal u256 values are strings. API data is either `source: cache` (projection) or an explicit finalized `source=chain` read.

## Diagnostics

| Route | Behavior |
| --- | --- |
| `GET /health` | Process liveness only. |
| `GET /ready` | Checks PostgreSQL, chain ID, frozen relationship reads, and initial indexer success. Returns 503 while unavailable/degraded. |
| `GET /network` | Frozen network, explorer, chain ID, and four contract addresses. |
| `GET /protocol` | Verified protocol versions/config state plus sync/indexer status. Requires a populated projection. |
| `GET /stats` | Projection counts and sync status. |

## Facts and resolutions

- `GET /facts?offset=0&limit=20&outcome=TRUE&fresh=true&policy=<hash>&template=<hash>&mutability=IMMUTABLE&search=term&sort=recent`
- `GET /facts/:factKey`
- `GET /facts/:factKey/resolutions?offset=0&limit=20`
- `GET /resolutions/:resolutionId`
- `GET /resolutions/:resolutionId/evidence`
- `GET /requests/:requestId`

`GET /facts/:factKey` returns an object shaped like. `freshness.is_fresh` is the contract freshness result; `projection.stale` is an independent five-minute cache-age warning.

```json
{
  "fact": { "fact_key": "…", "current_resolution_id": "3", "latest_resolution_id": "3" },
  "canonical_resolution": { "resolution_id": "3", "outcome": "TRUE" },
  "latest_resolution": { "resolution_id": "3", "outcome": "TRUE" },
  "freshness": { "is_fresh": true, "source": "cache" },
  "projection": { "source": "cache", "synced_at": "…", "stale": false }
}
```

The canonical and latest objects are never merged. Resolution `outcome`, `policy_satisfied`, and `diagnostic_reason` are contract-derived. Reasoning summaries and evidence wording are metadata and are labelled informational.

Use `?source=chain` for a direct latest-final fact/current/latest read. This bypasses the projection but still uses the shared client’s validated frozen deployment.

## Policies, templates, and activity

- `GET /policies?offset=0&limit=20`
- `GET /policies/:policyId/:version`
- `GET /templates?offset=0&limit=20`
- `GET /templates/:templateId/:version`
- `GET /activity?offset=0&limit=20`

Activity is derived only from indexed requests and resolutions. It does not claim event types that cannot be reconstructed from chain state.

## Pagination and errors

`offset` is a non-negative integer and `limit` is 1–50. Invalid input returns 400; missing entities return 404; unavailable chain/database dependencies return 502/503; unexpected failures return 500 with a request ID. Internal RPC/database details are logged server-side, not returned to clients.

There are no Phase 1 mutation or admin routes. There is no evidence-content proxy and no arbitrary server-side URL fetch.
