# Phase 1 Protocol Read Certification

The shared client wraps all 64 frozen public view methods:

- PolicyRegistry: 19
- Registry: 30
- Resolver: 4
- ConsumerProbe: 11

`scripts/phase1-read-certification.ts` invokes every wrapper against the frozen Studio Dev addresses. It uses `latest-final` and records each normalized result to `artifacts/evidra/phase1_read_certification.json`. It performs no writes.

The certification also verifies chain ID, frozen Registry → PolicyRegistry/Resolver relationships, Resolver → Registry, and ConsumerProbe → Registry before invoking the view set. The live result is recorded in the artifact and final report after the read run.

Local wrapper tests cover normalization, JSON-string pagination, retry/error handling, address/chain validation, explorer links, and wrapper-to-64-view coverage. Live Studio Dev certification is the source of truth for deployment reachability; local tests do not substitute for it.

## Final live result

- Network: GenLayer Studio Dev, chain 61997
- Read mode: `latest-final`
- Unique views: **64/64 PASS**
- Deployment relationships: verified by the client before the view run
- Evidence state exercised: configured policies/templates, requests 1–3, resolutions 1–3, two facts, resolution history, evidence manifest, freshness, callback counters, protocol config, and not-found-capable wrappers
- Artifact: `artifacts/evidra/phase1_read_certification.json`

Studio Dev rate-limits around 30 requests/minute. The certification therefore uses a 3-second minimum request interval and bounded retry/backoff; the successful run completed without fallback to nonfinal reads.
