# Evidra Protocol V1 — Final Deployed Read Certification

> Historical read certification from 2026-09-21. Its provider behavior is a snapshot, not current runtime status; use [`DEPLOYMENT_RECORD.md`](DEPLOYMENT_RECORD.md) for frozen addresses and [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md) for this release's RPC status.

Date: 2026-09-21

## Network and deployment

- Network: GenLayer Studio Dev
- RPC: `https://studio-dev.genlayer.com/api`
- Chain ID: `61997`
- Read variant: `latest-final`
- Latest-final probe: PASS (`evidra-policy-registry-v1`)
- Writes sent during this certification: none

Addresses were the existing post-SSRF frozen V1 deployment:

| Contract | Address |
|---|---|
| EvidraPolicyRegistry | `0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71` |
| EvidraRegistry | `0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6` |
| EvidraResolver | `0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477` |
| EvidraConsumerProbe | `0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F` |

## Result

**64/64 unique public views PASS.**

| Contract | Views | Result |
|---|---:|---|
| EvidraPolicyRegistry | 19 | 19/19 PASS |
| EvidraRegistry | 30 | 30/30 PASS |
| EvidraResolver | 4 | 4/4 PASS |
| EvidraConsumerProbe | 11 | 11/11 PASS |

The companion JSON records every method, arguments, expected semantics, and
normalized actual result:

`artifacts/evidra/read_certification_final.json`

## Existing-state scenarios

15 additional finalized reads passed, covering:

- configured policy and template
- missing policy and template
- existing request and resolution
- canonical and latest resolution pointers
- resolution history
- evidence manifest
- freshness
- callback counter
- protocol configuration
- missing request and fact behavior

The historical fact returned `TRUE`, with canonical/latest resolution ID 3,
history `[2,3]`, and `is_fact_fresh=true`. The callback counter was readable
at 3. These are observations only; they were not changed by this task.

## Transport note

The SDK `latest-final` transaction-hash variant succeeded for the complete
certification. A raw JSON-RPC `eth_getBlockByNumber("finalized", false)` probe
is not supported by this RPC and was not used as a fallback.
