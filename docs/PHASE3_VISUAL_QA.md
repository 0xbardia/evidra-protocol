# Phase 3 Visual QA

> Historical visual-QA snapshot from 2026-09-21. Its viewport results describe
> that pass only; the final v1.0.0 production walkthrough is recorded in the
> release notes.

## Public pages inspected

- landing `/`
- overview `/app`
- Fact Registry `/app/facts`
- public Fact detail `/app/facts/<factKey>`
- Create Fact `/app/create`
- docs `/docs`

Screenshots were inspected at 1440px desktop and 390/375px mobile widths.
The public UI uses warm paper and graphite with vermilion, amber, acid, and
moss protocol signals. It does not use a purple/cyan AI gradient identity,
fake social proof, or decorative dashboard metrics.

## Findings fixed during deployment

- public Next.js configuration initially fell back to `127.0.0.1:3000` because
  dynamic environment access was not inlined into the client bundle; direct
  `NEXT_PUBLIC_*` references now make the public API origin explicit;
- overview stats initially read a field name not returned by the API and showed
  an unavailable indexer status; the UI now maps the actual projection fields;
- tight resolution cards inherited display-heading letter spacing and visually
  compressed `Verified true`; the outcome label now resets letter spacing.
- the public Create Fact write path now supplies GenLayer execution fees
  separately from the protocol fee quote and disables duplicate submission;
- the read scheduler now stops a queued batch when Studio Dev reports an
  exhausted quota instead of multiplying the outage with retries.

## Result

The inspected pages had no horizontal overflow, clipped primary controls, or
broken mobile wizard/docs navigation. A dedicated wallet-backed request was
also exercised through the public UI; full Fact/result-state certification is
still blocked by Studio Dev's exhausted daily quota.
