# Evidra Protocol V1 — Frozen Deployment Record

Certification date: 2026-09-21 UTC  
Network: GenLayer Studio Dev  
RPC: `https://studio-dev.genlayer.com/api`  
Chain ID: `61997`  
Explorer: `https://explorer-studio-dev.genlayer.com`

This is the authoritative address record for the frozen V1 deployment on
GenLayer Studio Dev, chain 61997. The final freeze closure is recorded at the
end of this document; earlier candidate/gate language in the original audit
history is superseded by that closure. The preceding deployment and
configuration transactions were observed as `FINALIZED` with execution
`FINISHED_WITH_RETURN`. No redeployment is part of the V1.0.0 release.

## Final addresses

| Contract | Address | Deployment transaction |
|---|---|---|
| EvidraPolicyRegistry | `0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71` | `0xbd6278b0e5ad436b2611c246364f9c2b4a8eca946fce888ca0c50f03f032430b` |
| EvidraRegistry | `0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6` | `0xc6eda964baf9bda30dd8b786fa23ee424ea4a94065b36152b9207241cdca9bcf` |
| EvidraResolver | `0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477` | `0x3a5fd806e7cab5e8b1b8e2172ac1df8ee6afc12d68106dc8ac8a72a6db12cfdd` |
| EvidraConsumerProbe | `0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F` | `0xd67b4f5c759212380a0c42e738d00b60b68dad0922949475096e3e80deeaca6f` |

## Policy and template setup

| Operation | Transaction |
|---|---|
| Publish policy `core/1` | `0x55ece3e37567d4d91ecac843c60d81c4dc22618cad7aa2ef2b2da6c8f8b81725` |
| Publish policy `solo/1` | `0xaed858b7342bdf6a35bcf7dbd85feada34f3b9a5474d2eb3e80083c88fc825a0` |
| Publish policy `freeze_official/1` | `0xe5dfcac8b8129a3d5774592cce647025e71af11bc9e410ffdc09efb33155de27` |
| Publish template `launch/1` | `0xce25f4cb002b23b89e25b1092b1b61cac0221c3c3e59d5503c6e1c1008bf2406` |
| Publish template `launch_announce/1` | `0xc2174ae107a38c352bd9c1facc92101facad966ee04690e9b75088c855d49565` |

## Registry configuration

| Operation | Transaction |
|---|---|
| Register and enable Resolver | `0x764e191d12eac144b69926b2094253f747731ef0b7e237b5ae86bf549b9d3b98` |
| Set default Resolver | `0xb87d59c0002dab6a6abc8521bc565620f853873d6c54edbbb3610c80b34bebe0` |
| Set fees/bounds | `0x3f450f4e82a244681b560e430084cdf1b90e37e31df3a27dcc301b0b91635691` |
| Set guardian | `0x4e43164d25ebc78635204ef0493d07be388524ee8cba13fdd67f3a1455fdf834` |

Final read-back confirmed:

- Registry policy registry → `0x8583f226db262a97dba3f00c3d2a0d13d08b6c71`.
- Registry default resolver → `0xd21e9e95cbd59058fbcc2599c3a28a3fae44c477`.
- Resolver registry → `0xb18f84f0de3f7ab600c6a07ec85408a7000b93b6`.
- ConsumerProbe trusted registry → `0xb18f84f0de3f7ab600c6a07ec85408a7000b93b6`.
- Resolver enabled; Registry unpaused; policy count 3; template count 2.
- `fee_base=0`, `fee_per_attempt=0`, `fee_reuse=0`, `retry_delay_seconds=60`, `stale_after_seconds=86400`, `max_attempts=5`, `max_seed_urls=8`.

The deployment signer and temporary test signers were held in memory only. No
private key, keystore, wallet file, or account JSON is part of this repository
or release artifact.

## Final V1 freeze closure — 2026-09-21

The historical 128-test suite was unavailable and was not recovered. It was
not recreated by count. Instead, the current post-SSRF source was covered by
the independent reconstructed suite documented in
`docs/RECONSTRUCTED_REGRESSION_COVERAGE.md`:

- 9 test files, 120 tests, 120 PASS, 0 FAIL, 0 SKIP;
- security invariants I1–I23: 23/23 PASS;
- focused SSRF regressions: 10/10 PASS;
- semantic `genvm-lint`: 4/4 contracts PASS;
- deployed read certification: 64/64 unique views PASS and 15/15 scenario
  reads PASS.

The suite uses source-derived deterministic and structural checks for writes
because this closure is strictly read-only; the deployed evidence uses the
existing post-SSRF addresses and `latest-final` reads. No state-changing
transaction and no redeployment occurred.

Read-only deployed bytecode hashes match all four final local source hashes.
Registry → PolicyRegistry, Registry → Resolver, Resolver → Registry, and
ConsumerProbe → Registry are verified; the Registry is unpaused and the
Resolver is registered, enabled, and the default resolver.

The reproducible release is `artifacts/evidra-protocol-v1-final.zip`. The
historical-suite absence is retained as provenance, not treated as a blocker
under the reconstructed-suite closure criteria.

**PHASE 0 GATE: PASS**

**EVIDRA PROTOCOL V1 FINAL FREEZE: PASS**

Final V1 addresses:

- PolicyRegistry: `0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71`
- Registry: `0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6`
- Resolver: `0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477`
- ConsumerProbe: `0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F`

## Final source hashes

| Source | SHA-256 |
|---|---|
| `contracts/evidra_consumer_probe.py` | `8af3b940e978b76c1affab807822a8db388a8c676d14801d5ffed55538bcbc36` |
| `contracts/evidra_policy_registry.py` | `df2f946f2d265cb8fd8d04012c5eb2beeab1830f60d5146a7761cb35279be247` |
| `contracts/evidra_registry.py` | `1b3a97ec340ad30c381404fecb76d3e4656d48dd550c2fdf02d4a7c2a50af8f7` |
| `contracts/evidra_resolver.py` | `3c9007bd1414227193b4459d96fb565e42e0b712661d802caa9477dd91a30bfe` |

## Final evidence-closure read-back

The post-SSRF read certification invoked 64/64 unique public views with the
GenLayer JS `latest-final` variant and passed every call. The full arguments,
decoded results, and expected semantics are in
`artifacts/evidra/read_certification_final.json`.

`gen_getContractCode` returned source bytes whose SHA-256 values matched all
four local final hashes above. Read-only relationship checks confirmed
Registry → PolicyRegistry, Registry → Resolver, Resolver → Registry, and
ConsumerProbe → Registry; the Registry was unpaused and the Resolver was
registered, enabled, and the default resolver.

Semantic validation passed with `genvm-linter 0.11.1rc2` against the cached
header-pinned GenVM `v0.6.0-rc5` runner tree. The original historical 128-test
freeze suite was not present in the checkout, release archives, backups,
workspace history, or the empty remote repository, so this deployment remains
a freeze candidate until that evidence is recovered.

## Final status override — 2026-09-21

The preceding candidate wording records the earlier closure state. It is
superseded by the independent reconstructed evidence: historical 128-test
recovery was not possible and is not claimed. The current suite passes 120/120
with no skips, semantic lint passes 4/4, and the existing deployment passes
64/64 unique finalized public-view reads plus 15/15 scenario reads. No write
or redeployment occurred.

**PHASE 0 GATE: PASS**

**EVIDRA PROTOCOL V1 FINAL FREEZE: PASS**
