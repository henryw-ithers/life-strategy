# Architecture Decision Records

Each significant decision behind the app is written up as an ADR:
the problem, the options considered, what was chosen, and the evidence
for it. They are numbered in the order they were made. The first ten
were settled before any application code was written; the rest came up
as the app was built and used.

ADRs are dated records and are not rewritten after acceptance. When a
later decision changes an earlier one, the earlier ADR gets a dated
amendment note and the status column below says what replaced it.
Withdrawn ADRs keep their full text so the reasoning can still be
traced. Copy [template.md](template.md) to write a new one.

## Index

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-platform-and-tech-stack.md) | Expo (React Native) and TypeScript, chosen over a web app, Flutter, or native Swift and Kotlin | Accepted; EAS builds instead of Expo Go per 0043 |
| [0002](0002-data-model-and-persistence.md) | Local SQLite schema for the taxonomy, diagnostics, goals, tasks and grades | Accepted; decision 4 and goal history amended by 0041 and 0042; Backup v1 amended by 0046 |
| [0003](0003-scoring-and-weight-derivation.md) | First weight formula, rounding, overrides, and pricing tasks by rank | Accepted; §1 amended by 0028 |
| [0004](0004-grade-lifecycle-and-aggregation.md) | When a day closes, day kinds, and weekly and monthly totals | Accepted; §2 superseded by 0014; Away and emptied days per 0040 |
| [0005](0005-diagnostic-snapshots-and-history.md) | Monthly diagnostic, snapshots that never destroy data, measured bubble size | Accepted; §1 amended and §§3–4 removed by 0041 |
| [0006](0006-task-and-goal-recommendations.md) | Suggestions come from a curated library shipped with the app | Accepted; goal library replaced by templates (0042) |
| [0007](0007-goal-lifecycle.md) | Goal states, the three ways to complete a goal, achievements | Accepted; goal types and milestones amended by 0042 |
| [0008](0008-contentment-calibration.md) | Weekly contentment check-in; suggestions apply only when confirmed | Accepted |
| [0009](0009-spontaneous-activities.md) | Logging unplanned activities and how they are credited | Accepted; §3 amended by 0023 |
| [0010](0010-notifications-and-reminders.md) | One daily reminder, generic copy, nothing personal on the lock screen | Accepted |
| [0011](0011-onboarding-and-first-run.md) | The first-run flow; the first diagnostic is required | Accepted; flow replaced by 0045 |
| [0013](0013-crash-reporting-and-telemetry.md) | No telemetry; crashes are logged on the device and sent only by the user | Accepted |
| [0014](0014-partial-credit.md) | Tasks can opt in to partial completion in 25% steps | Accepted |
| [0015](0015-metric-linked-goals.md) | Goals that track a number or a habit streak | Accepted; metric kinds replaced by 0042 |
| [0019](0019-multi-unit-tasks.md) | One task can serve up to three units | Accepted |
| [0020](0020-backup-cryptography-and-export-exemption.md) | Backups use only Apple's cryptography, which keeps the app export-exempt; iOS only | Superseded by 0046 |
| [0021](0021-areas-are-presentational.md) | Life areas affect colour and grouping, never scores | Accepted; §2 colours amended by 0043 |
| [0022](0022-satisfaction-is-rated-not-ranked.md) | Priority is ranked; satisfaction is rated 1–10 | Accepted; satisfaction no longer asked (0041) |
| [0023](0023-planned-work-is-what-pays.md) | Unplanned credit is capped; only your own plan pays above 100 | Accepted |
| [0024](0024-day-planning-is-intention.md) | Planning a task onto a day is an intention, not an obligation | Accepted; §1 reopened by 0036, §2 withdrawn by 0029, §§3–4 amended by 0039 |
| [0025](0025-communal-units-are-dimensions.md) | The three Relationships units are tagged onto other work, not given tasks | Accepted; amended by 0027 |
| [0026](0026-task-size-and-day-load.md) | Optional task sizes, used for planning and never for pricing | Accepted; amended by 0039 and 0044 |
| [0027](0027-coverage-decides-the-ceiling.md) | Two scoring bands; units can be taken out of the plan | §§1–3 superseded by 0029 |
| [0028](0028-priority-is-the-only-input.md) | Weights come from priority alone, flattened to a 2:1 spread | Accepted; §2 replaced by tiers (0041), §3 superseded by 0029 |
| [0029](0029-a-day-is-the-fraction-you-got-through.md) | A day is scored on the fraction of its due work done (90 planned + 10 unplanned) | Accepted; **current scoring model**; §§1, 3 amended by 0039 and 0040 |
| [0030](0030-goals-have-conditions.md) | Goals can list parallel conditions, each with its own tasks | Superseded by 0042 |
| [0031](0031-the-semester-score.md) | A term-length score for school | **Withdrawn** |
| [0032](0032-the-commitment-band.md) | On days with commitment work, commitments get their own share of the day | Accepted; rebuilt on 0029; §1 amended by 0044 and 0040 |
| [0033](0033-windows-and-pools.md) | The day is divided into windows; unfinished work carries forward | §§1, 4 superseded and §2 amended by 0039 |
| [0034](0034-schedule-mode.md) | A separate "schedule mode" for students | **Withdrawn** |
| [0035](0035-commitments-are-custom-units.md) | Commitments (school, work, a club) are custom units with sub-commitments | Accepted; amended by 0038 and 0044 |
| [0036](0036-granularity-is-the-users.md) | Any task may have a clock time; none requires one | Accepted; events excepted by 0038; pins per 0039 |
| [0037](0037-rest-days.md) | A day with nothing due becomes a rest day worth 70 | Accepted; §§1, 3 amended by 0040 and 0039 |
| [0038](0038-events.md) | Events: timed tasks such as classes and shifts | Accepted; location removed and repeats bounded by 0040 |
| [0039](0039-work-windows-come-from-your-hours.md) | Windows come from your working hours; suggestions are live and pins are yours | Accepted |
| [0040](0040-schedules-can-end-skip-and-clear.md) | Repeats can end and skip weeks; Clear today and Away; event location removed | Accepted |
| [0041](0041-priorities-are-tiers.md) | Priorities are four tiers; satisfaction and the portfolio graph go | Accepted |
| [0042](0042-goals-are-measured-by-the-app.md) | Goals count times done, time, points or a streak; existing goals erased; templates replace the goal library | Accepted |
| [0043](0043-the-app-uses-native-ios-controls.md) | Native iOS controls, Liquid Glass, the Prism style and user colours; EAS builds | Accepted |
| [0044](0044-a-commitment-share-comes-from-your-day.md) | A commitment's share is its time as a part of your working day, with an override | Accepted |
| [0045](0045-onboarding-builds-a-first-week.md) | Onboarding sets up priorities, commitments and hours, and shows a first week | Accepted |
| [0046](0046-backups-are-plain-files.md) | Backups are plain files: no passphrase, no encryption, a CRC-32 check | Accepted |

