---
target: all available screens
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-07-20T16-50-21Z
slug: apps-mobile-src-app
---
# Critique — all screens (apps/mobile/src/app)

> **Design history.** A record of how this was worked out, kept for the
> reasoning. Some details have changed since; where it disagrees with an
> ADR, the ADR is correct. See the [documentation map](../../README.md).

Method: dual-agent (A: design review · B: detector/browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Disabled diagnostic "Next" gives no pointer to which dial is unset (diagnostic.tsx:250) |
| 2 | Match System / Real World | 3 | "Sealed," "weights," "not scored," "2 wks" are system vocabulary in a first-timer's UI |
| 3 | User Control and Freedom | 3 | Activity delete is instant and unconfirmed while task archive gets an Alert — inconsistent stakes |
| 4 | Consistency and Standards | 2 | One Text Rule broken in 8 files; delete colored with the Relationships hue; back labels vary |
| 5 | Error Prevention | 3 | Edit-window guards and discard confirm are good; instant activity delete is the gap |
| 6 | Recognition Rather Than Recall | 2 | Missed rating is a near-invisible hairline "—" you must hunt for; "pts" never explained on Today |
| 7 | Flexibility and Efficiency | 3 | Prefilled re-runs, tap-to-jump dials, quick-add, "Skip — rank it last" |
| 8 | Aesthetic and Minimalist Design | 4 | Genuinely excellent restraint; checklist reads in one glance |
| 9 | Error Recovery | 3 | Diagnostic save-failure copy is model quality; root DB-failure screen is raw unthemed dev text |
| 10 | Help and Documentation | 2 | Unit info sheets are superb; sealing, edit window, and the scoring model explained nowhere in-app |
| **Total** | | **28/40** | **Good — solid foundation, address weak areas** |

## Anti-Patterns Verdict

**Not AI slop.** No card grids, gradients, hero metrics, or eyebrow kickers; hairline-band lists; a real signature element (bubble backdrop at 2–10% alpha); disciplined tokens. The NumberDial's unset "—" is a decision AI defaults never make. A Linear/Things-fluent user would trust ~90% of it and pause at: text glyphs as iconography (⋯ ▾ ‹ ✓), footer text-links as the entire navigation, the "Portfolio" link opening a fake-data dev spike, and raw Text in the graph suite.

**Deterministic scan** (detector ran on TSX, exit 2): 7 advisory findings, all `design-system-color` — the 5 sheet scrims `rgba(0,0,0,0.45)` (undocumented in DESIGN.md, but consistent: a missing token, not drift) and `#888` fallbacks in Backdrop.tsx:50,53. Supplementary mechanical scan: raw `Text` imports in 8 files (~14+ usages) vs. the One Text Rule; 19 raw fontSize/fontWeight outside AppText/theme; ModeControl segments at 42pt with no hitSlop; 5 sheet-backdrop Pressables labeled "Close" but missing `accessibilityRole`; one off-scale `marginTop: 9` (UnitInfoSheet.tsx:106). False positives noted: most raw spacing literals are sanctioned optical nudges; kindButton/record-action rows reach 48pt effective via hitSlop.

**Browser visualization**: skipped — native Expo app, no running dev server or web build; no overlay is available.

## Overall Impression

An unusually disciplined, values-driven product UI whose kindness invariants are actually load-bearing in code. The losses are consistency and explanation, not taste: the design system is violated at its edges (graph suite, root error screen), dark-mode buttons fail the app's own WCAG pledge, and the app's centerpiece is reachable only as a fake-data dev route. Single biggest opportunity: give the portfolio graph a real production home and make the day's end feel like an ending.

## What's Working

1. **The NumberDial** — unset "—" that refuses to anchor, haptic detents, tap-to-jump, and a complete `adjustable` accessibility implementation. Would survive review at any top-tier shop.
2. **The Skia graph's accessibility overlay** — invisible 44pt per-bubble targets carrying full text data with tap-cycling through overlaps. Charts screen readers can actually read are rare.
3. **Kindness engineered, not asserted** — deficit-free progress captions, the climb-only day number, encouragement that never branches on score, edit-window enforcement in the data layer.

## Priority Issues

1. **[P1] "Portfolio" nav link opens a fake-data dev spike** (index.tsx:476 → dev/graph.tsx). A first-class destination shows six months of invented history captioned "Dev spike · fake data," violating the file's own contract. **Fix:** real route on `loadGraphSnapshots()` (already exists), or remove the link. *Suggested: /impeccable shape*
2. **[P1] Dark-mode primary buttons fail contrast** (Button.tsx:94). Hard-coded white label on lifted dark-theme hues ≈ 2.0–2.2:1, under even the 3:1 large-text floor; every primary CTA in dark mode fails the WCAG AA pledge. **Fix:** per-theme on-color (near-black ink on light dark-mode fills). *Suggested: /impeccable polish*
3. **[P1] Activity deletion is instant and unrecoverable** (ActivitySheet.tsx:268) while task archive confirms via Alert. A mis-tap erases a logged memory. **Fix:** match the archive confirm or add undo. *Suggested: /impeccable harden*
4. **[P2] Grade-ramp mid-bands fail AA in light mode** (colors.ts:78, MonthGrid.tsx:94). Yellow ≈3.2:1 / orange ≈3.5:1 at 12px/500 — the least readable grades are the discouraging ones. **Fix:** darken light-ramp bands or render numerals in ink. *Suggested: /impeccable colorize*
5. **[P2] Disabled "Next" with no pointer to the missing rating** (diagnostic.tsx:250). One forgotten near-invisible "—" silently disables the button. **Fix:** tap scrolls to first unset dial, or "1 rating left" caption. *Suggested: /impeccable clarify*

## Persona Red Flags

**Casey (one-handed, distracted):** cadence chip ~24pt + 6pt hitSlop inside a row whose long-press is destructive archive ([unitId].tsx:310, 174) — fat-thumb turns "change frequency" into "Remove this task?"; quick-add `+` nested inside a navigating row (plan/index.tsx:138); dial's horizontal scroll inside a vertical ScrollView is a gesture conflict; ModeControl segments 42pt.

**Jordan (first-timer):** "Your weights are set" — never met "weights"; "This week is sealed" and "not scored" unexplained; ProgressDots name nothing ahead; taps "Portfolio" → fake data.

**Sam (screen reader):** day chips announce raw ISO dates ("twenty twenty-six dash zero seven…") though `spokenDate()` exists (WeekStrip.tsx:61, MonthGrid.tsx:65); completing a task never announces the new grade — the core feedback loop is silent; sheet backdrops lack `accessibilityRole`; fixed dial/chip geometry will clip at accessibility type sizes despite the dynamic-type pledge.

**Reflective Henry on a low week:** invariants hold — no copy branches on grades. Two accidental abrasions: the sealed-week line lands coldest exactly when a bad week ends, and light mode's dimmest calendar colors are the 50s–60s bands he'll be staring at.

## Minor Observations

- Delete styled with `theme.areas.relationships` — the hue now means both "love" and "destroy"; mint a semantic destructive token.
- Root DB-failure screen is unthemed raw Text (_layout.tsx:31) — white screen in dark mode, off-voice copy.
- DayNumber's 44px size is off the seven-step scale — probably right visually, so the scale doc is wrong, not the component.
- ModeControl segments announce as buttons, not tabs.
- Special-day grade = satisfaction×10 enters the same color ramp: a 5/10 lovely wedding renders alarm-orange 50 (db/today.ts:416).
- Sheet scrim `rgba(0,0,0,0.45)` used identically in 5 sheets — promote to a token.
- "‹ Back" vs "‹ Plan" back labels; "‹ Plan" lies when arriving from diagnostic results.

## Questions to Consider

1. Is the footer the IA, or scaffolding wearing shipping clothes? Four durable surfaces exist now — when does refusing a tab bar stop being minimalism and start being a discoverability tax?
2. The pitch is "a checklist and a number" — so why is the number a corner accessory that vanishes when dormant? Does the day's end deserve a moment of its own?
3. The Calendar Exception puts the app's only alarm colors exactly where a struggling user studies them. Would a neutral-intensity ramp (density/size, not red-to-blue) tell the same truth without traffic-light morality?
