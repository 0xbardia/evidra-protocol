# Production Deployment

This document describes the public runtime and deployment procedure for
`evidra-protocol.bydx.fun`. Historical Phase 3 gate language below has been
replaced with the current release distinction: product/code publication does
not imply real-wallet hosted-network certification.

## Runtime

- OS service user: `evidra` (non-login, non-root)
- API: `127.0.0.1:3000`, systemd unit `evidra-api`
- Web: `127.0.0.1:3100`, systemd unit `evidra-web`
- Public proxy: nginx on ports 80 and 443
- Database: PostgreSQL database `evidra_prod`, role `evidra`
- Node runtime: pinned host binary under `/usr/local/lib/evidra/node`

The application ports are loopback-only. Public traffic reaches the services
through nginx; neither Node service is directly internet-facing.

## Environment

The production environment is stored outside the repository at
`/etc/evidra/evidra.env` with restrictive ownership. Use
`deploy/env/evidra.env.example` as the non-secret shape. It contains only the
frozen Studio Dev RPC, chain ID, addresses, indexer settings, CORS origin, and
database connection shape.

Configuration loading fails if the RPC URL, chain ID, or contract addresses do
not match the frozen V1 deployment. A temporary RPC outage does not prevent the
HTTP liveness listener from starting; `/api/v1/ready` remains unavailable
until deployment verification and a finalized indexer run succeed.

## Deployment sequence

1. Install the pinned Node runtime and dependencies with the lockfile.
2. Create the least-privilege PostgreSQL role/database.
3. Run `pnpm db:migrate`.
4. Build the API and web applications.
5. Install the two systemd units and enable them at boot.
6. Install the nginx site and validate with `nginx -t`.
7. Obtain/renew the Let’s Encrypt certificate for the exact hostname.
8. Confirm `/api/v1/ready` only after the first finalized index succeeds.

The public host must be checked with direct DNS resolution as well as through
any local proxy or CDN. The certificate must contain
`evidra-protocol.bydx.fun`.

## TLS and proxy

nginx redirects HTTP to HTTPS, serves the Let’s Encrypt full chain, applies
security headers, and proxies `/api/` to Fastify and all other paths to
Next.js. The API proxy allows a long read timeout because finalized Studio Dev
reads can be slow; this is not a reason to add a write proxy.

Certificate renewal is managed by the host’s Certbot timer. The current
certificate was issued for the production hostname and should be checked with
`certbot renew --dry-run` during operations maintenance.

## Wallet certification status

No real-wallet transaction is claimed by v1.0.0. If Studio Dev RPC quota
prevents a safe live journey, leave the certification pending and report it
separately; do not use a scripted write or treat a code release as wallet
certification. Product publication is not blocked by this hosted-network
limitation.
