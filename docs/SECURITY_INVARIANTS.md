# Evidra Protocol V1 — Post-SSRF Security Invariants

These are the invariants the future app and indexer must preserve. They are
not replacement verdict logic.

## URL boundary

1. Every source URL entering Registry state passes the shared strict validator.
2. Accepted source URLs are HTTPS with an ordinary DNS hostname and implicit
   port or explicit port 443 only.
3. Direct IPv4, IPv6, IPv4-mapped IPv6, and obvious numeric IP encodings are
   rejected, regardless of whether the address is public or private.
4. Localhost/local aliases, userinfo, fragments, malformed authority, empty or
   invalid labels, and control/whitespace tricks are rejected.
5. Resolver validates every stored URL again before Web access.
6. DNS resolution and redirect destination filtering are runtime Web Module
   responsibilities; the contract does not claim to prove them.

## Canonical truth

1. Chain state is canonical; database and UI projections are rebuildable.
2. `FactRecord.current_*` and `get_current_resolution` are canonical truth.
3. `latest_resolution_id` is newest attempt, not automatically canonical.
4. `UNRESOLVED` is a valid committed outcome and must not be shown as TRUE or
   FALSE.
5. Evidence manifest and reasoning summary are committed audit metadata, not
   consensus-certified verdict text.
6. Freshness comes from on-chain `is_fact_fresh`, `valid_until`, mutability,
   and the current canonical outcome.

## Transaction and callback boundary

1. Submitted, decided, finalized, and execution-success states are distinct.
2. A finalized request transaction can still require child Resolver and
   callback reconciliation.
3. Callback `DISPATCHED` is not `ACKNOWLEDGED`.
4. Callback delivery does not define canonical resolution success.
5. The backend never signs as a user, Resolver, Registry, or callback target.

## Release invariant

The final release must contain only source, tests, scripts, docs, and
non-secret certification artifacts. No private key, wallet file, `.env`,
compiled Python cache, or temporary log is releasable.
