# ADR-0001: Platform and tech stack

> **Status:** Accepted\
> **Date:** 2026-07-15\
> **Deciders:** Henry

## Context

The app's daily surface is a quick checklist — the kind of interaction
that lives naturally on a phone — while the diagnostic and portfolio
graph are richer, more contemplative surfaces. The stack choice shapes
everything downstream (data model, sync, recommendation engine), so it
is decided first.

Constraints:

- **Solo developer.** One codebase, boring and well-documented
  technology, and a large ecosystem beat maximal performance.
- **No hard stack preference.** Developer is comfortable across
  TypeScript/React, Python, and Flutter/Dart, and asked to optimize for
  the project rather than existing skills.
- **Sensitive data.** Diagnostic ratings (mental health, faith,
  relationships) and contentment scores demand a privacy-first
  posture: the device is the source of truth.
- **Demanding UI element.** The animated portfolio bubble graph
  (importance × satisfaction, bubble size = effort, history playback)
  is the hardest thing this app renders; the stack must make it
  tractable.

## Options considered

### Option A: Expo (React Native) + TypeScript — chosen

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — managed workflow hides most native pain |
| Cost | Free to develop; EAS build free tier sufficient early; app-store fees apply |
| Daily-checklist UX | Excellent — real app, home screen, reliable notifications |
| Portfolio graph | Strong — Skia canvas (`@shopify/react-native-skia`) + Reanimated |
| Ecosystem / AI-assistability | Largest of the options |

**Pros:** Real app-store presence and first-class notifications (the
daily loop lives or dies on reminders); TypeScript end to end; SQLite
on device is a solved problem (`expo-sqlite`); web output via Expo
Router / `react-native-web` remains possible later; one language for
app, scoring engine, and any future backend.

**Cons:** App-store review friction and release overhead; heavier
toolchain than a plain web app; some churn in the RN ecosystem.

### Option B: Responsive web app / PWA

**Pros:** Fastest to ship; zero store friction; simplest deploys.
**Cons:** iOS PWA notifications and background behavior remain
second-class — a real risk for a daily-reminder product; "installing"
a PWA is alien to most users. Rejected as the primary target, retained
as a possible later surface for the diagnostic/graph.

### Option C: Flutter (mobile + web + desktop)

**Pros:** Single codebase everywhere; excellent canvas/charting;
first-class notifications.
**Cons:** Dart is a smaller ecosystem with weaker AI-assist and fewer
libraries for everything around the app (sync layers, backend
sharing); web output is heavy. Viable, but loses to A on ecosystem for
a solo dev with no Dart preference.

### Option D: Native Swift + Kotlin

Two codebases. Immediately disqualified by the solo-developer
constraint.

## Decision

**Expo (React Native) with TypeScript**, targeting iOS and Android
from one codebase.

- **Framework:** Expo managed workflow, Expo Router, EAS for builds.
  Prebuild/eject remains available if a native module demands it.
- **Language:** TypeScript everywhere — app, scoring engine, and any
  future backend. Python stays out of v1; it may appear later for
  offline analysis experiments (ADR-0008), but product code stays one
  language. The scoring/weight engine (ADR-0003) is written as a pure
  TypeScript package with no React Native imports, so it can be unit
  tested in isolation and reused on web or a server unchanged.
- **Local data:** SQLite on device via `expo-sqlite`, with Drizzle ORM
  for typed schema and migrations. The device is the source of truth.
- **Backup/sync:** hybrid local-first — v1 ships **encrypted cloud
  backup** (client-side encrypted SQLite snapshot/export pushed to
  object storage); live multi-device sync is deferred. Candidate sync
  layers when needed: Turso embedded replicas, PowerSync, or a custom
  CRDT-free "last snapshot wins" model — evaluated in ADR-0002.
- **Portfolio graph:** custom bubble chart drawn with
  `@shopify/react-native-skia`, animated with Reanimated. Victory
  Native XL (Skia-based) may supply the grade-log charts; the bubble
  graph is bespoke by design since it's the product's centerpiece.
- **State:** keep it boring — Zustand (or React context) over the
  SQLite layer; no server state library until there's a server.

## Consequences

- **Easier:** one language and one repo end to end; the scoring engine
  is portable and testable; notifications and home-screen presence come
  free; privacy story is simple ("your data is on your phone;
  backups are encrypted before they leave it").
- **Harder:** app-store accounts, review cycles, and release management
  from day one; iOS builds require EAS or a Mac; any future web
  surface gets React Native's web output rather than a native web
  stack.
- **Revisit when:** live multi-device sync becomes a real user need
  (ADR-0002 follow-up); if the LLM recommendation path (ADR-0006)
  requires a backend, add a thin TypeScript service rather than
  widening the stack.

## Action items

1. [ ] Scaffold Expo + TypeScript app (Expo Router, EAS configured).
2. [ ] Add `expo-sqlite` + Drizzle; prove a migration runs on device.
3. [ ] Spike the Skia bubble chart: 16 animated bubbles with
       importance/satisfaction axes, before any other UI.
4. [ ] Create the pure-TS `scoring` package skeleton (blocked on
       ADR-0003 for the formula).
5. [ ] Resolve ADR-0002 (data model) next — it now has its platform
       answer.
