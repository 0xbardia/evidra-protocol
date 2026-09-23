# Phase 2 Browser Certification

## Automated coverage

`apps/web/test/browser/smoke.spec.ts` runs with Playwright against a local
Next dev server using the installed system Chrome binary. It covers:

1. landing-page heading, docs navigation, and browser console errors;
2. a 390×844 viewport for Fact Registry and Create Fact rendering, including
   the Subject field and horizontal-overflow guard.

Result: **2/2 passed**, 0 failed, 0 skipped. The landing/docs test observed no
browser console errors.

Manual Playwright CLI inspection also covered the landing at 1440×900 and the
Create Fact wizard at 390×844. The visual review found no clipped primary
actions, horizontal overflow, or evidence HTML rendering. The only temporary
development overlay visible in the dev session was Next.js’s local dev
indicator; it is not part of the production build.

The API is mocked only inside these deterministic browser tests so they do not
write to Studio Dev or require a local PostgreSQL instance. Production code
still uses the Phase 1 API and finalized protocol reads.

## Manual visual checklist

The required review points are 1440×900, 1280×800, 1024 tablet, 390×844, and
375-wide mobile. Review the landing flow, app shell, registry, Fact detail,
wizard, and docs navigation for clipped controls, horizontal overflow, focus
visibility, and reduced-motion behavior.

## Phase boundary

No live user wallet write was sent during Phase 2. Wallet and transaction
states are covered by deterministic adapter/component tests and the write path
is wired to `genlayer-js`; real-user E2E approval and finalized Studio Dev
write certification belong to Phase 3.
