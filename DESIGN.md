---
name: Glide
description: A personal planning app that turns monthly life diagnostics into a daily checklist and a grade out of 100.
colors:
  canvas-light: "#ffffff"
  canvas-dark: "#070707"
  surface-light: "#eef1f1"
  surface-dark: "#111416"
  ink-light: "#151c1e"
  ink-dark: "#e4e9e9"
  muted-light: "#5a6569"
  muted-dark: "#929a9b"
  hairline-light: "#dbdfe0"
  hairline-dark: "#2e2e2e"
  accent-light: "#007a80"
  accent-dark: "#3ebfc6"
  on-accent-light: "#ffffff"
  on-accent-dark: "#070707"
  danger-light: "#a63d33"
  danger-dark: "#ee9086"
  scrim: "rgba(0, 0, 0, 0.45)"
  area-relationships-light: "#bb565a"
  area-relationships-dark: "#eb8182"
  area-physical-health-light: "#4a925c"
  area-physical-health-dark: "#6fc082"
  area-mental-wellbeing-light: "#007a80"
  area-mental-wellbeing-dark: "#3ebfc6"
  area-work-money-light: "#3d73b6"
  area-work-money-dark: "#64a1ee"
  area-home-environment-light: "#b8892d"
  area-home-environment-dark: "#e3ad4b"
  area-leisure-creativity-light: "#7d5fad"
  area-leisure-creativity-dark: "#ab8be3"
typography:
  display:
    fontFamily: "Manrope (400/500/600/700, bundled)"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "34px"
    letterSpacing: "-0.5px"
  title:
    fontFamily: "Manrope (400/500/600/700, bundled)"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "-0.35px"
  headline:
    fontFamily: "Manrope (400/500/600/700, bundled)"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "-0.2px"
  body:
    fontFamily: "Manrope (400/500/600/700, bundled)"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0px"
  label:
    fontFamily: "Manrope (400/500/600/700, bundled)"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "0px"
  caption:
    fontFamily: "Manrope (400/500/600/700, bundled)"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "0.05px"
  footnote:
    fontFamily: "Manrope (400/500/600/700, bundled)"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.1px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
  screen: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent-light}"
    textColor: "#ffffff"
    typography: "{typography.headline}"
    rounded: "{rounded.lg}"
    padding: "0 24px"
    height: "52px"
  button-primary-pressed:
    backgroundColor: "{colors.accent-light}"
    textColor: "#ffffff"
    typography: "{typography.headline}"
    rounded: "{rounded.lg}"
    padding: "0 24px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.ink-light}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "48px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted-light}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "44px"
---

# Design System: Glide

## 1. Overview

**Creative North Star: "The Strategy Board"**

