# Evidra Protocol V1 — Full Read Certification

Network: GenLayer Studio Dev, chain `61997`  
RPC: `https://studio-dev.genlayer.com/api`  
Addresses: `docs/PROTOCOL_CLIENT_SPEC.md` and `docs/DEPLOYMENT_RECORD.md`

## Public view certification

The read-only script `scripts/read-certification.mjs` invoked every public
view method from the final method matrix exactly once against the new
addresses:

**64/64 PASS**

The script covers 19 PolicyRegistry views, 30 Registry views, 4 Resolver
views, and 11 ConsumerProbe views. It uses the RC GenLayer client, a bounded
2.3-second read interval for Studio Dev’s rate limit, and
`transactionHashVariant: "latest-final"`. The client’s latest-final probe
succeeded and all 64 calls used that variant. The complete per-call record is
`docs/READ_METHOD_CERTIFICATION_POST_SSRF.md` plus
`artifacts/evidra/read_certification_final.json`.

A separate raw JSON-RPC `eth_getBlockByNumber("finalized")` probe returned
`Invalid block number format: finalized`; the application must continue to
probe the exact SDK/RPC read path at startup rather than infer support from a
raw Ethereum method alone.

## State coverage

Additional read-only checks covered:

- EMPTY: missing policy, template, fact, request, resolution, and evidence
  manifest records returned `exists=false`.
- CONFIGURED: policy/template counts, owner/guardian, pause state, fee/bounds,
  policy registry, default resolver, Resolver registration, and capabilities.
- NEGATIVE: request 1 committed `UNRESOLVED` with diagnostic
  `INSUFFICIENT_EVIDENCE` and did not become a boolean canonical truth.
- RESOLUTION: request 2 committed `TRUE`, `NONE`, `policy_satisfied=true`,
  with evidence manifest and callback delivery.
- TEMPLATE: both `launch/1` and `launch_announce/1` were active and readable;
  their stored hashes and default policies were verified.
- REASSESSMENT: request 3 committed resolution 3 for the same fact, with
  `resolution_version=2`, `supersedes_resolution_id=2`, and history `[2,3]`.

## Deployed source identity

`gen_getContractCode` returned Base64 source for each new address. Decoded
source bytes matched the local final source exactly for all four contracts.
