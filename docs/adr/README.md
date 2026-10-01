# Architecture Decision Records

Decisions to work through **before writing application code**, roughly
in dependency order. Each ADR lists the open questions it must answer;
resolving an ADR means filling in its Decision section and flipping its
status to *Accepted*.

| # | Title | Status |
|---|-------|--------|
| [0001](0001-platform-and-tech-stack.md) | Platform and tech stack | Accepted |
| [0002](0002-data-model-and-persistence.md) | Data model and persistence | Accepted |
| [0003](0003-scoring-and-weight-derivation.md) | Scoring and weight derivation | Accepted |
| [0004](0004-grade-lifecycle-and-aggregation.md) | Grade lifecycle and aggregation | §2 superseded by 0014 |
| [0005](0005-diagnostic-snapshots-and-history.md) | Diagnostic snapshots and portfolio history | Accepted |
| [0006](0006-task-and-goal-recommendations.md) | Task and goal recommendation source | Accepted |
| [0007](0007-goal-lifecycle.md) | Goal lifecycle and milestones | Accepted |
| [0008](0008-contentment-calibration.md) | Contentment calibration and sensitive data | Accepted |
| [0009](0009-spontaneous-activities.md) | Spontaneous activities and bonus credit | Accepted |
| [0010](0010-notifications-and-reminders.md) | Notifications and reminders | Accepted |
| [0011](0011-onboarding-and-first-run.md) | Onboarding and first run | Accepted |
| [0013](0013-crash-reporting-and-telemetry.md) | Crash reporting and telemetry | Accepted |
| [0014](0014-partial-credit.md) | Partial credit | Accepted |
| [0015](0015-metric-linked-goals.md) | Metric-linked goals | Accepted |
| [0019](0019-multi-unit-tasks.md) | Tasks that serve more than one unit | Accepted |
| [0020](0020-backup-cryptography-and-export-exemption.md) | Backup cryptography and export exemption | Accepted |
| [0021](0021-areas-are-presentational.md) | Strategic Life Areas are presentational | Accepted |
| [0022](0022-satisfaction-is-rated-not-ranked.md) | Satisfaction is rated, not ranked | Accepted |
| [0023](0023-planned-work-is-what-pays.md) | Planned work is what pays | Accepted |
| [0024](0024-day-planning-is-intention.md) | Day planning is intention, not obligation | §2 withdrawn by 0029; amended by 0026, 0036, 0032 |
| [0025](0025-communal-units-are-dimensions.md) | Communal units are dimensions, not containers | Amended by 0027 |
| [0026](0026-task-size-and-day-load.md) | Task size and day load | Accepted |
| [0027](0027-coverage-decides-the-ceiling.md) | Coverage decides the ceiling | §§1–3 superseded by 0029; extended by 0032 |
| [0028](0028-priority-is-the-only-input.md) | Priority is the only input | §3 superseded by 0029 |
| [0029](0029-a-day-is-the-fraction-you-got-through.md) | A day is the fraction of itself you got through | Accepted; extended by 0032 |
| [0030](0030-goals-have-conditions.md) | Goals have conditions | Accepted |
| [0031](0031-the-semester-score.md) | The semester score | **Withdrawn** |
| [0032](0032-the-commitment-band.md) | The commitment band | Accepted; rebuilt on 0029 (formula v10) |
| [0033](0033-windows-and-pools.md) | Windows and pools | Accepted |
| [0034](0034-schedule-mode.md) | Schedule mode | **Withdrawn** |
| [0035](0035-commitments-are-custom-units.md) | Commitments are custom units | Accepted |
| [0036](0036-granularity-is-the-users.md) | Granularity is the user's | Accepted |

All foundational ADRs are **accepted** — implementation can begin.
Amendments are noted inline in each ADR; the data model in 0002
carries the accumulated schema amendments from 0003–0009.

**0027, 0028 and 0029 are the scoring rewrite** (formulas v7, v8 and
v9), and they have to be read as a sequence. **0029 is the one in
force**; read it first and read the other two for why.

- **0027** fixed a day that could score 112, with two bands allocated
  separately and a constant denominator of 100. It also made a plan's
  coverage decide its ceiling.
- **0028** withdrew that ceiling — every daily task done pays 80 at any
  coverage — removed satisfaction from weight derivation, and flattened
  the spread between units to 2:1. **§§1–2 are still in force**; §3 is
  not.
