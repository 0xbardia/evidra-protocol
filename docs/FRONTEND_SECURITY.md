# Frontend Security

- Frozen chain ID and contract addresses are centralized and validated.
- Wallet writes use only the injected user provider; there is no server key or
  private-key input.
- Evidence URLs are untrusted metadata. The app never fetches, iframes, or
  renders remote HTML. External links use `https`, `target="_blank"`, and
  `rel="noreferrer noopener"` after URL validation.
- API and query inputs are bounded in the route/client layer. UI output is
  rendered as text, not `dangerouslySetInnerHTML`.
- API calls use the Phase 1 parameterized server API; the web app does not
  construct SQL or shell commands.
- Only public environment variables are bundled. No database URL, API secret,
  wallet secret, or auth header is stored in the browser.
- Local storage contains only a transaction recovery pointer. It does not
  contain credentials or signed payloads.
- The UI blocks wrong-network writes and existing pending writes.
- Copyable hashes and addresses are rendered with text nodes and accessible
  labels. No open redirect accepts arbitrary explorer domains; explorer URLs
  come from the frozen protocol helper.
- Security headers/CORS/rate limiting remain owned by the Phase 1 API. The
  Phase 3 deployment must add the production CSP and edge policy without
  weakening these application boundaries.

The frontend performs convenience validation only. Contract validation and
the GenVM Web Module remain the final URL and resolution security boundaries.
