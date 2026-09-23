# Accessibility

The Phase 2 UI uses semantic headings, nav landmarks, native buttons and
links, explicit form labels, `role="alert"` for validation failures, and
`role="status"` for wallet/transaction progress. Focus-visible outlines use
the vermilion signal with a strong offset, and essential interactions do not
depend on hover.

The mobile layout keeps navigation and wizard actions reachable without a
mouse. Tables become stacked/readable content or remain in an explicitly
scrollable wrapper. Hashes and addresses have copy buttons with accessible
labels.

`prefers-reduced-motion: reduce` disables reveal displacement, long
transitions, and continuous skeleton animation. Content remains present and
usable.

The browser smoke suite covers keyboard-independent navigation availability,
mobile rendering, and absence of horizontal overflow. Phase 3 should add a
manual screen-reader pass and automated axe checks against the deployed
production shell before public launch.
