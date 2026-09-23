# Evidra Frontend — Final Product Feedback

Date: 2026-09-22

## A. First impression

Within five seconds, a new visitor can read “Consensus for facts that APIs
can't answer,” see that the system turns a real-world specification into an
inspectable on-chain verdict, and choose Open app, Read docs, or Explore
facts. The landing does not require a wallet to understand the product.

## B. Strongest parts

- Fact detail makes canonical truth and the latest attempt visibly distinct.
- The degraded RPC state is honest: existing indexed records remain available
  while finalized verification is delayed.
- The evidence UI treats URLs as metadata and exposes provenance/policy state
  without rendering remote content.
- The docs and app share a restrained paper/graphite visual system.
- The public route and viewport sweep found no runtime errors or overflow.

## C. What was weak before

The Overview claimed that requests were being accepted while the indexer was
degraded. Activity displayed obsolete field names and therefore looked empty.
The registry hid useful filters, the generic error surface could expose a
transport code, and disconnected submit showed the same error twice. The
mobile wizard also clipped its step navigator. The landing was clear but
needed a more memorable mechanism visual and stronger proof of the protocol's
point of view.

## D. Fixes applied

- added cached/finalized sync status to Overview, landing data, and protocol
  messaging;
- corrected Activity to the normalized API projection;
- centralized user-safe API error wording;
- added policy, template, and mutability registry filters;
- removed duplicate disconnected-submit error rendering;
- changed the mobile wizard to a complete two-column step grid;
- added the active protocol diagram/readout and hero proof strip;
- added regression tests for normalized activity and degraded error wording.

## E. Landing page quality

The hero has strong hierarchy, a clear proposition, useful CTAs, and a custom
protocol visual. The story progresses from the API limitation to evidence,
provenance, canonical records, developer use, and transparency. Motion is
restrained and tied to protocol stages. The production build remains light
enough for this visual system: no video, WebGL, or large visual dependency was
introduced.

## F. App UX

Overview is useful under both healthy and degraded reads. Fact Registry is
scannable and now filterable. Fact detail prioritizes the proposition and
canonical result, then gives the latest attempt, evidence, policy/template,
history, and identifiers. The wizard uses direct contract vocabulary with
plain-language guidance and a visible review step. Policies, Templates,
Activity, and Docs are reachable from both desktop and mobile navigation.

## G. Mobile

The main repaired issue was the clipped Create Fact step strip. At phone
widths it now becomes a two-column grid, keeps all steps visible, and preserves
the sticky action area. The final sweep covered 430, 390, 375, and 360px
widths with no horizontal overflow. Long keys and evidence URLs use wrapping
metadata styles.

## H. Accessibility

The final axe run covered five primary routes at desktop and mobile sizes with
zero Critical, Serious, Moderate, or Minor violations. Manual checks covered
labels, headings, visible focus, keyboard-reachable controls, status text, and
reduced motion.

## I. Performance

Representative public TTFB was 43–100 ms for the tested routes, with the Fact
detail total at 129 ms. Next production build passed; first-load JS was about
300–310 kB by route in the build report. Lighthouse was not run, so no claim
about measured LCP/INP is made here.

## J. Trust / professionalism

Yes, the frontend now feels like a serious protocol workspace: it explains
what is canonical, labels cached data, preserves technical traceability, and
does not manufacture social proof. The interface is deliberately quieter than
a typical crypto dashboard.

## K. AI-slop review

No remaining major generated/template signal was observed. The page avoids
purple-blue AI gradients, orb/globe decoration, fake metrics, generic “unlock
the power” copy, and a wall of interchangeable cards. The remaining visual
grammar is intentionally simple: paper, rules, type, and protocol signals.

## L. Remaining UX debt

- Lighthouse/Core Web Vitals were not collected in this pass.
- Live wallet and write certification remains intentionally separate; this QA
  pass made no chain writes.
- Studio Dev rate limiting still means finalized verification can be delayed;
  the UI now explains that condition instead of hiding it.

These are non-blocking for frontend product QA and remain relevant to the
separate real-wallet certification gate.

## M. Frontend scorecard

| Area | Rating |
| --- | --- |
| Visual identity | Strong |
| Landing | Strong |
| Information architecture | Strong |
| App UX | Strong |
| Mobile | Strong |
| Motion | Strong |
| Accessibility | Production-quality |
| Performance | Strong |
| Developer docs | Strong |
| Trust / credibility | Production-quality |

