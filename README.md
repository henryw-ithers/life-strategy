# Life Strategy

[![CI](https://github.com/henryw-ithers/life-strategy/actions/workflows/ci.yml/badge.svg)](https://github.com/henryw-ithers/life-strategy/actions/workflows/ci.yml)

A personal planning app for iOS that turns a periodic self-assessment
of what matters into a daily checklist and a score out of 100.

Inspired by Rainer Strack's *Harvard Business Review* work on strategic
life planning. Strategy is thoughtful and periodic; execution is a
checklist and a number.

## How it works

1. **Diagnose.** Rate 18 Strategic Life Units (Friendship, Sleep &
   recovery, Learning & growth, …), grouped into 6 life areas, for
   priority and satisfaction on a 1–10 scale. Each diagnostic is saved
   as a snapshot, and the snapshots plot over time as a portfolio
   bubble chart.
2. **Derive.** Priority rank becomes each unit's share of 100 daily
   points. Satisfaction is tracked and plotted, but deliberately does
   not feed the weights — it measures whether the plan is working
   ([ADR-0028](docs/adr/0028-priority-is-the-only-input.md)).
3. **Plan.** Goals and tasks live inside units. A task happens N times
   a week, optionally pinned to weekdays, a part of the day, or a clock
   time. A built-in library suggests goals and tasks to start from.
4. **Do.** Each day's score is the fraction of *that day's* due work
   you got through: 90 points for planned work, 10 for unplanned
   activities, with extra runs of your own plan the only way above 100
   ([ADR-0029](docs/adr/0029-a-day-is-the-fraction-you-got-through.md)).
5. **Review.** Days roll into weekly and monthly grades, and a weekly
   one-question contentment check-in calibrates the numbers against how
   the week actually felt.

Beyond the core loop:

- **Commitments** — school, work, a club — get their own band of the
  day, split into sub-commitments, with events that have real start and
  end times ([ADR-0032](docs/adr/0032-the-commitment-band.md),
  [ADR-0035](docs/adr/0035-commitments-are-custom-units.md),
  [ADR-0038](docs/adr/0038-events.md)).
- **Windows and pools** — the free gaps between commitments, each
  holding a small set of interchangeable tasks
  ([ADR-0033](docs/adr/0033-windows-and-pools.md)).
- **Rest days** — a day that asks nothing scores 70 automatically, and
  work done early is paid what its planned day would have paid
  ([ADR-0037](docs/adr/0037-rest-days.md)).
- **Partial credit, multi-unit tasks, metric-linked goals, and a daily
  journal with photos.**
- **Encrypted backup** using only Apple's CryptoKit and CommonCrypto,
  which keeps the app exempt from US export-control reporting
  ([ADR-0020](docs/adr/0020-backup-cryptography-and-export-exemption.md)).

The product is opinionated about tone: scores are private, framed as
guidelines, and never used to shame — no streak guilt, leaderboards or
alarm colours. See [vision.md](vision.md) and [PRODUCT.md](PRODUCT.md).

## Architecture

```
apps/mobile          Expo app (React Native, TypeScript, Expo Router)
  src/app            screens, as file-based routes
  src/components     UI, grouped by feature (today, plan, goals, …)
  src/hooks          screen-level state
  src/db             SQLite via Drizzle: one module per concern
  src/lib            pure helpers (calendar, formatting, redaction)
  modules/glide-crypto   Swift native module: Apple's crypto only
  drizzle/           forward-only schema migrations
packages/scoring     the scoring engine — pure functions, no React Native
packages/backup      the backup file format — pure, crypto injected
docs/adr             34 architecture decision records
```

The rule that shapes the code: **all scoring arithmetic lives in
`packages/scoring` as pure, tested functions** with no React Native
imports ([ADR-0001](docs/adr/0001-platform-and-tech-stack.md)). The app's
data layer reads rows from SQLite and hands them to the engine; screens
render what comes back. The backup package follows the same pattern —
its format logic is pure TypeScript, and the cipher arrives injected, so
the envelope is tested off-device while the device uses Apple's
primitives.

Every architecturally significant decision is recorded as an ADR,
including the ones later withdrawn — see the
[ADR index](docs/adr/README.md).

## Tech stack

TypeScript · React Native 0.81 · Expo SDK 54 (pinned — see ADR-0001) ·
Expo Router · SQLite (`expo-sqlite`) with Drizzle ORM · Reanimated and
Skia for the portfolio graph · Swift for the native crypto module ·
Vitest · ESLint · GitHub Actions

## Getting started

Requires Node 20.19 or later.

```bash
npm install          # also applies patches/ via patch-package
npm test             # content check, engine, backup format, app logic
npm run typecheck    # all three workspaces
npm run lint         # ESLint over the app
npm run mobile       # Expo dev server
```

The app runs in Expo Go on a device, except for backup and restore,
which need the native crypto module and so a development or TestFlight
build. It also runs in a browser as a development preview only — see
[docs/web-preview.md](docs/web-preview.md).

## Documentation

- [vision.md](vision.md) — the product: philosophy, mechanics, scoring.
- [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) — strategy, tone
  and the visual system.
- [docs/adr/](docs/adr/) — architecture decision records.
- [docs/release.md](docs/release.md) — TestFlight, identity, versioning,
  and the names that must never be renamed.
- [docs/backburner.md](docs/backburner.md) — parked ideas and why.
- [AGENTS.md](AGENTS.md) — orientation for AI coding agents.

## License

Copyright © 2026 Henry Withers. All rights reserved — see
[LICENSE](LICENSE).
