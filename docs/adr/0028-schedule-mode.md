# ADR-0028: Schedule mode

> **Status:** **Withdrawn 2026-09-11, never accepted**\
> **Date:** 2026-09-08 (proposed) · withdrawn 2026-09-11\
> **Deciders:** Henry

> **Withdrawn before acceptance. Do not implement.**
>
> This ADR existed to solve a problem that no longer exists. It gated
> the academic module behind a switch because that module was a
> **foreign body** — its own hierarchy, its own seven tables — and a
> person who was not at university had to be shielded from it.
>
> The module was then generalised twice, and now commitments are
> ordinary custom `life_unit` rows scored from their own band
> ([ADR-0029](0029-commitments-are-custom-units.md),
> [ADR-0032](0032-the-commitment-band.md)). **Nothing is
> school-shaped any more**, so there is nothing to hide: a person with
> no commitments simply has none, and every surface this ADR gated is
> either empty or absent on its own.
>
> What survives: the List / Day layout preference, which is an ordinary
> setting rather than a mode, and is recorded in
> [ADR-0033](0033-windows-and-pools.md).
>
> §3's invariant — *a mode is presentation and grammar, never
> arithmetic* — was the best thing here and it is **not** carried
> forward, because with no mode there is nothing for it to constrain.
> It is worth re-reading if a mode is ever proposed again.
>
> The body below is kept unedited as the record of a decision
> considered and dropped.

> **What Henry decided (2026-08-21), and what is drafted around it.**
> Four calls are his and are recorded as made: the academic layer is a
> **parallel module**, not goals inside a unit; clock times arrive
> **narrowly**, on fixed commitments and deadlines only; school gets
> its **own score**, weighted by what each assessment is worth; and
> free intervals are **shown, not filled**. He then added the call this
> ADR exists for: *"for users that aren't in school, you have to be
> able to toggle this mode off — we basically have two modes, which
> change the look of the home screen and how tasks are scheduled."*
> Everything else below — the name, the default, what the switch
> reaches, the hides-never-deletes rule and the invariant in §3 — was
> drafted around those calls.

## Context

ADR-0029 adds courses, timetables and assessments; ADR-0030 gives
fixed commitments clock times; ADR-0031 adds a second 100-point scale.
None of that belongs to a person who is not at university, and
PRODUCT.md is unambiguous about what happens when a planning app grows
surfaces its user did not ask for: *project-management software* is the
first-named anti-reference, and design principle 2 keeps the daily
surface to "a checklist and a number — openable, actionable, and
closable in under a minute."

So the academic module cannot simply be *added*. It has to be
**absent** — not merely unused — for anyone who has not asked for it.

Two prior decisions frame how:

- **ADR-0024 §3 got this wrong once and said so.** Its 2026-08-17
  amendment withdrew "empty sections do not render" with the diagnosis
  that *"'invisible until used' was the right instinct applied to the
  wrong object."* The instinct is right about a **feature**; it is
  wrong about the **shape of a day**. A mode is a feature.
- **ADR-0021: areas are presentational.** A soft attribute may decide
  colour, grouping and what a screen leads with. It may never decide a
  weight, a rank, a point value or any stored score. That is the exact
  rule a mode needs, because the one thing a mode must never do is
  change what a day was worth.

Constraints already in force:

- Active SLU weights sum to exactly 100, in every mode.
- **Plans never touch the grade** (ADR-0024 §2).
- **History never silently restates** (ADR-0002).
- **The app never shames**, and kindness is ambient, never targeted
  (ADR-0008).

## Open questions

1. Is the mode a stored switch, or derived from whether a term exists?
2. What exactly does it reach?
3. What happens to academic data — and to the grade — when it is off?
4. Is it asked at onboarding?
5. What is it called, given that a timetable is useful to people who
   are not students?

## Options considered

### How the mode is decided

- **Derived from data** — the module appears once a term exists.
  Nothing to explain, nothing to set. Rejected: the only way to *reach*
  the surface that creates a term would be a surface that only exists
  once a term exists, and turning it off would mean deleting the term.
  A mode you can only leave by destroying data is not a mode.
- **A stored switch, default off.** **Chosen.** One row in
  `app_setting`, one control in Settings, reversible in a tap, and it
  can be turned off without losing anything.
- **Asked at onboarding.** Rejected — see §4.

### What it is called

- **Study mode.** Clearest for the main case. Rejected: it excludes the
  shift worker, the musician with standing rehearsals, and the parent
  with a fixed school run — all of whom want exactly the hour grid and
  none of whom are studying. `fixed_commitment.course_id` is nullable
  precisely so their week fits.
- **Term mode.** Same objection, plus it implies the switch expires.
- **Schedule mode.** **Chosen.** It names what the switch actually
  turns on: the app knows your week has a fixed shape. Courses are a
  layer *inside* it, and a person may run a timetable with no courses
  at all.

## Decision

### 1. Schedule mode is one stored switch, default off

`app_setting` key **`mode.schedule`**, values `on | off`, default
`off`. One row in Settings, worded as what it does rather than who you
are — *"Schedule mode — for weeks with a fixed shape: classes, shifts,
standing commitments"* — because the app does not need to know whether
you are a student and should not ask.

