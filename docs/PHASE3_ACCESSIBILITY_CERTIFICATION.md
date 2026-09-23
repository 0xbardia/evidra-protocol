# Phase 3 Accessibility Certification

> Historical axe snapshot from 2026-09-21. These results cover that test run
> only; v1.0.0 accessibility results are recorded in
> [`RELEASE_NOTES_v1.0.0.md`](RELEASE_NOTES_v1.0.0.md).

## Automated axe run

`@axe-core/playwright` `4.13.0` was run against the public HTTPS deployment
with Chromium at desktop `1440x900` and mobile `390x844` for:

- `/`
- `/app/facts`
- `/app/create`
- `/docs`
- a public Fact detail route

All ten scenarios returned HTTP 200 and produced:

- Critical: `0`
- Serious: `0`
- Moderate: `0`
- Minor: `0`
- browser/axe execution errors: `0`

The run was read/UI-state focused; it did not create another chain write.

## Manual checks

- semantic headings, labels, buttons, links, form controls, and status text
  were exercised on the public landing, registry, Fact detail, Create Fact,
  and docs routes;
- keyboard-visible focus styles are present in shared UI styles;
- transaction and error states use text, not color alone;
- mobile navigation and wizard controls remain reachable at 390px and 375px;
- reduced motion is handled by component motion settings and the global
  `prefers-reduced-motion` rule;
- no blocking keyboard, focus, mobile clipping, or screen-reader naming issue
  was found in the production smoke pass.

## Result

The axe closure requirement passed for the tested public pages. Final Phase 3
certification remains blocked only by Studio Dev quota exhaustion and the
resulting inability to complete resolver/Fact reconciliation.
