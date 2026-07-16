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

All foundational ADRs are **accepted** — implementation can begin.
Amendments are noted inline in each ADR; the data model in 0002
carries the accumulated schema amendments from 0003–0009.

New ADRs: copy [template.md](template.md), take the next number, add a
row here.
