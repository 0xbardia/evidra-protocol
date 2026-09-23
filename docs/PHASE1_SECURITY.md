# Evidra Phase 1 Backend Security

- Contract addresses, chain ID, and Studio Dev RPC are centralized and fail-fast validated against the frozen deployment.
- No private key, wallet secret, signer, or write-capable contract method is required or accepted by the read service.
- All query parameters and route identifiers are Zod-validated and bounded; body size is 64 KiB.
- PostgreSQL access is parameterized. User input is never interpolated into SQL, shell commands, HTML, or log format strings.
- Helmet security headers, explicit CORS origins, request IDs, rate limiting, bounded RPC concurrency, retry backoff, DB timeouts, and graceful shutdown are enabled.
- Evidence URLs are metadata only. The backend never dereferences arbitrary on-chain URLs, preventing the application from becoming a second SSRF surface.
- API output is JSON and Fastify escapes/serializes values; no raw HTML rendering is provided. Future SSR/UI layers must preserve this boundary and use CSP/escaping.
- Logs omit credentials and wallet material. `DATABASE_URL` must come from deployment secrets and is never returned by health/protocol endpoints.
- Canonical truth is always chain-derived. PostgreSQL search/cache values are marked as projection data and must be reconciled before trust-sensitive display.
- Latest/nonfinal reads are never labelled finalized. `latest-final` mode and sync timestamps are exposed for downstream decisions.
- Rate limiting is applied to API requests; reverse proxy/WAF limits remain required in public deployment.

## Later write phases

Wallet submission, transaction reconciliation, CSRF protections for any cookie-authenticated operator surface, nonce/double-click controls, and signer UX belong to a later explicitly authorized phase. They must not be approximated by this read-only service.