- **0029** replaced the line between the bands. It ran between *daily*
  and *weekly*, which made a genuinely weekly commitment worth a
  fraction of a daily one; it now runs between *planned* and
  *unplanned*, at 90 / 10, and a day is scored on the fraction of its
  actually-due work that got done. It is the first of the three to say
  what a day *is* rather than how its points are divided, and the only
  one that withdraws ADR-0024 §2 so the grade can see a weekday pin.

Between them they amend ADR-0003 §§1/5/6, ADR-0008 §1, ADR-0022 §1,
ADR-0023 §1, ADR-0024 §2 and ADR-0025 §§1–5. Read 0029 before touching
anything that prices a task or grades a day. 0027 takes 0026's number
out of order because the 112-point day would not wait for the load
meter.

**Four formulas in nine days is more churn than this engine should
take.** v7 landed on the 18th; v8 and v9 both landed on the 26th, out
of one conversation. 0029's Consequences commits to the obvious
correction: **the next change to this engine waits for a fortnight of
use.** No window in the calibration experiment (ADR-0008) currently
spans a single formula.

**0014, 0026 and 0031–0036 are the commitments work**, drafted
together across one long session on 2026-09-08..11, built over the
following three weeks, and **accepted 2026-10-01**. It was built on a
branch beside the scoring rewrite above and met it the same day: its
own three ADRs numbered 0028–0030 collided with main's and were
renumbered **0034, 0035 and 0036** (schedule mode, commitments are
custom units, granularity is the user's) — a file rename and nothing
else; the bodies are as accepted. Its formulas, numbered v8–v11 on the
branch, became one: **formula v10**, the commitment band on v9's day. Several carry
dated amendments from that building — the code showed where the
decision as written was incomplete or wrong — so read each through to
its action items. Read them in this order:

1. **[0035](0035-commitments-are-custom-units.md)** — a commitment is a
   custom `life_unit` in two levels, not a goal and not a parallel
   model. It also carries the measured finding that forced the whole
   design: thirteen non-daily tasks in a weight-12 unit price at
   `1,1,1,1,1,1,1,1,0,0,0,0,0` — **five worth literally zero** — which
   is the edge ADR-0027 named and parked.
2. **[0032](0032-the-commitment-band.md)** — on days with scheduled
   commitment work, the band (10–60) is that share of the whole day
   and ADR-0029's 90/10 is scaled into the rest. The first
   date-dependent split in the app's history. **Formula v10** (v8–v11
   in its own text, which predates the merge): off-schedule commitment
   work pays its scheduled-day worth, uncapped, and an early session
   stands in for the next one. Read ADR-0029 first.
3. **[0033](0033-windows-and-pools.md)** — the day divides into
   windows, work carries forward, and a window may hold a pool of up to
   three equal-priced options.
4. **[0036](0036-granularity-is-the-users.md)** — **the reopening
   ADR-0024 §1 demands.** Any task may carry a clock time; part-of-day
   stays the default, and that default is now load-bearing.
5. **[0026](0026-task-size-and-day-load.md)** and
   **[0014](0014-partial-credit.md)** — two reserved slots, both
   filled ahead of their stated triggers because this design needed
   them. Each records that, and why it proceeded anyway. **A third
   would be a signal.**

**[0034](0034-schedule-mode.md) and [0031](0031-the-semester-score.md)
are withdrawn**, never accepted — the first because generalising
commitments left nothing school-shaped to hide behind a mode, the
second because a term-length score needed a term and terms did not
survive generalisation. Both keep their bodies as the record.

The working-out, including what is measured against the engine versus
hand-computed, is in
[design/commitments-and-the-day.md](../design/commitments-and-the-day.md).
The surface detail is in
[design/hour-grid-day-view.md](../design/hour-grid-day-view.md).

## Work not tracked by any action item

Each ADR's own action items are the checklist for that decision. These
three gaps are **accepted decisions with no unchecked box anywhere**,
because they surfaced as parentheticals inside completed items. Recorded
here so they stop being invisible.

