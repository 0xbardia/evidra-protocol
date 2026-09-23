# Evidra Design System

## Visual direction

Evidra uses a warm paper surface and graphite ink, with restrained vermilion,
amber, acid/chartreuse, and moss signals. The palette is intentionally not the
standard purple/blue/cyan AI palette. Signals communicate protocol state:

- vermilion: action, attention, failed or negative state;
- amber: pending, stale, or unresolved state;
- acid/chartreuse: fresh, canonical, or successful state;
- moss: supporting positive state;
- graphite/paper: primary hierarchy and reading surface.

There are no decorative rainbow gradients, fake logos, usage claims, or
generic AI slogans.

## Type

Interface copy uses a readable system sans stack. Hashes, addresses, IDs,
timestamps, field hints, and protocol labels use a compact system monospace.
Mono is not used for long-form reading. Display headings are large but
bounded, with tight tracking and short protocol-specific copy.

## Components

The UI keeps a deliberately small vocabulary: buttons, status pills, outcome
badges, panels, timelines, evidence cards, data rows, skeletons, empty/error
states, wizard fields, and copy controls. Reusable behavior lives in
`apps/web/src/components`; there is no general-purpose UI kit.

## Motion

Motion explains lifecycle and hierarchy: hero flow nodes, reveal-on-scroll
sections, focus/hover feedback, and transaction progress. It uses transform
and opacity where possible. `motion/react` and CSS both honor
`prefers-reduced-motion`; reduced motion disables reveal displacement,
continuous skeleton animation, and long transitions without hiding content.

## Responsive rules

The desktop app uses a compact sidebar and workspace. At tablet widths the
sidebar becomes a wrapping navigation row; on mobile it becomes a purpose-built
header/mobile navigation and the create wizard becomes a horizontal step rail.
Fact rows and resolution panels collapse into readable blocks rather than
forcing a wide table. Hashes wrap or truncate with copy controls.

## State semantics

Canonical resolution and latest attempt use separate visual cards and labels.
Fresh/stale is a time state, not confidence. `UNRESOLVED` is neither success
nor failure. Evidence is metadata and provenance, never injected page HTML.
