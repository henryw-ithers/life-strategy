# Content inventory — every string, and where to edit it

A map of all written content in the app: what it is, where it is
edited, and where the user sees it. Written so a copy edit starts with
a lookup rather than a grep.

Companion doc: [library-outline.md](library-outline.md) is the writing
brief for the content that does not exist yet.

**The rules that apply to every string here** live in
[copy-guide.md](../design/copy-guide.md) — chiefly the ambient-kindness
test: *any line must read identically well on a good week and a bad
one.* If it would land differently, rewrite it.

---

## 1. The content pipeline — edit the markdown, not the code

Four docs in this folder are the **source of truth**. Editing one and
running the build regenerates its TypeScript counterpart, which carries
a DO-NOT-EDIT banner and is overwritten on every build.

```bash
npm run content:build
```

| Edit this | Generates | Shown in | Decided by |
|---|---|---|---|
| **[units.md](units.md)** — 18 descriptions & guidelines | `src/content/units.ts` | `UnitInfoSheet` — from the diagnostic, Plan, and anywhere a unit is rated | ADR-0006 §1 |
| **[library.md](library.md)** — goal & task templates | `src/content/library.ts` | The starter plan and per-unit suggestions | ADR-0006 §1–2 |
| **[notifications.md](notifications.md)** — the nudge pool | `src/content/notificationCopy.ts` | The one daily notification | ADR-0010 §3 |
| **[keywords.md](keywords.md)** — activity keyword map | `src/content/tagKeywords.ts` | Tag suggestions in `ActivitySheet` | ADR-0009 §1 |

The generated files are **committed**, because Metro has no build step
to hang codegen off and a bundler shelling out to a parser is a worse
trade than a file in git. `npm test` runs `content:check` first, so the
two halves cannot drift silently — that is the failure mode every
codegen setup dies of.

`content:build` also reports progress against ADR-0006 §4's launch bar
and refuses to generate a task under a communal unit (ADR-0025 §5).

### Still hand-written

| Content | File | Why it isn't generated |
|---|---|---|
| **Area & unit names** (6 + 18) | `src/db/taxonomy.ts` | Structure, not content — ids are load-bearing and the seed sync reads them at launch |

⚠️ **`taxonomy.ts` ids are load-bearing and names are not.** Renaming a
unit is a label change and safe. Changing an **id** orphans every
rating, weight, task, and snapshot that references it — *and* silently
detaches its entry in every doc above, since those are keyed by id.
Units that continue a life dimension keep their id across revisions,
which is why Wellness still carries the `home-environment` id.

---

## 2. Copy specified in the copy guide

Written down as decisions in [copy-guide.md](../design/copy-guide.md),
implemented inline in the files named. Edit **both** — the guide is the
record, the file is the behaviour.

| Content | Guide section | Implemented in |
|---|---|---|
| Daily nudge pool | Daily nudge pool | **[notifications.md](notifications.md)** → generated |
| Check-in prompt | Calibration copy | `src/app/calibration.tsx` |
| Calibration cold-start line | Calibration copy | `src/app/calibration.tsx` |
| Insight lines (higher / lower / aligned) | Calibration copy | `src/app/calibration.tsx` |
| Suggestion copy + Accept/Dismiss | Calibration copy | `src/app/calibration.tsx` |
| Support resources block | Support Resources | `src/app/(tabs)/settings.tsx` |

---

## 3. Inline screen copy

Everything else is written inline in the screen that shows it. This
table is the navigation aid; the strings themselves live in the files.

### Daily surface

| Screen | File | Copy it holds |
|---|---|---|
| Today / checklist | `src/app/(tabs)/index.tsx` | Section headings ("Done this week", "Completed"), empty states ("Run the diagnostic", "Plan your tasks"), day-record copy ("Today's notes", "From this day"), press-and-hold hints, accessibility labels |
| Activity sheet | `src/components/today/ActivitySheet.tsx` | "Log an activity", size prompt ("How significant was it?"), day-off and special-day credit explanations, delete confirmation |
| Day kind sheet | `src/components/today/DayKindSheet.tsx` | The three day-kind explanations, "Day satisfaction", "What made it special?" |
| Note sheet | `src/components/today/NoteSheet.tsx` | Journal entry prompts |
| Week strip / month grid | `src/components/today/WeekStrip.tsx`, `MonthGrid.tsx` | Spoken date labels, grade announcements |

