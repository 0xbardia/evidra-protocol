# Evidra Landing Design

## Job

The landing page should answer three questions without a tour:

1. What is Evidra? A protocol for resolving semantic facts.
2. Why is it needed? Some real-world claims cannot be answered by a
   deterministic API alone.
3. What can I do next? Explore a public Fact, read the protocol docs, or open
   the application.

## Visual language

- **Base:** warm paper and near-black graphite.
- **Signals:** vermilion for protocol action, amber for attention, moss and
  controlled acid/chartreuse for verified/fresh state.
- **Type:** expressive sans-serif display text for propositions; readable
  interface text; monospace only for hashes, keys, addresses, and protocol
  identifiers.
- **Depth:** spacing, rules, and surface contrast do most of the work. Shadows
  and radii are restrained.

## Hero mechanism

The hero diagram is a small state machine, not decorative network art:

`Fact specification → Evidence → Source policy → GenLayer consensus →
Canonical verdict`

One stage is active at a time. Hovering a node selects it; the timed sequence
provides a quiet explanation for visitors who do not interact. The readout
states the current stage in plain language. Mobile collapses the same sequence
into a vertical track.

## Motion rules

- animate opacity and transforms, not layout dimensions;
- use a short, quiet entrance sequence;
- let state changes explain protocol progress;
- avoid particles, globes, glowing orbs, autoplay video, and scroll hijacking;
- honor `prefers-reduced-motion` and keep all content available without it.

## Content rules

Copy is concrete and protocol-specific. The page does not use generic AI-SaaS
claims, fake social proof, invented metrics, or unsupported integrations.
Real registry data is used when available; unavailable metrics are omitted.

## Responsive rules

The landing keeps the proposition and primary CTA above the fold on phone,
then moves the protocol visual below it. Navigation becomes a compact drawer,
the proof strip remains a three-column reading aid, and sections collapse to a
single deliberate column without horizontal scrolling.

