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
| [0019](0019-multi-unit-tasks.md) | Tasks that serve more than one unit | Accepted |

All foundational ADRs are **accepted** — implementation can begin.
Amendments are noted inline in each ADR; the data model in 0002
carries the accumulated schema amendments from 0003–0009.

## Planned ADRs

Decisions we know are coming, with the trigger that opens each one.
Numbers are reserved; write the ADR (copy [template.md](template.md))
when its trigger fires, not before. None of these blocks starting to
code.

| # | Title | Trigger — open this ADR when… | Decides |
|---|-------|-------------------------------|---------|
| 0011 | Onboarding and first run | …anyone other than Henry is about to install a build | Flow order (welcome → taxonomy → first diagnostic → starter plan → notification ask), skippability of each step, the one neutral Support Resources mention (ADR-0008) |
| 0012 | Backup service and identity | …cloud backup is being enabled in a real build (ADR-0002 specified the crypto, not the service) | Storage provider for ciphertext, anonymous account/restore model, passphrase-recovery UX, photo-payload handling, retention and cost |
| 0013 | Crash reporting and telemetry | …before any distribution beyond the dev machine | Zero-telemetry vs. opt-in crash reports; if any, provider and scrubbing. Standing default until then: nothing leaves the device, period |
| 0014 | Partial credit | …calibration data (ADR-0008) shows binary completion diverging from felt contentment — the trigger written into ADR-0004 | The completion-fraction model and its UI without breaking one-tap simplicity |
| 0015 | Metric-linked goals | …manual completion proves limiting in real use (deferred in ADR-0007; `goal.target_value` is waiting) | Progress entries, auto-completion, per-goal-type design |
| 0016 | Live multi-device sync | …a second device becomes a real need (deferred in ADR-0001/0002; UUIDs and soft deletes are the pre-payment) | Sync layer (Turso / PowerSync / snapshot-based), conflict policy, key distribution across devices |
| 0017 | LLM personalization opt-in | …the curated library starts feeling generic (the signal named in ADR-0006) | Provider, disclosure copy, what's redacted, cost; must re-confirm ADR-0008's contentment-data exclusion |
| 0018 | Templates and sharing | …the core loop is stable and the vision's extension phase begins | Package format (goals + tasks + guidance), import/export, attribution — and whether a marketplace is still worth it |

**0019 was written ahead of its reserved numbers.** 0011–0018 stay
reserved for the triggers listed above; multi-unit tasks simply came
up first, and renumbering reserved slots to keep the sequence tidy
would break every reference already pointing at them.

Deliberately **not** ADRs: release operations (EAS/TestFlight/store
listings), testing conventions, and code style — those live in repo
docs and CLAUDE.md once scaffolding exists.
