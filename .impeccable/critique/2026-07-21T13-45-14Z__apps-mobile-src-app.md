---
target: all available screens (re-run)
total_score: 34
p0_count: 0
p1_count: 0
timestamp: 2026-07-21T13-45-14Z
slug: apps-mobile-src-app
---
# Critique — all screens (apps/mobile/src/app), re-run after fixes

⚠️ DEGRADED: single-context (both sub-agent assessments failed on an API usage-limit error mid-run; re-run performed inline by the primary agent, which authored the six fixes being evaluated — treat this pass as verification-of-fixes rather than a fully independent second opinion)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3→4 | Task completion now announces the new grade to screen readers (index.tsx); diagnostic "ratings left" caption closes the last visibility gap |
| 2 | Match System / Real World | 3 | "Weights" replaced with "daily budget"; "sealed" and "not scored" now explain themselves in place |
| 3 | User Control and Freedom | 2→3 | Activity delete now confirms via Alert, matching task-archive stakes |
| 4 | Consistency and Standards | 2→3 | Scrim and on-accent colors tokenized; danger color no longer borrows an area hue; back labels unified. One Text Rule violations in the graph suite remain (out of this pass's scope) |
| 5 | Error Prevention | 3→4 | Activity delete confirmation closes the last asymmetric-stakes gap found in the first pass |
| 6 | Recognition Rather Than Recall | 2→3 | The disabled diagnostic "Next" now states exactly how many ratings remain |
| 7 | Flexibility and Efficiency | 3 | Unchanged this pass — no regressions |
| 8 | Aesthetic and Minimalist Design | 4 | Unchanged — still genuinely excellent restraint |
| 9 | Error Recovery | 3→4 | Root DB-failure screen is now themed, on-voice, and reassuring instead of raw dev text |
| 10 | Help and Documentation | 2→3 | Sealed-week and not-scored copy now explain the mechanic inline; the scoring model itself is still undocumented in-app |
| **Total** | | **28→34/40** | **Good, approaching Excellent** |

## Anti-Patterns Verdict

**Deterministic scan**: findings dropped from 7 to 2, both the same pre-existing `#888` fallback in [Backdrop.tsx:50,53](apps/mobile/src/components/ui/Backdrop.tsx:50) (untouched by this pass — a legitimate fallback composed with theme colors, not drift). All 5 sheet-scrim findings from the first pass are gone: `rgba(0,0,0,0.45)` is now the shared `SCRIM` token in [colors.ts](apps/mobile/src/theme/colors.ts), used identically across NoteSheet, DayKindSheet, UnitInfoSheet, ActivitySheet, and AddTaskModal.

**Supplementary grep evidence**: all 5 sheet-backdrop Pressables now carry `accessibilityRole="button"` alongside their label (confirmed: NoteSheet.tsx:61, ActivitySheet.tsx:156, AddTaskModal.tsx:114, DayKindSheet.tsx:90, UnitInfoSheet.tsx:40). ModeControl segments are now 44pt (was 42pt). Remaining, unchanged from the first pass and outside this batch's scope: raw `fontSize`/`fontWeight` in the portfolio-graph suite and a few other components (One Text Rule drift — flagged as a minor observation last time, not one of the six actions taken).

**Fake-data nav link**: gone. `index.tsx`'s Portfolio footer link now points to `/portfolio` (confirmed via grep and file read), a real route reading `loadGraphSnapshots()`. `dev/graph.tsx` still exists but is unreferenced by any production screen.

**Browser visualization**: skipped, same reason as the first pass — native Expo app, no running dev server, no web build artifact to point a browser at.

## What Changed Since the Last Critique

All five priority issues from the first critique were addressed:

1. **[Fixed] Portfolio fake-data link** → new [portfolio.tsx](apps/mobile/src/app/portfolio.tsx): real route, `loadGraphSnapshots()`, proper empty state, "Update your portfolio" CTA. Bonus beyond scope: the ADR-0005 §3 trailing-28-day effort query now ships in [diagnostic.ts](apps/mobile/src/db/diagnostic.ts), so bubble sizes stop being uniform placeholders from the second snapshot on.
2. **[Fixed] Dark-mode button contrast** → new `onAccent` token (`#070707` on dark fills). Verified by direct contrast computation: white-on-teal was 2.22:1, near-black-on-teal is 9.09:1; white-on-amber was 2.03:1, near-black-on-amber is 9.92:1 — both comfortably clear WCAG AA's 4.5:1 body-text floor, not just the 3:1 large-text floor.
3. **[Fixed] Instant activity deletion** → `Alert.alert` confirm added in [ActivitySheet.tsx](apps/mobile/src/components/today/ActivitySheet.tsx), matching the existing task-archive pattern exactly (same "Keep" / destructive-styled confirm shape).
4. **[Fixed] Grade-ramp contrast** → calendar numerals now render in `theme.ink` (17:1/16:1 in both themes) with the ramp scoped to chip border and 8%-alpha tint only, per the updated DESIGN.md rule.
5. **[Fixed] Disabled "Next" with no pointer** → live "N ratings left in this area" caption above the diagnostic footer button, with `accessibilityLiveRegion="polite"` so it's announced too.

Plus everything from the closing polish pass: spoken dates replace raw ISO strings in WeekStrip and MonthGrid accessibility labels; task completion now announces the new grade via `AccessibilityInfo.announceForAccessibility`; the cadence chip's hitSlop grew so a near-miss can't trigger the row's destructive long-press; back labels are consistently "‹ Back"; "weights" → "daily budget" and the sealed-week/not-scored copy now explain themselves in place.

## Remaining Priority Issues

Nothing at P1 survived. Two P2/P3s remain, both explicitly out of scope for this batch (never assigned to any of the six actions):

1. **[P2] One Text Rule still broken in the portfolio-graph suite** — raw `Text` and off-scale `fontSize` in Callout.tsx, Legend.tsx, ModeControl.tsx, PortfolioGraphView.tsx. Flagged in the first critique's minor observations, not one of the five priority issues, so untouched by this pass. *Suggested: `/impeccable polish` (scoped to portfolio-graph/)*
2. **[P3] `dev/graph.tsx` is now truly dead code** — no longer linked from anywhere; worth deleting or clearly gating behind `__DEV__` now that its one production consumer is gone.

## Trend

**28 → 34 / 40** on this target.

---

*Note on method: this verification pass was run by the same agent that implemented the fixes, after both independent-review sub-agents failed on an API rate limit. The deterministic evidence above (detector re-run, grep re-scan, direct contrast computation) is objective and unaffected by that; the heuristic re-scoring should be read as a self-check against the original independent baseline rather than a fresh outside opinion. Recommend a true independent re-run once sub-agents are available again if a second opinion matters here.*
