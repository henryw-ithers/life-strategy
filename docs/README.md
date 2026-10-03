# Documentation

A map of the project's documents. If you only read three, read
[vision.md](../vision.md), the [ADR index](adr/README.md), and
[ADR-0029](adr/0029-a-day-is-the-fraction-you-got-through.md) (the
current scoring model).

## Product

| Document | What it is |
|---|---|
| [vision.md](../vision.md) | What the app does and why, with links to the decision behind each mechanism |
| [PRODUCT.md](../PRODUCT.md) | Who it is for, positioning, tone, and design principles |
| [DESIGN.md](../DESIGN.md) | The visual system: colour, type, components, and the contrast measurements behind them |
| [design/copy-guide.md](design/copy-guide.md) | Rules for anything the app says, chiefly that copy must read the same on a good week and a bad one |
| [backburner.md](backburner.md) | Ideas deliberately parked, and why |

## Decisions

| Document | What it is |
|---|---|
| [adr/](adr/README.md) | Architecture decision records: every significant decision, its options, and its evidence |

## Engineering and operations

| Document | What it is |
|---|---|
| [release.md](release.md) | TestFlight distribution, app identity, versioning, and the names that must never change |
| [web-preview.md](web-preview.md) | How the app runs in a browser for development, and why that setup is fragile |
| [privacy.md](privacy.md) | The privacy policy: the app collects nothing and has no server |
| [AGENTS.md](../AGENTS.md) | Orientation for AI coding agents: layout, vocabulary, and invariants |

## Content

The files in [content/](content/) are the source for text the app
displays. `npm run content:build` turns them into TypeScript, so edit
the Markdown, never the generated files.

| Document | What it is |
|---|---|
| [content/inventory.md](content/inventory.md) | Every string in the app and where to edit it |
| [content/units.md](content/units.md) · [content/areas.md](content/areas.md) | Descriptions and guidelines for each unit and area |
| [content/library.md](content/library.md) · [content/library-outline.md](content/library-outline.md) | The suggested goals and tasks, and the brief for writing them |
| [content/keywords.md](content/keywords.md) | Words that suggest unit tags when logging an activity |
| [content/notifications.md](content/notifications.md) | The daily reminder's copy |

## Design history

Working notes written while features were designed. They record how a
decision was reached and are kept for that reason; some details have
since changed. Where a note and an ADR disagree, the ADR is correct.

| Document | What it records |
|---|---|
| [design/diagnostic-flow-brief.md](design/diagnostic-flow-brief.md) | Design brief for the diagnostic (July 2026, revised August) |
| [design/portfolio-graph-brief.md](design/portfolio-graph-brief.md) | Design brief for the portfolio graph (July 2026) |
| [design/task-setup-brief.md](design/task-setup-brief.md) | Design brief for the first Plan screen (July 2026) |
| [design/calendar-and-day-planning.md](design/calendar-and-day-planning.md) | Phase plan for calendar and day planning (July 2026) |
| [design/scheduling-and-motivation.md](design/scheduling-and-motivation.md) | Research notes on scheduling and motivation, with citations (August 2026) |
| [design/commitments-and-the-day.md](design/commitments-and-the-day.md) | Working notes for commitments, windows and the commitment band (September 2026) |
| [design/hour-grid-day-view.md](design/hour-grid-day-view.md) | Plan for an hour-by-hour day view (September 2026, not built) |
| [design/critiques/](design/critiques/) | Two heuristic design reviews of every screen, and the fixes between them (July 2026) |