Glide is where a monthly diagnostic — importance × satisfaction
across 18 Strategic Life Units — turns into a daily checklist and a
grade. The interface reads as a strategist's board, not a habit
tracker's scoreboard: decisive color, crisp hierarchy, and one
recurring geometric motif (soft, oversized circles echoing the
portfolio graph's bubbles) that carries the same strategic shape from
the analytical screens onto every daily surface. Canvas stays pure —
white in light mode, near-black in dark — so the six Strategic Life
Area hues and the single brand teal accent are what carry identity,
never a tinted background.

The system explicitly rejects: Jira/Notion-style density and nested
configuration (the daily surface is a checklist, not a workspace);
Habitica/Duolingo-style streak-shame mechanics, alarm colors on missed
days, or nagging; SaaS dashboard clichés (hero metrics, gradient
accents, identical stat-card grids); and any leaderboard or
score-comparison surface. Warmth here comes from celebration —
completed goals, special days, look-back memories — never from
decoration or softened truth.

**Key Characteristics:**
- Pure canvas (true white / true near-black), brand carried entirely in hue, never in surface tint
- One signature backdrop motif (bubble constellation / hue wash) present on every screen
- Flat by default; the one shadow tier is reserved for sheets and overlays that must read as lifted
- Seven-step system-font type scale, negative tracking on display sizes, tabular numerals wherever figures align
- A single deliberate exception to "no alarm colors": the six-band grade ramp, scoped only to the calendar grid

## 2. Colors

Six categorical Strategic Life Area hues at matched perceptual weight, one brand teal accent, and a pure achromatic canvas/surface/ink system — composed in OKLCH, exported as hex because React Native can't parse OKLCH at runtime.

### Primary
- **Brand Teal** (`#007a80` light / `#3ebfc6` dark): the accent — primary buttons, active states, and the Mental Wellbeing area hue (the accent *is* one of the six areas, not a color invented separately from the system).
- **On-Accent** (`#ffffff` light / `#070707` dark): the only label color on accent/area fills. Dark mode lifts its hues, so the readable label there is near-black (≥7:1), never white.
- **Danger** (`#a63d33` light / `#ee9086` dark): destructive actions only (delete, remove). Area hues never signal destruction — red-rose means Relationships, not "warning."
- **Scrim** (`rgba(0, 0, 0, 0.45)` both themes): the one backdrop dim behind sheets and modals.

### Secondary — Strategic Life Area hues
Six categorical hues, one per Strategic Life Area, each lifted in lightness (not just brightened) for the dark canvas so bubbles glow rather than muddy:
- **Rose** (`#bb565a` / `#eb8182`) — Relationships
- **Green** (`#4a925c` / `#6fc082`) — Physical Health
- **Teal** (`#007a80` / `#3ebfc6`) — Mental Wellbeing (= accent)
- **Blue** (`#3d73b6` / `#64a1ee`) — Work & Money
- **Amber** (`#b8892d` / `#e3ad4b`) — Wellness (token ids keep the
  original `home-environment` slug; ADR-0002 never re-keys taxonomy
  rows, so a rename is a label change and the hue travels with it)
- **Violet** (`#7d5fad` / `#ab8be3`) — Leisure & Creativity

### Neutral
- **Canvas** (`#ffffff` / `#070707`): the base screen fill. Pure white or pure near-black — never tinted toward any hue.
- **Surface** (`#eef1f1` / `#111416`): the one step of tonal lift above canvas — cards, dial tracks, secondary buttons.
- **Ink** (`#151c1e` / `#e4e9e9`): primary text. ≥16:1 contrast against canvas on both themes.
- **Muted** (`#5a6569` / `#929a9b`): secondary text, captions, unset states. ≥6:1 contrast against canvas on both themes.
- **Hairline** (`#dbdfe0` / `#2e2e2e`): dividers and unset-state borders (e.g. the NumberDial's untouched indicator ring).

### Named Rules
**The Untinted Canvas Rule.** Canvas and surface never carry brand hue. The six area colors and the teal accent are the only carriers of identity; a warm or cool tint on the background is drift, not brand expression.

**The Calendar Exception.** A six-band grade ramp — red below 50, orange in the 50s, yellow in the 60s, green in the 70s, brighter green in the 80s, bright blue at 90+ (per-theme weighted, e.g. `#c2453c → #2b7fdd` light, `#ef7a6d → #58b0ff` dark) — colors the monthly calendar grid only. This is the one deliberate exception to the no-alarm-colors stance in PRODUCT.md; it must never spread beyond the calendar grid into daily-surface copy, buttons, or notifications. The ramp colors the chip border and tint only — grade numerals render in Ink, because the mid-band hues sit under 4.5:1 at footnote size.

## 3. Typography

**Display/Body/Label Font:** **Manrope**, bundled at 400/500/600/700 and loaded at launch. One family in four weights — no display/body pairing, which app UI does not need. Chosen over the system font because PRODUCT.md asks the app to feel like itself rather than like a system app on either platform; chosen over Inter because Inter is the default of most modern apps and would undercut the same goal. Manrope ships `tnum`, so tabular numerals survive the switch.

**Character:** Disciplined and numeric-forward. Negative letter-spacing tightens the two largest sizes so headings read as decisive rather than loose; tabular numerals keep the grade and the diagnostic's 1–10 ratings visually aligned wherever they stack.

### Hierarchy
- **Numeral** (Bold, 44px/48px, -1px tracking): the day's grade, and only that.
- **Display** (Bold, 28px/34px, -0.5px tracking): every top-level screen title. All page headers are this one size — tabs and rituals alike.
- **Title** (700, 22px/28px, -0.35px tracking): section headers (a diagnostic area name, a goal title).
- **Headline** (600, 17px/22px, -0.2px tracking): primary button labels, list-item emphasis.
- **Body** (400, 16px/24px, 0 tracking): running text, journal entries. Cap prose at 65–75ch on wide screens.
- **Label** (600, 15px/20px, 0 tracking): secondary buttons, form labels, the NumberDial row label.
- **Caption** (500, 13px/18px, 0.05px tracking): captions, the NumberDial's small readout label.
- **Footnote** (500, 12px/16px, 0.1px tracking): timestamps, fine print.

### Named Rules
**The One Text Rule.** `AppText` is the only text component in the app; every string picks a variant from this scale and an explicit color. No inline font sizes, no unthemed text color.

**The Family-Always Rule.** The handful of places that legitimately sit outside `AppText` — `TextInput`, and the NumberDial and FrequencyPicker whose sizes are tuned to their controls — must still take `fontFamily` from `tokens.fonts`. A custom family is not inherited: a raw size with no family silently falls back to the system face and puts two typefaces on one screen. Never pair `fontFamily` with `fontWeight`; React Native does not synthesize weights for a bundled family, and Android will fake-bold an already-bold file.

## 4. Elevation

Flat by default: canvas and surface differ only by tonal fill, never by shadow, across every component read in the codebase today (buttons, cards, the NumberDial track, the bubble backdrop). One shadow tier is planned, reserved specifically for surfaces that must read as lifted above the rest of the screen — sheets and modal-style overlays (e.g. `UnitInfoSheet`) — not for buttons, cards, or the dial, which stay flat and rely on surface-fill contrast alone.

### Shadow Vocabulary
- **Sheet** (`0px 4px 12px rgba(0, 0, 0, 0.08)` — RN: `shadowOffset: {width: 0, height: 4}, shadowRadius: 12, shadowOpacity: 0.08, shadowColor: "#000000"`, Android `elevation: 4`): reserved for sheet/overlay surfaces lifting off the canvas. On the dark canvas this shadow reads faint by design; surface-fill contrast (not the shadow) does the primary work of separating a dark-mode sheet from the canvas behind it.

### Named Rules
**The Lifted-Not-Raised Rule.** Only sheets and overlays get a shadow. A card or button that wants to feel "important" gets stronger color or type weight, never a shadow — shadow means "this surface is temporarily on top of the screen," not "this is emphasized."

## 5. Components

### Buttons
- **Shape:** rounded rectangle, radius varies by weight — primary 14px (`rounded.lg`), secondary 12px (`rounded.md`), quiet has no fill or radius.
- **Primary:** filled with `accent` (teal `#007a80`/`#3ebfc6`, or a caller-supplied color for area-specific actions), white label at Headline weight, min-height 52px, horizontal padding 24px. Press state: scales to 0.98, no color change.
- **Secondary:** filled with `surface`, Ink-colored label at Label weight, min-height 48px. Press state: opacity 0.7.
- **Quiet:** no fill, Muted-colored label at Label weight, min-height 44px, horizontal padding 16px. Press state: opacity 0.55. For tertiary/dismissive actions only.
- **Disabled:** opacity 0.35 (primary) / 0.4 (secondary, quiet) on all variants — never a separate disabled palette.

### Inputs — NumberDial (signature)
The app's one rating control: a looping 1–10 carousel scroll-snapped on a `surface`-filled track (56px tall, `rounded.lg`), with a haptic tick at every detent and tap-to-jump on any visible digit. The unset state shows an em dash ("—") rather than defaulting to a mid-scale value — the app never puts a thumb on the scale before the user does. Once touched, the readout and center indicator adopt the current Strategic Life Area's hue; untouched, both stay `hairline`-toned.

### Cards / Containers
- **Corner Style:** 12px (`rounded.md`) for general surface-filled containers.
- **Background:** `surface`, never a second tint layer on top of it.
- **Shadow Strategy:** none — see Elevation. A card is a flat surface-fill block, not a lifted panel.
- **Internal Padding:** `space.lg` (16px) minimum; `space.screen` (20px) horizontal gutter at the screen edge.

### Backdrop (signature)
The app's identity element: soft, oversized circles in Strategic Life Area hues bleeding off the canvas edges, rendered as the first child of a container with `overflow: hidden`, alpha always in the ~2–10% range (hex `05`–`1a`). Two modes: **Constellation** — all six area hues at varied sizes, for landing/overview moments (home, diagnostic intro), with a `faint` variant that halves presence for content-heavy screens; **Hue Wash** — a single area's hue washing a focused screen, one per diagnostic area step. Never rendered behind dense data — the portfolio graph canvas itself always stays clean of it.

### Navigation
**Bottom tab bar**, five destinations: Goals · Tasks · Home · Portfolio · Settings. Home sits centre, with the screens you edit to its left and the ones you review to its right. Icons (Ionicons, outline at rest and solid when selected) carry it; only the **active** tab shows its name, under a filled `accent` pill. Icon-only bars are the least learnable option and both HIG and Material spec labelled destinations, so naming just the selected one keeps the bar quiet without ever leaving the screen unnamed — screen readers get all five names regardless. Opaque `surface` fill with a hairline top edge, never a blur.

Focused tasks — diagnostic, calibration, backup, onboarding — are pushed by the root stack and cover the bar rather than sitting beside it. A goal's detail screen pushes *inside* the Goals tab, so the bar stays put.

### Group (container)
One `surface`-filled block holding a related set, its label outside and above it — the inset-grouped-list idiom HIG names for settings-shaped content. Replaces the older top-hairline-per-section pattern, where a section's extent was implied by a line above it and you had to infer where it ended. Rows inside a flush Group separate with `GroupDivider`. **Groups never nest**, and they are not a card grid: heights vary with content and the fill stays flat.

## 6. Do's and Don'ts

### Do:
- **Do** keep canvas and surface achromatic (pure white / pure near-black); let the six area hues and the teal accent carry all brand color.
- **Do** use tabular numerals (`fontVariant: ["tabular-nums"]`) anywhere numbers stack or align — the grade, the diagnostic ratings, the dial readout.
- **Do** keep the bubble backdrop present on every screen in Constellation or Hue Wash mode, alpha in the 05–1a hex range, never behind the portfolio graph's own canvas.
- **Do** reserve the sheet shadow (`0px 4px 12px rgba(0,0,0,0.08)`) for sheets/overlays only — everything else stays flat.
- **Do** frame every score as a guideline in copy; say "Priority," never "Importance," in any user-facing string.

### Don't:
- **Don't** use Jira/Notion-style density, nested configuration, or dashboard sprawl — the daily surface is a checklist, not a workspace.
- **Don't** use streak-shame gamification: Habitica-style punishment mechanics, Duolingo-style nagging, alarm colors on missed days, or loss-aversion tricks anywhere outside the calendar grid's grade ramp.
- **Don't** use SaaS dashboard clichés — hero metrics with gradient accents, identical stat-card grids.
- **Don't** add leaderboards, shared scores, or any competitive/comparison surface.
- **Don't** apply a shadow to a button, card, or the NumberDial to signal emphasis — use color or type weight instead; shadow means "temporarily on top of the screen," nothing else.
- **Don't** let the six-band grade ramp leak outside the monthly calendar grid — it is a named, scoped exception, not a general "status color" system.