## Reading guide

**Start with 0029 for scoring.** 0027, 0028 and 0029 rewrote the scoring
engine in sequence (formula versions 7, 8 and 9), and each changed the
one before:

- **0027** fixed a bug where a day could score 112, and made a unit with
  no tasks leave its points unearned.
- **0028** removed satisfaction from the weight formula and narrowed the
  gap between the highest and lowest unit to 2:1. Its §§1–2 still apply.
- **0029** replaced the split between daily and weekly work with a split
  between planned (90) and unplanned (10) work, and scored each day on
  the work actually due that day. It is the model in force.

Three formula changes in nine days was too much churn for an engine
that is meant to be calibrated against real use, so 0029 commits to
leaving the formula alone for at least a fortnight of use before the
next change.

**Then the commitments work, in this order:** 0035 (the data model),
0032 (scoring, formula v10), 0033 (windows), 0036 (clock times), then
0026 and 0014. These were drafted together in September 2026 and
accepted on 2026-10-01. They were written on a branch alongside the
scoring rewrite, so three of them were renumbered to 0034–0036 when the
branch merged; only the file names changed. 0035 contains the
measurement that motivated the design: thirteen non-daily tasks in a
unit worth 12 points priced at `1,1,1,1,1,1,1,1,0,0,0,0,0`, so five
were worth nothing.

**Withdrawn:** 0034 (schedule mode) became unnecessary once commitments
were generalised beyond school, and 0031 (the semester score) needed a
school term, which the general model does not have. Neither was ever
accepted.

The design notes behind the commitments work, including which numbers
were measured against the engine and which were worked out by hand,
are in
[design/commitments-and-the-day.md](../design/commitments-and-the-day.md).

## Planned ADRs

Decisions known to be coming. Each number is reserved and gets written
when its trigger happens.

| # | Title | Write it when… | Decides |
|---|-------|----------------|---------|
| 0012 | Backup service and identity | cloud backup is enabled in a real build | Where encrypted backups are stored, how restore works without an account, passphrase recovery, cost |
| 0016 | Multi-device sync | a second device becomes a real need | Sync approach, conflict handling, sharing keys between devices. 0020 made the app iOS-only and 0046 kept it; a second platform needs its own ADR |
| 0017 | Opt-in AI personalisation | the curated library starts to feel generic | Provider, disclosure, what is redacted, cost; must keep contentment data excluded (0008) |
| 0018 | Templates and sharing | the core loop is stable | Package format, import and export, attribution |

**The windows redesign (October 2026)** is 0039–0045, written from
[design/redesign-spec.md](../design/redesign-spec.md). Read 0039 first;
0041 and 0044 together make formula v11.

**Why the numbers have gaps.** 0012 and 0016–0018 are reserved. 0019 to
0045 were written as other decisions came up first; renumbering to fill
the gaps would break every existing link to them.

**Not ADRs:** release operations ([release.md](../release.md)), testing
conventions and code style ([AGENTS.md](../../AGENTS.md)).