### Strategy surfaces

| Screen | File | Copy it holds |
|---|---|---|
| Diagnostic | `src/app/diagnostic.tsx` | Step headings ("Your priorities", "Your areas · Priority"), the area question, drag hints, discard confirmation |
| Plan | `src/app/(tabs)/plan.tsx` | Empty states, weight-change prompts, unit expand/collapse labels |
| Goals list & detail | `src/app/(tabs)/goals/index.tsx`, `[goalId].tsx` | Goal-load nudge, status labels, milestone copy |
| Goal modals | `src/components/goals/*.tsx` | Add, complete (three-path), revise, and **abandon** copy — the last is neutral by rule (ADR-0007 §1): "set aside," never "failed" |
| Portfolio graph | `src/components/portfolio-graph/*.tsx` | Legend, callout, mode control, scrubber labels |
| Calibration | `src/app/calibration.tsx` | See §2 |

### Setup & system

| Screen | File | Copy it holds |
|---|---|---|
| Onboarding | `src/app/onboarding.tsx` | Welcome screens |
| Notification pre-screen | `src/components/notifications/PermissionPrescreen.tsx` | The in-app ask before the OS prompt (ADR-0010 §4) |
| Settings | `src/app/(tabs)/settings.tsx` | Reminder controls, recompute explanation, replay-welcome, erase-data description, support resources |
| Erase data | `src/components/settings/EraseDataModal.tsx` | Destructive confirmation |
| Backup | `src/app/backup.tsx` | Passphrase, seal/open, restore copy |
| Feedback | `src/app/feedback.tsx` | Feedback form → `henrywithersfeedback@gmail.com` |
| Problem report | `src/app/problem.tsx` | Crash-log sharing (ADR-0013) |

**Accessibility labels are content too.** `accessibilityLabel` strings
are read aloud verbatim and are subject to the same rules — PRODUCT.md
commits to screen-reader labels on every interactive element, including
the Skia charts.

---

## 4. Not yet written

| Content | Amount | Write it in | Blocks |
|---|---|---|---|
| ~~Goal templates~~ | ~~54–90~~ | **done** — 71 in [library.md](library.md) | ADR-0006 |
| ~~Task templates~~ | ~~90–150~~ | **done** — 110 in [library.md](library.md) | ADR-0006 |
| ~~Editorial notes~~ | ~~7 units~~ | **done** — in [units.md](units.md) under `### Note`, shown in the unit info sheet | ADR-0025 §13 |
| Part-of-day section labels | 4 | ADR-0024 §3 | Checklist regroup |
| "· not scored" treatment | 1 | ADR-0025 §5 | Excluded-unit task rows |
| Progress & deadline copy | small set | ADR-0015 §§2–5 | Metric goals |
| Monthly review copy | unknown | ADR-0002 decision 5 | The review itself is unbuilt |

---

## 5. A known structural gap

**Screen copy is inline, and there is no single place to read the app's
voice.** §1's four files are genuinely centralised; §3 is thirty-odd
files with strings in them. That is normal for an app this size and it
is not obviously wrong — colocated copy is easier to keep accurate than
a distant strings table, and there is no localisation requirement
(iOS-only, English-only today).

But it means a tone pass across the whole app is a reading exercise
rather than a lookup, and the copy guide can drift from the code
without anything noticing.

Two cheaper mitigations before considering a strings file:

- **Extend the copy guide** as decisions are made, so the *rules* stay
  central even while the strings do not. This is what it is for and it
  is currently thin — three sections for an app with thirty screens.
- **Keep this inventory current.** A new screen adds a row.

Worth revisiting if localisation ever becomes real, which would force a
strings table regardless.
