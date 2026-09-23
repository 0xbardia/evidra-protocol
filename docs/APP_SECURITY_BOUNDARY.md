# Evidra Protocol V1 — Future Application Security Boundary

## Trust model

- Chain state is canonical, but a contract hash/version/address must be checked before use.
- RPC responses, evidence URLs, rendered web content, reasoning summaries, event payloads, and DB projections are untrusted input.
- The backend is a relay/indexer, not a wallet custodian and not an oracle.
- User wallets sign user writes. The server never impersonates a user address.

## Mandatory controls

- No contract private keys, wallet seed phrases, or signing secrets in frontend bundles, browser storage, logs, CI artifacts, or public API responses.
- Separate Studio Dev, staging, and production environments, RPC URLs, databases, and secrets.
- Validate chain ID `61997` and the frozen address allowlist on every server startup and write/read client construction.
- Validate wallet addresses as exact GenLayer addresses; reject malformed, zero, and chain-incompatible values before submit.
- Prevent duplicate clicks with a client operation key, but reconcile any submitted transaction ID before allowing another write.
- Never let the backend select a caller address or sign a user operation. A future operator wallet, if needed, must be an isolated role with separate policy and audit.
- Rate-limit public APIs by IP, wallet address, route, and expensive search/detail operation. Apply body-size, URL-count, URL-length, and JSON-depth limits.
- Enforce CORS allowlists; do not use `*` with credentials.
- Use CSRF protection for cookie-authenticated browser mutations. Prefer authorization headers with short-lived tokens for server APIs.
- Validate `Origin`/`Referer` where applicable and use same-site cookies if cookies are required.
- Escape all SSR/HTML output. Do not interpolate claim text, reasoning, policy rules, evidence URLs, or error strings into HTML.
- Render evidence only as sanitized text/link data. Do not use raw HTML previews, remote scripts, or unsanitized Markdown from chain content.
- Sanitize and canonicalize URLs for display and apply the same strict app preflight as the patched V1 Registry: HTTPS only, normal DNS hostname, no direct IP literal (including IPv4-mapped IPv6), no localhost/local alias, no userinfo, no fragment, and implicit or explicit port 443 only. The Registry validates every URL ingress and the Resolver revalidates before Web access. DNS resolution and redirect destination filtering remain GenVM Web Module responsibilities; the app must still reject unsafe resolved/redirect targets if it ever performs URL fetching itself.
- Ship a restrictive CSP: no inline script by default, explicit `script-src`, `connect-src` for the frozen RPC/API, `img-src` constrained as needed, `frame-ancestors 'none'`, and HSTS in production.
- Redact private keys, bearer tokens, cookies, RPC credentials, raw prompts, full evidence content, and personal data from logs. Hash wallet addresses only where appropriate for analytics.
- Apply database least privilege, TLS, backups, rotation, and migration review. Treat DB rebuildability as a requirement.
- Keep API and RPC timeouts/retries bounded; never retry a write blindly after an unknown timeout.

## Input boundary rules

- Enforce the contract’s bounds before RPC: 1024-character subject/predicate, 1024 optional object/qualifiers/temporal, 2048 description/notes, 2048 URL, 8 seed URLs, 6 supplemental URLs, 50-page limit, and exact per-contract limits in the method matrix.
- Validate JSON-in-string fields with strict schemas and canonical serialization.
- Reject unknown enum input; preserve unknown enum output for forward compatibility.
- Treat policy semantic rules, template instructions, description, and evidence as data, not backend instructions.
- Do not run commands, fetch URLs, or interpret source content in the backend merely because the chain contains it.

## Wallet and transaction safety

- Confirm the wallet’s chain ID before every write.
- Display target contract, method, normalized arguments summary, protocol value, and network fee separately.
- Persist transaction ID immediately after submission.
- Distinguish submitted, processing, decided, finalized, and execution-failed states.
- Use final-state reads before claiming a durable Fact.
- Never use server-side account substitution if the wallet disconnects mid-flow.

## Canonical truth and caching

- Cache views with explicit finalized observation time and deployment identity.
- Never cache a verdict without its fact key, current resolution ID, resolution version, policy/template hashes, and freshness state.
- Never derive canonical truth from latest attempt order or database timestamps.
- Never expose a DB-only verdict as “on-chain verified.”

## API security

- Authentication is optional for public Fact reads but required for user-specific transaction tracking/credits and any private dashboard.
- Authorize user-specific data by wallet identity and transaction ownership; do not trust a wallet address supplied only in JSON.
- Use pagination and maximum page sizes on every list endpoint.
- Return generic end-user error text with a stable internal error code; keep raw contract/RPC details operator-only.
- Monitor abnormal request/reassessment volume, repeated URL validation failures, callback retries, rate-limit responses, and projection mismatches.

## Post-SSRF invariant

HIGH-001 is closed for direct contract-level URL ingress in the final V1 stack. This does not certify DNS rebinding, destination-IP enforcement, or redirect policy in the hosted Web Module. Never describe a contract-accepted domain as proof that every network hop is public; the runtime sandbox remains a required security layer.

## Final evidence closure

The post-SSRF deployment was rechecked read-only on chain 61997. Its deployed
bytecode hashes match the four final local sources, all 64 unique public views
pass `latest-final` certification, and the independent reconstructed suite
passes 120/120 tests with I1–I23 covered. No private key belongs in the future
application or release artifact; the final ZIP contains no key, wallet,
account, secret, or generated bytecode-cache file.
