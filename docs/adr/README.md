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
| [0004](0004-grade-lifecycle-and-aggregation.md) | Grade lifecycle and aggregation | Accepted |
| [0005](0005-diagnostic-snapshots-and-history.md) | Diagnostic snapshots and portfolio history | Accepted |
| [0006](0006-task-and-goal-recommendations.md) | Task and goal recommendation source | Accepted |
| [0007](0007-goal-lifecycle.md) | Goal lifecycle and milestones | Accepted |
| [0008](0008-contentment-calibration.md) | Contentment calibration and sensitive data | Accepted |
| [0009](0009-spontaneous-activities.md) | Spontaneous activities and bonus credit | Accepted |
| [0010](0010-notifications-and-reminders.md) | Notifications and reminders | Accepted |
| [0011](0011-onboarding-and-first-run.md) | Onboarding and first run | Accepted |
| [0013](0013-crash-reporting-and-telemetry.md) | Crash reporting and telemetry | Accepted |
| [0015](0015-metric-linked-goals.md) | Metric-linked goals | Accepted |
| [0019](0019-multi-unit-tasks.md) | Tasks that serve more than one unit | Accepted |
| [0020](0020-backup-cryptography-and-export-exemption.md) | Backup cryptography and export exemption | Accepted |
| [0021](0021-areas-are-presentational.md) | Strategic Life Areas are presentational | Accepted |
| [0022](0022-satisfaction-is-rated-not-ranked.md) | Satisfaction is rated, not ranked | Accepted |
| [0023](0023-planned-work-is-what-pays.md) | Planned work is what pays | Accepted |
| [0024](0024-day-planning-is-intention.md) | Day planning is intention, not obligation | Accepted |
| [0025](0025-communal-units-are-dimensions.md) | Communal units are dimensions, not containers | Amended by 0027 |
| [0027](0027-coverage-decides-the-ceiling.md) | Coverage decides the ceiling | Proposed |

All foundational ADRs are **accepted** — implementation can begin.
Amendments are noted inline in each ADR; the data model in 0002
carries the accumulated schema amendments from 0003–0009.

**0027 is the scoring rewrite** (formula v7). It withdraws ADR-0003
§5's uncovered-weight reallocation and amends ADR-0025 §§1–5, so read
it before touching anything that prices a task or grades a day. It
takes 0026's number out of order because the 112-point day would not
wait for the load meter.

## Work not tracked by any action item

Each ADR's own action items are the checklist for that decision. These
three gaps are **accepted decisions with no unchecked box anywhere**,
because they surfaced as parentheticals inside completed items. Recorded
here so they stop being invisible.

- **The monthly review ritual is unbuilt.** ADR-0002 decision 5 (as
  amended by ADR-0005) defines it as one ceremony: diagnostic → new
  weights beside old overrides → settle goal statuses → adjust tasks →
  monthly grade and achievements. Every piece it needs exists and
  `loadMonthGrade` still has no caller. It is the single largest unbuilt
  thing in the product, and it is the landing place ADR-0003 §2's
  "unearnable points" nudge and ADR-0005 §2's carry-over prompts were
  both designed to appear in.
- **Nothing reads the life log back.** `journal_entry`, `photo`, and
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
| 0014 | Partial credit | …calibration data (ADR-0008) shows binary completion diverging from felt contentment — the trigger written into ADR-0004 | The completion-fraction model and its UI without breaking one-tap simplicity |
| 0016 | Live multi-device sync | …a second device becomes a real need (deferred in ADR-0001/0002; UUIDs and soft deletes are the pre-payment) | Sync layer (Turso / PowerSync / snapshot-based), conflict policy, key distribution across devices |
| 0017 | LLM personalization opt-in | …the curated library starts feeling generic (the signal named in ADR-0006) | Provider, disclosure copy, what's redacted, cost; must re-confirm ADR-0008's contentment-data exclusion |
| 0018 | Templates and sharing | …the core loop is stable and the vision's extension phase begins | Package format (goals + tasks + guidance), import/export, attribution — and whether a marketplace is still worth it |
| 0026 | Task size and day load | …the weekly planning pass (ADR-0024) is in real use and "is this day too full?" has come up unprompted | Effort size on tasks (`quick`/`normal`/`big`, reusing `activity.size`'s vocabulary), the per-day load indicator, and the confirmation that load stays presentational and never reaches the grade |

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
waits for its trigger. **Read 0024 first** — 0025 argues that 0024's
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
