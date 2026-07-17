# Design

The visual system for Life Strategy (Expo app, `apps/mobile`). Every
screen builds from these tokens and components; deviations are drift.

## Signature: the bubble backdrop

The app's identity element. Soft, oversized circles in area hues bleed
off the canvas edges — the portfolio graph's geometry, echoed as
atmosphere. It appears on every screen in one of two modes, and should
persist (and eventually morph) across the whole app:

- **Constellation** (`constellation(theme.areas)`): all six area hues,
  varied sizes — landing and overview moments (home, diagnostic intro).
  A `faint: true` variant halves presence for content-heavy screens
  (diagnostic results).
- **Hue wash** (`hueWash(accent)`): one area's hue washing a focused
  screen — each diagnostic area step wears its own color.

Rules: rendered via `src/components/ui/Backdrop.tsx`, first child of a
container with `overflow: "hidden"`; alphas stay in the 05–1a hex
range (~2–10%); **never behind dense data** — the graph canvas itself
stays clean. Future: when navigation transitions land, circles should
morph between screens (shared-element) rather than pop.

## Color

Tokens in `src/theme/colors.ts`, OKLCH-composed, exported as hex.
Light canvas is pure white, dark is pure near-black; the brand lives in
the hues, never tinting the surface. Six categorical area hues (one
per Strategic Life Area) at matched weight per theme; brand teal
(hue 200) doubles as `accent` for primary actions. Contrast verified:
ink ≥16:1, muted ≥6:1 on both canvases.

## Type & spacing

`src/theme/tokens.ts`. System font only (SF Pro / Roboto), seven-step
scale (display 28 → footnote 12) with negative tracking on large
sizes and tabular numerals for aligned figures. Spacing is a 4-based
scale; `space.screen` (20) is the horizontal gutter. No off-scale
values.

## Components

- `AppText` — the only Text; variant from the scale, color required.
- `Button` — the only button; primary (filled, white label) /
  secondary (surface fill) / quiet (text). All states.
- `Backdrop` — the signature, above.
- `NumberDial` — looping 1–10 carousel on a surface track; haptic
  detents; unset state shows "—" (no anchoring default).

## Voice in UI

User-facing copy says "Priority," never "Importance." Scores are
guidelines; no shame mechanics, no alarm colors, kindness is ambient
and never targeted (see AGENTS.md invariants). Written like a person:
short sentences, few dashes.