With it off, the app is **byte-for-byte what it is today**. Not a
disabled control, not an empty section, not a greyed tab: no Courses
segment, no layout toggle, no `study/` route reachable from anywhere,
no mention in copy. This is the "invisible until used" instinct applied
to the object it is right about.

### 2. What the switch reaches — the complete list

Adding a sixth thing to this list requires reopening this ADR.

1. **Home's day surface** gains the *Day* layout option (the hour grid,
   ADR-0030). Off, only the checklist exists — there is no timetable to
   draw, and an hour grid with nothing in it is an empty ruler.
2. **The Goals tab** gains its `Goals · Courses` segment. Off, the
   segment control does not render at all; Goals is unchanged.
3. **The `study/` routes** exist and are linked. Off, nothing links to
   them.
4. **Task placement gains slots** (ADR-0030 §4) — a task may be placed
   into a free interval, cued to the commitment it follows. Off,
   placement is weekday and part of day, exactly as ADR-0024 §1 has it.
5. **The semester score** (ADR-0031) appears, once a term holds a
   course. Off, it is neither shown nor computed.

### 3. The invariant: a mode is presentation and grammar, never arithmetic

**No stored value differs between modes.** Not a point value, not a
weight, not a rank, not a day's grade, not an achievement. Toggling
`mode.schedule` twice in a row must be observably identical to not
touching it, and toggling it once must leave every past day's number
exactly where it was.

This is ADR-0021's rule for areas, applied to a mode, and it is the
whole reason the switch is safe to offer. It is also what makes the
feature testable: record a day's grade, flip the mode, and compare.

Two consequences fall out of it:

- **A task always has a part-of-day answer.** A slot placement
  (§2.4) *refines* `task.part_of_day`; it never replaces it. So a task
  arranged into "the gap after the 11am lecture" still knows it is a
  morning task, and turning the mode off reveals a coherent checklist
  rather than a pile of unplaced rows.
- **The daily grade never learns about courses.** Academic work reaches
  a day only as an ordinary one-off task the user put in their own plan
  (ADR-0029 §4). ADR-0023's planned/unplanned line is undisturbed, and
  ADR-0027's ceiling does not move.

### 4. Turning it off hides; it never deletes

Terms, courses, commitments, assessments, study sessions and
`term_result` rows all survive with the switch off, untouched and
un-archived. Turn it back on mid-semester and the term is where you
left it.

This follows ADR-0007's treatment of goals — *set aside*, never erased
— and ADR-0002's soft deletes. The reasoning is the same: a switch that
destroys data on the way out is a switch nobody can safely try, and a
feature nobody can safely try is a feature nobody tries.

Slot placements made while the mode was on **lapse silently** when it
is off, exactly as ADR-0024 §2 requires of every placement. They are
not surfaced, not counted, and not mentioned. They are still there when
you come back.

Deleting academic data is a separate, deliberate act on its own screen,
with the same confirm-and-say-what-survives copy ADR-0007's deletion
amendment settled on.

### 5. Onboarding does not ask

ADR-0011 keeps first run lean, and *"are you a student?"* is a question
about identity that the app has no use for. It would also be asked at
the worst possible moment: before the person has seen a single day of
the thing the question is about.

The switch is found in Settings, where the other things that reshape
the app already live. If discoverability proves to be the problem, the
next move is a one-line note in the Settings section header — not a
question at install, and not a prompt that appears because the app
noticed something about you, which ADR-0008 forbids on principle.

## Consequences

**Easier.** The academic module can be as rich as it needs to be
without any of it landing on someone who wanted a checklist and a
number. Every surface below gets one clear answer to "should this
render?" And the shift worker, the musician and the parent get the hour
grid without being told they are in study mode.

**Harder.** Every new academic surface now has two states to build and
two to test, and the honest cost is that the *off* path is the one
nobody will look at after the first week. §3's invariant is what makes
that cost bearable — it turns "does the app still work with the mode
off?" into a comparison a test can make, rather than a walkthrough
somebody has to remember to do.

**Accepted cost.** Two modes is two products to keep coherent, and
this ADR is a bet that the seam holds at exactly one switch. If it
proves wrong, the failure will look like a third state creeping in —
a surface that is neither fully on nor fully off, or a stored value
that differs between modes. §2's closed list and §3's invariant exist
to make that visible early.

**Revisit when:** a fourth or fifth thing wants to hang off the switch
and none of them is academic — which would mean the app has grown two
different ideas of what a mode is; or real use shows the switch is
never found, which makes §5 wrong rather than merely cautious.

## Action items

1. [ ] `app_setting` key `mode.schedule`; `loadScheduleMode` /
       `setScheduleMode` in `apps/mobile/src/db/settings.ts`, beside
       the existing notification accessors.
2. [ ] The Settings row, worded as what it does, not who you are.
3. [ ] Gate all five surfaces in §2 on one read, not five scattered
       conditionals.
4. [ ] A test that a day's stored grade is identical either side of a
       toggle — the §3 invariant, made executable.
5. [ ] Amend ADR-0024 §3 with a dated pointer here: the checklist gains
       an alternate layout, and part-of-day grouping is unchanged in
       both.
6. [ ] Add the vocabulary row to AGENTS.md and the invariant that no
       stored value differs between modes.
