# Life Strategy

[![CI](https://github.com/henryw-ithers/life-strategy/actions/workflows/ci.yml/badge.svg)](https://github.com/henryw-ithers/life-strategy/actions/workflows/ci.yml)

An iOS app that turns a monthly self-assessment of what matters to you
into a daily checklist and a score out of 100.

It is based on Rainer Strack's *Harvard Business Review* article on
strategic life planning. The planning happens once a month; the daily
part is a checklist and a number.

## How it works

1. **Diagnose.** Rank 18 Strategic Life Units (Friendship, Sleep &
   recovery, Learning & growth, …), grouped into 6 life areas, by
   priority, and rate your satisfaction with each from 1 to 10
   ([ADR-0022](docs/adr/0022-satisfaction-is-rated-not-ranked.md)).
   Each diagnostic is saved, and the history is drawn as a portfolio
   bubble chart.
2. **Derive.** The priority ranking becomes each unit's share of 100
   daily points. Satisfaction is recorded and plotted but does not
   change the points; it is how you see whether the plan is working
   ([ADR-0028](docs/adr/0028-priority-is-the-only-input.md)).
3. **Plan.** Goals and tasks sit inside units. A task happens a set
   number of times a week and can optionally be pinned to weekdays, a
   part of the day, or a clock time. A built-in library suggests goals
   and tasks.
4. **Do.** Each day is scored on the fraction of that day's due work
   you finished: 90 points for planned work and up to 10 for unplanned
   activities. Only extra runs of your own tasks can take a day past
   100 ([ADR-0029](docs/adr/0029-a-day-is-the-fraction-you-got-through.md)).
5. **Review.** Days roll up into weekly and monthly grades. A weekly
   one-question check-in records how content you felt, so the grades
   can be compared with how the weeks actually went.

Also built:

- **Commitments** such as school, work or a club. They get their own
  share of the day, can be split into sub-commitments, and can hold
  events with start and end times
  ([ADR-0032](docs/adr/0032-the-commitment-band.md),
  [ADR-0035](docs/adr/0035-commitments-are-custom-units.md),
  [ADR-0038](docs/adr/0038-events.md)).
- **Windows and pools:** the free gaps between commitments, each
  holding a few interchangeable tasks
  ([ADR-0033](docs/adr/0033-windows-and-pools.md)).
- **Rest days:** a day with nothing due scores 70 automatically, and
  work done early is paid what its planned day would have paid
  ([ADR-0037](docs/adr/0037-rest-days.md)).
- Partial credit, tasks that serve several units, goals that track a
  number, and a daily journal with photos.
- **Encrypted backup** using only Apple's CryptoKit and CommonCrypto,
  which keeps the app exempt from US export-control reporting
  ([ADR-0020](docs/adr/0020-backup-cryptography-and-export-exemption.md)).

Scores are private and presented as guidelines. The app has no streak
penalties, leaderboards or alarm colours. See [vision.md](vision.md)
and [PRODUCT.md](PRODUCT.md).

## Architecture

```
apps/mobile              Expo app (React Native, TypeScript, Expo Router)
  src/app                screens, as file-based routes
  src/components         UI, grouped by feature (today, plan, goals, …)
  src/hooks              screen-level state
  src/db                 SQLite via Drizzle, one module per concern
  src/lib                pure helpers (calendar, formatting, redaction)
  modules/glide-crypto   Swift native module wrapping Apple's crypto
  drizzle/               forward-only schema migrations
packages/scoring         the scoring engine: pure functions, no React Native
packages/backup          the backup file format: pure, crypto passed in
docs/adr                 34 architecture decision records
```

**All scoring arithmetic lives in `packages/scoring`** as pure, tested
functions with no React Native imports
([ADR-0001](docs/adr/0001-platform-and-tech-stack.md)). The app's data
layer reads rows from SQLite and passes them to the engine, and the
screens display what comes back. This keeps the rules that matter most
testable without a phone.

The backup package works the same way. The file format is plain
TypeScript and receives its cipher as a parameter, so the format is
tested in Node while the app supplies Apple's implementation on the
device.

Every significant decision, including ones later withdrawn, is
recorded in the [ADR index](docs/adr/README.md).

## Tech stack

TypeScript · React Native 0.81 · Expo SDK 54 (pinned; see ADR-0001) ·
Expo Router · SQLite (`expo-sqlite`) with Drizzle ORM · Reanimated and
Skia for the portfolio graph · Swift for the native crypto module ·
Vitest · ESLint · GitHub Actions

## Getting started

Requires Node 20.19 or later (CI uses Node 22).

```bash
npm install          # also applies patches/ via patch-package
npm test             # content check, engine, backup format, app logic
npm run typecheck    # all three workspaces
npm run lint         # ESLint over the app
npm run mobile       # Expo dev server
```

The app runs in Expo Go, except for backup and restore, which need the
native crypto module and therefore a development or TestFlight build.
It also runs in a browser as a development preview only; see
[docs/web-preview.md](docs/web-preview.md).

## Documentation

[docs/README.md](docs/README.md) maps every document. The main ones:

- [vision.md](vision.md): what the app does and why.
- [docs/adr/](docs/adr/README.md): the decision records, with a summary
  of each.
- [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md): positioning,
  tone and the visual system.
- [docs/release.md](docs/release.md): TestFlight, app identity, and the
  names that must never change.
- [AGENTS.md](AGENTS.md): orientation for AI coding agents.

## License

Copyright © 2026 Henry Withers. All rights reserved; see
[LICENSE](LICENSE).