- ~~**The monthly review ritual is unbuilt.**~~ **Built 2026-08-19 as a
  checkpoint rather than a ceremony** (ADR-0002 decision 5, amended).
  Portfolio carries the month's grade, the days behind it, and what the
  month held, above the diagnostic's re-run entry — which until then
  existed only behind an empty state, so the loop could not be run
  twice. `loadMonthGrade` has its first caller. The original wording
  follows, for the record: ADR-0002 decision 5 (as
  amended by ADR-0005) defines it as one ceremony: diagnostic → new
  weights beside old overrides → settle goal statuses → adjust tasks →
  monthly grade and achievements. Every piece it needs exists and
  `loadMonthGrade` still has no caller. It is the single largest unbuilt
  thing in the product, and it is the landing place ADR-0003 §2's
  "unearnable points" nudge and ADR-0005 §2's carry-over prompts were
  both designed to appear in.
- ~~**Nothing reads the life log back.**~~ **Built 2026-08-19**: `db/log.ts`
  is the query side, and Log replaced Settings in the tab bar. Journals,
  photos, achievements and flagged days now come back, grouped by month,
  memories ahead of metrics. The original wording follows: `journal_entry`, `photo`, and
  `achievement` rows are written and never queried outside the day they
  belong to — `achievement` is insert-only, touched by nothing but
  `goals.ts` and the data reset. Design principle 5 ("the log is a
  record of a life") has no surface yet, and the look-back views that
  memory flags and special days feed do not exist.
- **The calendar tint for untouched past days is undecided.** ADR-0004's
  2026-07-26 amendment left it open on purpose: a past day with no row
  renders blank rather than as its half credit, so a week can read below
  100% with no visibly imperfect day behind it. Rendering twenty skipped
  days as a wall of red is the presentation this product avoids, so it
  needs deciding rather than defaulting — when the monthly review gets
  built.

## Planned ADRs

Decisions we know are coming, with the trigger that opens each one.
Numbers are reserved; write the ADR (copy [template.md](template.md))
when its trigger fires, not before. None of these blocks starting to
code.

| # | Title | Trigger — open this ADR when… | Decides |
|---|-------|-------------------------------|---------|
| 0012 | Backup service and identity | …cloud backup is being enabled in a real build (ADR-0002 specified the crypto, not the service) | Storage provider for ciphertext, anonymous account/restore model, passphrase-recovery UX, photo-payload handling, retention and cost |
| 0016 | Live multi-device sync | …a second device becomes a real need (deferred in ADR-0001/0002; UUIDs and soft deletes are the pre-payment) | Sync layer (Turso / PowerSync / snapshot-based), conflict policy, key distribution across devices |
| 0017 | LLM personalization opt-in | …the curated library starts feeling generic (the signal named in ADR-0006) | Provider, disclosure copy, what's redacted, cost; must re-confirm ADR-0008's contentment-data exclusion |
| 0018 | Templates and sharing | …the core loop is stable and the vision's extension phase begins | Package format (goals + tasks + guidance), import/export, attribution — and whether a marketplace is still worth it |

**0019–0022 were written ahead of the reserved numbers.** The
remaining reserved slots stay reserved for the triggers listed above;
multi-unit tasks, the crypto swap, and the two 2026-08-02 diagnostic
decisions simply came up first, and renumbering reserved slots to keep
the sequence tidy would break every reference already pointing at them.
(0011 and 0013 have since been written — both triggers fired when the
app went to friends. **0015 followed on 2026-08-16**, its trigger fired
from an unexpected direction: not manual completion chafing, but a
request for rough deadlines and retroactive milestones.) **0024–0026
continue past the reserved block** for the same reason: the 2026-08-16
scheduling workshop split into three decisions with different evidence
and different triggers. 0024 and 0025 were accepted that day; 0026
was filled ahead of its trigger on 2026-09-11 and accepted with the
commitments work. **Read 0024 first** — 0025 argues that 0024's
uniform rule is wrong for three of the eighteen units, so it only makes
sense afterwards.

**0016's trigger changed.** Multi-device sync was already deferred;
[ADR-0020](0020-backup-cryptography-and-export-exemption.md) makes the
app iOS-only, so if that ADR is ever opened it inherits an
Apple-frameworks-only crypto stack and an export exemption that a
second platform would forfeit.

Deliberately **not** ADRs: release operations (EAS/TestFlight/store
listings), testing conventions, and code style — those live in repo
docs and CLAUDE.md once scaffolding exists.
