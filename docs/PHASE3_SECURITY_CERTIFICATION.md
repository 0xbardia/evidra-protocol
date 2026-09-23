# Phase 3 Security Certification

> Historical security snapshot from 2026-09-21. Its deployment and RPC states
> are not current release certification; v1.0.0 results are recorded in
> [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md).

## Scope

This is an application/deployment certification. The V1 contracts and frozen
addresses were not modified or redeployed.

## Controls verified

- contract hash verification passed for all four frozen sources;
- server configuration validates chain `61997`, RPC, and all four addresses;
- no server-side wallet or private key is present;
- API and web bind to loopback and are supervised by systemd;
- nginx terminates TLS and applies HSTS, frame, MIME, referrer, permissions,
  and CSP headers;
- CORS is restricted to `https://evidra-protocol.bydx.fun`;
- Fastify high/critical advisories were closed by upgrading to `5.12.5`;
- API inputs use bounded Zod schemas, parameterized repository queries, body
  limits, request IDs, rate limits, and generic error responses;
- evidence URLs are never fetched by the backend and never rendered as iframe
  or arbitrary HTML by the frontend;
- the frontend validates the frozen chain before wallet writes and does not
  persist private wallet material;
- a public `/api/.env` probe returned `404`;
- repository scans found no committed environment file, private key, wallet
  file, or database dump;
- old superseded contract addresses occur only in explicitly historical Phase
  0 documents, not active application configuration.

## Dependency result

The production dependency audit has zero unresolved HIGH or CRITICAL findings.
One LOW transitive advisory remains in `@eslint/plugin-kit` through the
GenLayer/ESLint development toolchain. It is not in the runtime API/web
production dependency path and should be revisited when the pinned GenLayer
toolchain publishes a compatible update.

## RPC quota containment

The shared read scheduler now detects the provider's exhausted-quota response,
rejects the current read, and clears queued reads instead of retrying every
queued operation. This limits quota amplification while preserving retries for
ordinary transient failures. Readiness remains fail-closed and returns `503`
when finalized deployment verification cannot run.

The remaining provider response is external:
`Rate limit exceeded: 5000 requests per day`.

## Residual controls/limitations

The CSP currently permits `unsafe-inline` for Next.js hydration/style output;
it does not permit `unsafe-eval`. A nonce/hash migration can be evaluated when
the rendering setup supports it without weakening the application. Certbot is
configured for renewal; the certificate registration did not include an
operator email, so host monitoring must cover renewal failures.

The real public UI request write was executed, but final wallet-backed Fact
certification is blocked until Studio Dev quota recovery permits the resolver
result and API reconciliation to be read.
