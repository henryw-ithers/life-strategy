# Life Strategy

[![CI](https://github.com/henryw-ithers/life-strategy/actions/workflows/ci.yml/badge.svg)](https://github.com/henryw-ithers/life-strategy/actions/workflows/ci.yml)

An iOS app that turns what matters to you into a daily checklist and
a score out of 100.

It is based on Rainer Strack's *Harvard Business Review* article on
strategic life planning. The planning happens now and then; the daily
part is a checklist and a number.

## How it works

1. **Prioritise.** Sort 18 Strategic Life Units (Friendship, Sleep &
   recovery, Learning & growth, …), grouped into 6 life areas, into
   four tiers (Top, Important, Background, Not now) and order them
   within each. Each time you finish, a snapshot is saved
   ([ADR-0041](docs/adr/0041-priorities-are-tiers.md)).
2. **Derive.** Tier and order become each unit's share of 100 daily
   points. Not now is out of the plan. Life shows each unit's share of
   the work you actually did over the last four weeks, with no target.
3. **Plan.** Tasks sit inside units. A task happens a set number of
   times a week and can optionally be pinned to weekdays, a part of the
   day, or a clock time. A built-in library suggests tasks, and
   onboarding builds a first week from your Top units
   ([ADR-0045](docs/adr/0045-onboarding-builds-a-first-week.md)).
4. **Do.** Each day is scored on the fraction of that day's due work
   you finished: 90 points for planned work and up to 10 for unplanned
   activities. Only extra runs of your own tasks can take a day past
   100 ([ADR-0029](docs/adr/0029-a-day-is-the-fraction-you-got-through.md)).
5. **Review.** Days roll up into weekly and monthly grades. A weekly
   one-question check-in records how content you felt, so the grades
   can be compared with how the weeks actually went.

Also built:

- **Working hours and windows:** you set when you're free to work;
  events and named gaps are taken out, and what's left is shown as
  windows that suggestions fill and you can pin tasks into. Windows
  never change a score
  ([ADR-0039](docs/adr/0039-work-windows-come-from-your-hours.md)).
- **Commitments** such as school, work or a club. They get their own
  share of the day, sized from their hours, can be split into
  sub-commitments, and can hold events with start and end times
  ([ADR-0035](docs/adr/0035-commitments-are-custom-units.md),
  [ADR-0038](docs/adr/0038-events.md),
  [ADR-0044](docs/adr/0044-a-commitment-share-comes-from-your-day.md)).
- **Rest days:** a day with nothing due scores 70 automatically, and
  work done early is paid what its planned day would have paid
  ([ADR-0037](docs/adr/0037-rest-days.md)). Clear today and Away set
  days aside ([ADR-0040](docs/adr/0040-schedules-can-end-skip-and-clear.md)).
- **Achievements:** forty series of counts and runs, each with five
  ranks, defined by the app and never taken back. They never grade a
  day ([ADR-0047](docs/adr/0047-achievements-replace-goals.md)).
- Partial credit, tasks that serve several units, and a daily journal
  with photos.
- **Backup** to one plain file, with no passphrase, that you keep
  wherever you like ([ADR-0046](docs/adr/0046-backups-are-plain-files.md)).

Scores are private and presented as guidelines. The app has no streak
penalties, leaderboards or alarm colours. See [vision.md](vision.md)
and [PRODUCT.md](PRODUCT.md).

## Architecture

```
apps/mobile              Expo app (React Native, TypeScript, Expo Router)
  src/app                screens, as file-based routes
  src/components         UI, grouped by feature (today, plan, life, …)
  src/hooks              screen-level state
  src/db                 SQLite via Drizzle, one module per concern
  src/lib                pure helpers (calendar, formatting, redaction)
  drizzle/               forward-only schema migrations
packages/scoring         the scoring engine: pure functions, no React Native
packages/backup          the backup file format: pure, plain, with a checksum
docs/adr                 43 architecture decision records
```

**All scoring arithmetic lives in `packages/scoring`** as pure, tested
functions with no React Native imports
([ADR-0001](docs/adr/0001-platform-and-tech-stack.md)). The app's data
layer reads rows from SQLite and passes them to the engine, and the
screens display what comes back. This keeps the rules that matter most
testable without a phone.

The backup package works the same way. The file format is plain
TypeScript, so it is tested in Node; the app supplies the database
bytes and the share sheet on the device.

Every significant decision, including ones later withdrawn, is
recorded in the [ADR index](docs/adr/README.md).

## Tech stack

TypeScript · React Native 0.86 · React 19.2 · Expo SDK 57 (an EAS
development build; see ADR-0043) · Expo Router · SQLite
(`expo-sqlite`) with Drizzle ORM · Reanimated · Vitest · ESLint ·
GitHub Actions

## Getting started

Requires Node 20.19 or later (CI uses Node 22).

```bash
npm install          # also applies patches/ via patch-package
npm test             # content check, engine, backup format, app logic
npm run typecheck    # all three workspaces
npm run lint         # ESLint over the app
npm run mobile       # Expo dev server
```

The app runs on the iPhone as an EAS development build, not Expo Go;
see [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md). It also runs in a browser as a development preview only; see
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
