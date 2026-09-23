# Evidra Frontend — Product QA

Date: 2026-09-22

## Scope

This review used the public deployment at `https://evidra-protocol.bydx.fun`
as a real reader and an unconnected Create Fact user. No blockchain write was
sent. Studio Dev was in its known rate-limited state, so chain-backed reads
were evaluated through the product's degraded/cached projection path.

## Walkthrough

The first-pass walkthrough covered:

- landing page, Open App, Explore Facts, and Docs;
- Overview, Fact Registry, a TRUE Fact, an UNRESOLVED Fact, Activity,
  Policies, Templates, Developers, and Create Fact;
- the Create Fact wizard from Define fact through Review and the disconnected
  Submit state;
- desktop and mobile navigation, docs navigation, empty/error presentation,
  and copy controls.

The product communicates its central idea quickly: Evidra turns a semantic
claim and an evidence policy into an inspectable on-chain fact. Fact detail
pages make canonical resolution and latest attempt separate records rather
than presenting the newest attempt as truth.

## Bugs found and fixed

1. A degraded protocol snapshot still displayed “Accepting requests”. The
   Overview now says “Finalized reads delayed” and explains that indexed data
   is cached while the chain verifier is unavailable.
2. Activity rendering expected an obsolete `topic/payload/timestamp` shape,
   producing “Protocol event / No payload”. It now consumes the normalized
   `activity_type`, `activity_id`, `status`, `outcome`, and `occurred_at`
   projection fields.
3. Generic transport/API error codes could reach the interface. Shared API
   error formatting now turns degraded reads into an actionable message and
   does not display `internal_error` to normal users.
4. Fact Registry did not expose the API-supported policy, template, and
   mutability filters. Those filters are now available and bounded.
5. Disconnected Create Fact submission rendered the same wallet error twice.
   The submit panel is now the single owner of that error state.
6. The mobile Create Fact step navigator clipped the next step in a horizontal
   strip. It now uses a two-column mobile grid with all eight steps visible.
7. The landing hero now includes an active protocol-stage visual and a compact
   proof strip for policy-bound evidence, preserved history, and inspectable
   on-chain records.

## Browser evidence

Playwright Chromium ran the public routes below at eight viewport sizes:

`1440x900`, `1280x800`, `1024x800`, `768x1024`, `430x932`, `390x844`,
`375x800`, and `360x800`.

Routes: `/`, `/app`, `/app/facts`, a real Fact detail route, `/app/create`,
and `/docs`.

- checks: 48
- horizontal overflow: 0
- uncaught page/console errors: 0
- public route responses: 200 for the tested pages

The final production build was deployed through the existing
`evidra-web.service`; contracts and the API service were not redeployed.

## Accessibility

`@axe-core/playwright` 4.13.0 ran against the public deployment at 1440x900
and 390x844 for `/`, `/app/facts`, `/app/create`, `/docs`, and the real Fact
detail route.

- Critical: 0
- Serious: 0
- Moderate: 0
- Minor: 0
- axe execution errors: 0

Manual checks covered visible focus, semantic headings and labels, keyboard
navigation on primary controls, status text that is not color-only, mobile
navigation, and reduced-motion behavior.

## Performance signal

Representative public HTML timings after deployment:

| Route | Status | TTFB | Total |
| --- | ---: | ---: | ---: |
| `/` | 200 | 97 ms | 97 ms |
| `/app` | 200 | 53 ms | 53 ms |
| `/app/facts` | 200 | 84 ms | 84 ms |
| Fact detail | 200 | 100 ms | 129 ms |
| `/app/create` | 200 | 43 ms | 43 ms |
| `/docs` | 200 | 84 ms | 95 ms |

The Next production build completed successfully. No heavy visual dependency,
video, WebGL scene, or arbitrary remote content was added. Lighthouse was not
run in this pass; these numbers are route timing signals, not Core Web Vitals.

## Remaining boundary

This task intentionally did not import a real wallet, create a Fact, or send a
transaction. Real-wallet Intelligent Contract certification remains a
separate gate. The current RPC quota condition is surfaced in the product and
does not make anonymous browsing blank or misleading.

