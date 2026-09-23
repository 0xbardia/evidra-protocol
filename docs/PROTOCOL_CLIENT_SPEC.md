# Evidra Protocol V1 — Shared Protocol Client Specification

> Historical Phase 0 design specification. The client now exists in [`packages/protocol`](../packages/protocol); use that implementation and the current deployment record as the source of truth.

Recommended future package: `packages/protocol`. This Phase 0 document defines its contract; it does not build the package.

## Network constants

```ts
export const EVIDRA_NETWORK = {
  chainId: 61997,
  rpcUrl: "https://studio-dev.genlayer.com/api",
  explorerUrl: "https://explorer-studio-dev.genlayer.com",
  registry: "0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6",
  policyRegistry: "0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71",
  resolver: "0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477",
  consumerProbe: "0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F",
} as const;
```

The client must assert chain ID and address allowlist at startup. Do not make the RPC or addresses configurable from untrusted browser input. A separate explicitly named configuration is required for any future network.

## Wrapper groups

Expose small wrappers that mirror the frozen methods:

```text
policyRegistry.read / write-admin
registry.read / write-user / write-admin / write-callback
resolver.read
consumerProbe.read / write-test-only
transactions.get / waitForDecision / waitForFinalization
```

The public product client should expose user writes only: `requestFact`, `requestFactByTemplate`, `refreshFact`, `requestReassessment`, `retryResolution`, `cancelStaleRequest`, `withdrawCredit`, and `requestCallbackRetry`. Admin methods and resolver/consumer callback methods must be separate modules or explicitly unavailable to ordinary product code.

## Serialization

- `u256`/`u32` arguments: accept `bigint` in TypeScript; serialize as decimal-compatible SDK values; decode as `bigint`.
- Addresses: validate exact 20-byte hex or GenLayer `addr#` form; normalize to lowercase `0x` for hashes/API.
- JSON fields (`seed_urls_json`, `supplemental_urls_json`, `items_json`, `manifest_json`, `resolution_ids_json`, protocol stats strings): serialize compact JSON with deterministic array order; parse with size and schema limits.
- Hashes: preserve lowercase hex without adding `0x`.
- Enum inputs: reject unknown local values before wallet submission, but preserve unknown chain values in read models.
- Text normalization for previews must match contract only where documented; the contract remains the authority for all computed hashes.

## Read variants

Prefer `transactionHashVariant: "latest-final"` / SDK `TransactionHashVariant.LATEST_FINAL` whenever the RPC supports it. During post-SSRF certification, Studio Dev returned an unsupported error for the JSON-RPC `finalized` block tag; certification therefore waited for each transaction’s `FINALIZED` status and used `latest-nonfinal` for subsequent view calls. Phase 1 must probe this capability at startup and record the read variant in every projection. Non-final reads may be used for progress indicators only and must be labeled provisional.

The shared client must expose the Registry `validate_seed_url` view and apply the same strict local preflight: HTTPS only, normal DNS hostname, no direct IP literal, no localhost/local alias, no userinfo, no fragment, and implicit or explicit port 443 only. This is a UX preflight, not a replacement for the Registry and Resolver checks.

## Identifier helpers

Expose wrappers for the contract views rather than reimplementing truth logic:

- `computeClaimKey` → `compute_claim_key`
- `computeFactKey` → `compute_fact_key`
- `computeSpecHash` → `compute_spec_hash`
- `computeCallbackId` → `compute_callback_id`
- `quoteResolutionFee` → `quote_resolution_fee`
- `isFactFresh`, `canReuseFact`, `canReuseWithFreshness`

These helpers are previews. The write and finalized read are authoritative. Frontend/backend must not independently invent verdict logic, canonical advancement, policy satisfaction, or freshness semantics.

## Type mappings

Use the exact interfaces in `PROTOCOL_TYPES.md`:

```ts
type Outcome = "TRUE" | "FALSE" | "UNRESOLVED";
type Mutability = "IMMUTABLE" | "MUTABLE_WITH_TTL";
type ReuseMode = "REUSE_IF_FRESH" | "FORCE_FRESH_RESOLUTION";
type RequestStatus = "PENDING" | "DISPATCHED" | "RESOLVED" | "REUSED" | "CANCELLED" | "FAILED" | "UNKNOWN";
type CallbackStatus = "NOT_REQUESTED" | "DISPATCHED" | "ACKNOWLEDGED" | "FAILED_REPORTED";
```

Use discriminated read models for `canonicalResolution` and `latestResolution`, rather than a single `resolution` property.

## Error normalization

Normalize SDK/RPC errors into a stable object with `kind` (`contract`, `rpc`, `wallet`, `execution`, `configuration`, or `decode`), optional exact contract `code`, `retryable`, safe `userMessage`, operator-only detail, and optional `txId`.

Use the exact codes in `CONTRACT_ERROR_CATALOG.md`; never pattern-match only on English RPC text. Strip internal prompts, private data, and raw validator logs from end-user messages.

## Transaction normalization

Return a stable app lifecycle with these states: `not_submitted`, `submitted`, `processing`, `decided`, `finalized` with execution `success|failure`, `canceled`, and `unknown`. Preserve the GenLayer transaction ID and optional phase/outcome.

`finalized/success` is necessary but not sufficient for an Evidra Fact page: hydrate the target contract and any triggered resolver/callback children afterward.

## Explorer helpers

Use the frozen explorer base and URL-encode identifiers. The intended helpers are `txUrl(txId)` and `addressUrl(address)` under `https://explorer-studio-dev.genlayer.com`; verify the explorer’s final route format during Phase 1 before shipping links. Never silently switch to another network/explorer.

## Compatibility lock

The post-SSRF Studio Dev certification used the RC toolchain (`genlayer-js` `2.0.0-rc.1` with GenLayer CLI `0.40.0-rc.3`); the stable 1.x client produced malformed contract-call decoding on this chain. Exact Phase 1 package versions must still be locked only after a compatibility spike confirms schema decoding, `LATEST_FINAL` support, browser wallet writes, transaction status/finalization, and chain `61997`. Do not infer compatibility from package names alone.
