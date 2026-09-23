# Evidra Protocol V1 — Post-SSRF Read Method Certification

> Historical read certification from 2026-09-21. Its provider behavior is a snapshot, not current runtime status; use [`DEPLOYMENT_RECORD.md`](DEPLOYMENT_RECORD.md) for frozen addresses and [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md) for this release's RPC status.

Certification date: 2026-09-21 UTC  
Network: GenLayer Studio Dev (`chain_id=61997`)  
RPC: `https://studio-dev.genlayer.com/api`

## Result

**64/64 unique public view methods PASS.** Each method was invoked once on the
post-SSRF addresses. The complete machine-readable record is
`artifacts/evidra/read_certification_final.json`; every record contains the
contract, method, serialized arguments, expected semantics, decoded actual
result, and PASS/FAIL status.

The certification used GenLayer JS RC `2.0.0-rc.1` with the SDK
`transactionHashVariant: "latest-final"`. The variant probe succeeded and the
64 calls used it. A separate raw JSON-RPC `eth_getBlockByNumber("finalized")`
probe returned `Invalid block number format: finalized`; this is recorded as a
transport capability distinction, not silently treated as proof that the raw
Ethereum tag is supported.

## Coverage

| Contract | Unique views invoked | Result |
|---|---:|---|
| `EvidraPolicyRegistry` | 19 | 19/19 PASS |
| `EvidraRegistry` | 30 | 30/30 PASS |
| `EvidraResolver` | 4 | 4/4 PASS |
| `EvidraConsumerProbe` | 11 | 11/11 PASS |
| **Total** | **64** | **64/64 PASS** |

The invoked methods are the complete public view inventory from
`docs/CONTRACT_METHOD_MATRIX.md`:

- PolicyRegistry: `get_source_policy`, `get_latest_source_policy`,
  `is_source_policy_active`, `get_policy_hash`, `get_template`,
  `get_latest_template`, `is_template_active`, `get_template_hash`,
  `get_latest_policy_version`, `get_latest_template_version`, `get_ownership`,
  `get_owner`, `get_pending_owner`, `get_protocol_stats`, `get_event_count`,
  `get_events`, `compute_policy_hash`, `compute_template_hash`,
  `get_registry_version`.
- Registry: `get_request`, `get_request_status`, `get_fact`,
  `get_current_resolution`, `get_latest_resolution`, `get_resolution`,
  `get_resolution_history`, `get_evidence_manifest`, `compute_claim_key`,
  `compute_fact_key`, `compute_spec_hash`, `is_fact_fresh`, `can_reuse_fact`,
  `can_reuse_with_freshness`, `compute_callback_id`, `quote_resolution_fee`,
  `get_protocol_config`, `get_resolver`, `get_protocol_stats`, `get_credit`,
  `get_job_snapshot`, `get_owner`, `get_guardian`, `is_paused`,
  `get_policy_registry`, `get_default_resolver`, `get_registry_version`,
  `get_event_count`, `get_events`, `validate_seed_url`.
- Resolver: `get_resolver_version`, `get_registry`, `get_capabilities`,
  `get_capabilities_json`.
- ConsumerProbe: `get_trusted_registry`, `get_last_request_id`,
  `get_last_fact_key`, `get_last_resolution_id`, `get_last_outcome`,
  `get_last_resolved_at`, `get_last_valid_until`, `get_last_callback_id`,
  `get_callback_count`, `get_duplicate_ignored_count`,
  `has_processed_callback`.

## Scenario coverage

Additional read-only calls in the companion JSON covered existing on-chain
states without manufacturing new state:

| State | Observed result |
|---|---|
| Configured policy/template | Existing `core/1` and `launch/1` records returned `exists=true`, active, and hash-bearing. |
| Empty/not-found | Missing policy, template, request, and fact returned their defined empty records with `exists=false`. |
| Resolution | Request 3 and resolution 3 returned `RESOLVED`, `TRUE`, `NONE`, `policy_satisfied=true`. |
| Canonical/latest split | `get_current_resolution` and `get_latest_resolution` both resolved to the committed reassessment record; history returned `[2,3]`. |
| Evidence | Resolution 3 returned its manifest and manifest hash. |
| Freshness | `is_fact_fresh` returned `true` for the immutable canonical fact. |
| Callback | Consumer callback count returned `3`; callback state was readable. |
| Protocol configuration | Registry returned the configured policy registry, default resolver, enabled resolver, unpaused state, fee and bound values. |

## Deployment identity checked by these reads

- PolicyRegistry: `0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71`
- Registry: `0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6`
- Resolver: `0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477`
- ConsumerProbe: `0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F`

Read-back relationships were correct: Registry → PolicyRegistry, Registry →
Resolver, Resolver → Registry, and ConsumerProbe → Registry. The Registry was
unpaused and the registered default Resolver was enabled.
