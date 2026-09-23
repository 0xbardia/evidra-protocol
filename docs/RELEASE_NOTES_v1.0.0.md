# Evidra Protocol v1.0.0

Evidra records real-world fact claims as policy-bound, inspectable protocol resolutions. This release hardens the public application and indexed read service. Contract source and deployment are frozen; no contract was changed or redeployed.

## Product

- Public landing, protocol overview, Fact registry and detail, policies, templates, activity, developer reference, and documentation.
- Create Fact flow with template-required-field checks, template freshness rules, active-template enforcement, evidence URL validation, and a complete pre-wallet review.
- Fact pages distinguish canonical resolutions from latest attempts and show freshness and provenance.
- Database/resource failures return a sanitized `503 read_service_unavailable`; the web app explains indexed-service downtime without exposing internal errors or mislabeling it as RPC delay.
- Page metadata includes unique titles, descriptions, canonical URLs, Open Graph and X cards. Robots, sitemap, malformed Fact handling, and the branded 404 were verified against production.

## Network and frozen contracts

- Network: GenLayer Studio Dev, chain `61997`
- Public app: <https://evidra-protocol.bydx.fun>

| Contract | Address |
| --- | --- |
| PolicyRegistry | `0x8583F226DB262a97dba3f00c3D2A0D13D08B6c71` |
| Registry | `0xB18f84F0dE3F7aB600C6A07Ec85408a7000b93b6` |
| Resolver | `0xD21E9e95CBd59058fbCC2599C3A28a3faE44C477` |
| ConsumerProbe | `0x5B73a45BA6b3560B6ECd020FefF95c5Fa0693C2F` |

`pnpm verify:contracts` confirms all four expected source hashes. The release did not modify `contracts/` or deploy contracts.

## Production verification

- `/api/v1/health`, `/network`, `/protocol`, and `/facts` return `200`; PostgreSQL is active, out of recovery, and serves the expected schema. Nginx, API, and web services are active.
- `/api/v1/ready` returns `503 rpc_quota` while the Studio Dev provider cooldown is active. Indexed database reads remain healthy; the indexer correctly stays paused while its RPC budget is exhausted.
- Normal public routes returned `200` with one meaningful H1 and no horizontal overflow at 1440×900. Playwright recorded zero console errors, uncaught page errors, or hydration errors in the normal route sweep.
- The Create flow blocked a missing required temporal field, explained the immutable template rule, blocked an unavailable stale template, and showed object, qualifiers, time scope, policy, freshness, evidence, and reuse in review. QA stopped before wallet approval; no chain write was sent.
- A simulated resource outage showed a single Fact H1 and the sanitized indexed-service message, with no raw internal error.
- Axe found zero Critical or Serious violations across landing, registry, existing Fact, Create, and Docs at 1440×900, 390×844, and 375×800. The branded 404 also passed at all three sizes.
- Production SEO checks confirmed unique titles, descriptions and canonical URLs for public product routes; Open Graph/X metadata; an accessible robots file and sitemap; branded noindex 404s for malformed and nonexistent Facts.

## Build and security checks

- Workspace typecheck and lint pass.
- Workspace tests: 49/49 pass — protocol 11, config 2, database 1, web 20, API 15. Web checks were rerun after the final 404 metadata change.
- Production build passes. First-load JavaScript on reviewed routes is 147–159 kB. Next.js prints a non-blocking notice that its ESLint plugin is not configured; the workspace lint command passes.
- Dependency audit: zero Critical and zero High findings; one Low advisory remains in transitive ESLint tooling (`@eslint/plugin-kit`, GHSA-xffm-g5w8-qvg7).
- Staged-file secret scan is clean. Runtime configuration, wallet material, database files, logs, browser state, and generated build output are excluded from the repository.

## Release limitation

Studio Dev currently reports `rpc_quota`; readiness remains unavailable until the provider cooldown ends. This is reported as-is. No real-wallet transaction was attempted, so this product release is **not** a real-wallet certification.
