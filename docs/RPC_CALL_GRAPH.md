# Evidra RPC Call Graph

This is the Phase 3.3A call graph for the production read path. All chain
reads use the shared `ProtocolClient` scheduler and `latest-final` by default.
The scheduler is the accounting, retry, single-flight, and hard-quota
cooldown boundary.

## Server processes

`evidra-api.service` starts one Fastify process. That process creates one
shared `RpcScheduler`, one `ChainIndexer`, and one `HealthMonitor`. Three
clients share the scheduler and identify their calls as `readiness`,
`indexer`, or `api` for metrics. There is no separate indexer process.

```text
systemd evidra-api
  ├─ HealthMonitor (readiness client)
  │    ├─ startup/full: ProtocolClient.verifyDeployment()
  │    │    ├─ eth_chainId
  │    │    ├─ policyRegistry.get_registry_version (read-mode probe)
  │    │    ├─ registry.get_protocol_config
  │    │    ├─ resolver.get_registry
  │    │    └─ consumerProbe.get_trusted_registry
  │    └─ light: eth_chainId + registry.get_registry_version
  └─ ChainIndexer (indexer client)
       ├─ registry.get_protocol_stats
       ├─ policyRegistry.get_event_count
       ├─ config/version refresh only on the configured refresh interval
       ├─ event pages only when the persisted event count increased
       ├─ new request IDs only after last_request_id
       ├─ new resolution IDs only after last_resolution_id
       ├─ bounded mutable request rereads
       └─ affected fact/evidence reads only
```

## API routes

The normal API routes are projection reads and do not call Studio Dev:

| Route family | Source | RPC behavior |
|---|---|---|
| `/api/v1/health` | process | zero RPC |
| `/api/v1/ready` | PostgreSQL + cached health snapshot | zero RPC per request |
| `/api/v1/network` | frozen validated config | zero RPC |
| `/api/v1/protocol` | `protocol_state` + `sync_state` | zero RPC |
| `/api/v1/facts` | PostgreSQL | zero RPC |
| `/api/v1/facts/:factKey` | PostgreSQL by default | zero RPC |
| `/api/v1/facts/:factKey/resolutions` | PostgreSQL | zero RPC |
| `/api/v1/resolutions/*` | PostgreSQL | zero RPC |
| `/api/v1/requests/*` | PostgreSQL | zero RPC |
| `/api/v1/policies*` | PostgreSQL | zero RPC |
| `/api/v1/templates*` | PostgreSQL | zero RPC |
| `/api/v1/activity` | PostgreSQL | zero RPC |
| `/api/v1/stats` | PostgreSQL | zero RPC |

`GET /api/v1/facts/:factKey?source=chain` is an explicit verification path,
not normal navigation. It reads the Fact, canonical resolution, latest
resolution, and freshness directly from the frozen Registry (up to four
scheduled calls).

## Browser callers

Anonymous landing, registry, Fact detail, policy, template, activity, and docs
pages use the Phase 1 API and make zero direct Studio Dev calls. Direct browser
RPC is limited to user-owned operations:

- wallet chain/account checks;
- connected-wallet credit balance read;
- write fee estimation and wallet submission;
- explicit write lifecycle/reconciliation reads;
- client-side identity derivation before a Create Fact submission.

The browser does not fetch evidence URLs and does not duplicate projection
reads with direct contract reads.

## Shared transport controls

Every scheduled call is tagged by subsystem and method. Identical concurrent
reads in one `ProtocolClient` are single-flight coalesced. Transient 429/5xx
errors use bounded retries. A daily-quota response enters a long cooldown;
queued and new calls are rejected locally until the cooldown expires.

