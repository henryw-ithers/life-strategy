# Planning Note — The hour grid

> **Design history.** A record of how this was worked out, kept for the
> reasoning. Some details have changed since; where it disagrees with an
> ADR, the ADR is correct. See the [documentation map](../README.md).

> Status: planned, not built. Rewritten 2026-09-11 — the first draft
> (2026-09-08) described a grid gated behind a schedule mode, with
> `fixed_commitment` rows and a courses module behind it. None of that
> survived; see the note at the foot.
>
> The decisions live in
> [ADR-0033](../adr/0033-windows-and-pools.md) (windows, pools,
> carry-forward, what the grid draws),
> [ADR-0035](../adr/0035-commitments-are-custom-units.md) (the model)
> and [ADR-0036](../adr/0036-granularity-is-the-users.md) (times).
> Read those first; this is the surface detail, in the shape
> [calendar-and-day-planning.md](calendar-and-day-planning.md) set.

## The idea

Henry, 2026-09-08:

> In my vision, you have classes and quizzes and assignments and then
> in the free time the regular tasks appear. You choose which tasks
> appear in which time period.

Two layouts for one day, chosen by a control in the date header:

- **List** — today's checklist, grouped by window. Largely unchanged;
  on a day with no commitments the windows *are* the parts of day, so
  it is exactly today's screen.
- **Day** — hour rows, with commitments as blocks and the gaps between
  them named and fillable.

Preference in `app_setting` under `today.layout`, default `checklist`.
**No mode gates it** — a person with no commitments has no blocks to
draw, so the Day layout simply has nothing to show and is not offered.

## What the grid shows

    07  ─────────────────────────
    08  ─────────────────────────
    09  ┌───────────────┐
        │ COMP2521      │  Lecture · CLB 7
    11  └───────────────┘
        ╌╌ Free · 2h ╌╌╌╌╌╌╌╌╌╌╌╌
        · Reading — week 4
    13  ┌───────────────┐
        │ MATH1231 lab  │  Quad G026
    15  └───────────────┘
        ╌╌ Free · 4h ╌╌╌╌╌╌╌╌╌╌╌╌
        · Gym
        · Call Dad
    19  ─────────────────────────

Three kinds of row, three grammars:

**Blocks** are commitment sessions and timed work, positioned by their
minutes. Commitment hue as a **wash with an Ink label**, never a solid
hue behind small text — four of the six hues fall under AA that way in
light theme (DESIGN.md, Colors). Inert: tapping opens the commitment,
dragging does nothing, because dragging a lecture would assert the
lecture moved (ADR-0033 §5).

**Windows** are gaps of 30 minutes or more, captioned with their
length, reusing the existing `FREE_LABEL`. They are drop targets even
when empty — that is most of the point, since "do this in the gap"
matters most when the gap is empty and there is no row to drop beside.

**Buffer** is a gap shorter than the minimum. It renders as a hairline,
not as free time. Fifteen minutes between two lectures across campus is
not time you have, and a grid that offers it is lying to the person
reading it.

## How many hours it draws

**The span of the day's windows** — not a fixed range, and not just the
blocks, or a single 9am lecture would draw one hour on a tall screen
(ADR-0033 §4). The stretches before the first window and after the last
collapse to one row each, *earlier* / *later*, tappable to expand. The
planning surface shows all 24 hours: display is bounded by the day,
placement is not.

`MINUTE_PX` derives from a passed-in `fontScale` — the way
`checklistLayout` takes `gap` as an argument rather than importing
tokens — so an hour row survives Dynamic Type instead of clipping. A
`MIN_BLOCK_PX` floor keeps a fifteen-minute tutorial tappable.

**The drawn span is not the day.** The rollover hour is 3am
(`ROLLOVER_HOUR`, ADR-0004 §1); a 1am session belongs to the previous
day. One is a display concern and the other is the day boundary, and
they must not be confused.

## Where tasks go

Into windows. A task may carry an explicit clock time if its owner set
one (ADR-0036), sit in a window without one, or sit in a part of day —
and all three render in the same structure, because a part of day *is*
a window on an uncommitted day.

A placement may still be **cued** rather than timed — storing which
commitment it follows, so "after the 11am lecture" survives that
lecture moving to 2pm. No longer the required mechanism, still the
better one where it applies (ADR-0036 §3).

An unplaced task sits in its part-of-day window, ordered by
`compareForDay`. Tasks pinned to other days get their own group below,
outside the drag, exactly as on the checklist — ADR-0024's 2026-08-20
amendment settled that, and a day arranged one way here and another way
on Home is the same day disagreeing with itself.

A window may hold a **pool** of up to three equal-priced options
(ADR-0033 §3). It must read as *one choice with three routes*, never a
list of three things owed — that is a copy rule with research behind
it, and the reasoning is in
[scheduling-and-motivation.md](scheduling-and-motivation.md)'s
2026-09-11 addendum.

## Build order

1. **Commitments.** `life_unit.parent_unit_id`, the create/edit/archive
   path, `is_custom` finally written. **Fix `reset.ts` first** — it is
   three tables behind (ADR-0035 action item 2).
2. **The band.** Third band in `packages/scoring`, formula v8, behind
   tests. **Run a real plan through it before any UI** — nearly every
   number in these notes is hand-computed.
3. **Window derivation.** `timetable.ts` — windows, gap vs buffer,
   `occursOn` as the single answer to "does this happen on this date."
   Pure, vitest only, no device needed.
4. **The grid.** `dayGridLayout.ts` (pure, tested, following
   `checklistLayout.ts`'s precedent because a misplaced block fails
   silently), `DayGrid.tsx`, the layout toggle.
5. **Pools and carry-forward.** Planned count, equal pricing,
   once-per-window uniqueness.
6. **Task size** (ADR-0026), then **partial credit** (ADR-0014).

## Things deliberately not in this note

- **Backwards planning from a deadline** — proposing work sessions
  across the gaps between now and a due date. Henry's call was that
  free intervals are *shown, not filled*. It is the strongest single
  argument for the whole feature and it stays parked until the grid is
  in real use.
- **Auto-placement.** Same call, and the direct route to the taskmaster
  PRODUCT.md names as an anti-reference.
- **Commitment reminders.** ADR-0036 §4 — a course name on the lock
  screen is what ADR-0010 §3 exists to prevent.
- **Timetable import.** Backburnered; see
  [backburner.md](../backburner.md).

## What the first draft got wrong

Kept because the reasoning is instructive:

- **A schedule mode** gating the whole thing. Dissolved once
  commitments became ordinary custom units — there was nothing
  school-shaped left to hide. ADR-0034, withdrawn.
- **`fixed_commitment` as its own table**, with `term`, `course` and
  `assessment` behind it. Collapsed into `life_unit` plus two columns.
- **Cue-based placement as the required mechanism**, on the argument
  that only externally-set things may carry times. Reversed by
  ADR-0036: any task may, and part-of-day is merely the default.
- **A fixed 07:00–22:00 grid window.** Replaced by the day's own span —
  a number the app had no business picking.
