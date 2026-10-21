# ADR-0047: Achievements replace goals

> **Status:** Accepted (Henry, 2026-10-21)\
> **Date:** 2026-10-21

## Context

ADR-0042 narrowed goals to four shapes the app can count: times done,
time spent, points earned and a streak. That made every goal a target
on a number the app already tracks. Setting one up still took a sheet,
a template, a choice of tasks and an end month, which is planning work
for a reward the app could work out on its own.

Henry, 2026-10-21: replace goals with achievements the app defines and
awards itself, so "the user doesn't have to do anything". Rank them
(bronze, silver, gold), give units badges and streak icons, and use
them to celebrate wins and keep people coming back. His calls on the
questions this raised:

- Achievements may count **weeks a plan was met**: a task's weekly
  target, or every task in a unit, both **in total and in a row**.
- **Daily score** achievements are fine: "if you don't care about the
  achievements you don't need to look at them".
- The Achievements screen shows the **full list, locked ones
  included**.
- The goals work in progress (PR #30) is closed; goals are replaced,
  not shipped.
- Accepting this ADR (2026-10-21): **locked achievements show their
  progress, runs included**: "failure is a part of any journey and it
  shouldn't be something to hide or avoid. We don't need to bring it
  up". And **the peaks go high**, to 1,000, "so that getting that top
  rank is a really impressive achievement and something someone can
  work towards and be proud of".

The goal tables from Phase 5c (`goal`, `goal_task`, `goal_entry`) are
merged, with no screen that writes them, and there are no users yet
(2026-10-19), so nothing needs to be kept.

### What other products do (researched 2026-10-21)

- **Ranked tiers are the convention.** PlayStation's trophies are
  bronze, silver, gold and platinum, weighted unevenly (15, 30, 90 and
  180 points). Bronze is for first steps, silver for steady effort and
  gold for the long haul, and newer games give more of the harder
  tiers ([arXiv 2205.15163](https://ar5iv.labs.arxiv.org/html/2205.15163),
  [ChangeCrab](https://changecrab.com/knowledge-base/badges/badge-tiers-explained)).
- **Shape says what kind of award it is.** Apple Fitness draws records
  as circles, streaks and challenges as hexagons, and goal-multiples
  as banners. Locked awards show as grey outlines that explain their
  requirement when tapped, and long-run milestones (1,000 Move goals)
  sit beside monthly ones
  ([Macworld](https://www.macworld.com/article/672553/how-to-get-every-apple-watch-activity-achievement-badge.html),
  [Apple Magazine](https://applemagazine.com/apple-introduces-interesting-all-rings-closed-awards/amp/)).
- **Losing a streak drives people away.** Duolingo's streak, its
  freezes and its warnings are the common example. Critics describe
  users quitting after losing a long streak, and people doing the
  activity to keep the number alive rather than for its own sake
  ([The Decision Lab](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification),
  [UX Collective](https://uxdesign.cc/gamification-wont-solve-your-user-experience-problems-c0dd4c53b3b3),
  [PCWorld](https://www.pcworld.com/article/2924235/why-i-fell-out-of-love-with-duolingo.html)).
- **Gentle apps don't punish a lapse.** Finch rewards progress and
  attaches no penalty to missed days. Its rewards are cosmetic, and a
  streak can be paused
  ([Yoga Journal](https://www.yogajournal.com/lifestyle/finch-self-care-app?scope=anon),
  [AvanceCare](https://www.avancecare.com/turning-self-care-into-a-game-to-help-you-build-healthier-habits/)).
- **Badges help some people and not others.** A field experiment found
  that badges raised activity mainly among people who followed their
  own collection. Simply having the badges in the app did little for
  everyone else
  ([University of Turku](https://research.utu.fi/converis/portal/detail/Publication/27336812?lang=en_US),
  [gamification-research.org](https://gamification-research.org/2013/05/1-5-year-experiment-on-gamification-surprising-results/)).
  That supports keeping achievements in a place you visit, not pushed
  onto the day. The overjustification effect, where a reward displaces
  the reason someone did the thing, is shown for cash rather than
  badges
  ([University of Minnesota](https://conservancy.umn.edu/items/be654731-f891-47e3-b52c-b0d870fb86a7)).
- **Achievements can bend play.** The Xbox Live community study found
  that some achievements improved a game and others got in its way.
  The examples are Geometry Wars' Pacifism, which helped, and Turok's
  achievement for killing a teammate, which hurt
  ([GDC Vault](https://gdcvault.com/play/1013706/Achievement-Design-Lessons-From-an)).
  An achievement should reward what the app already wants done, never
  something odd to chase.

## Open questions

1. What do achievements count, and how are they ranked?
2. Which current rules do the plan-week and score achievements change,
   and what keeps them kind?
3. How are runs shown, given the streak copy rules?
4. When is an achievement awarded, and can it be taken back?
5. Where do achievements show, and what happens to goals?

## Options considered

- **Keep goals (ADR-0042) and add achievements beside them.** Two
  systems that count the same numbers, one of them needing setup. Not
  chosen.
- **Achievements that count only what was done** (completions, hours,
  every-day streaks), with no plan-week or score achievements. This
  needs no change to an invariant, but Henry chose to include both.
- **App-defined achievements with ranks, plan weeks and score
  included** (chosen), with the safeguards in the Decision.

## Decision

### 1. Goals go; the app defines every achievement

Goals are removed: the `goal`, `goal_task` and `goal_entry` tables and
their code. Nothing is copied (no users). You don't set anything up.
The app watches what you do and awards achievements from a fixed
catalogue. ADR-0042 is superseded.

### 2. Ranks

Each achievement is a **series** with five ranks: **Bronze, Silver,
Gold, Platinum, Diamond**. A series names what it counts and a
threshold for each rank, for example task completions 20, 50, 100, 250
and 1,000. Earning a rank keeps the lower ones. Ranks go up in steps
that get further apart, so the first comes soon and the top is a
genuine feat, years of steady work (Henry: peaks "all the way to
1000").

### 3. The catalogue

Every series counts something the app already records. Thresholds
below are a first pass, set in the engine.

| Series | Counts | For each | Ranks |
|---|---|---|---|
| **Completions** | Ticks of a task | task | 20 · 50 · 100 · 250 · 1,000 |
| **Unit completions** | Ticks of a unit's tasks | unit, and its area | 50 · 150 · 400 · 1,000 · 2,500 |
| **Hours** | A tick's size, or "Took about…" if entered | unit, commitment | 10 · 50 · 150 · 500 · 1,000 h |
| **Every-day streak** | Days in a row of an every-day task (the existing streak rules) | task | 7 · 30 · 100 · 365 · 1,000 |
| **Weekly target** | Weeks a task's weekly target was met | task | total 4 · 12 · 52 · 156 · 520; in a row 2 · 4 · 12 · 52 · 156 |
| **Whole unit** | Weeks every task in a unit met its weekly target | unit | total 4 · 12 · 52 · 156 · 520; in a row 2 · 4 · 12 · 52 · 156 |
| **Attended** | Events you ticked | commitment | 10 · 25 · 100 · 250 · 1,000 |
| **Good days** | Graded days at 80 or above | everything | 10 · 30 · 100 · 365 · 1,000 |
| **Great days** | Graded days at 90 or above, in total and in a row | everything | total 5 · 20 · 100 · 365 · 1,000; in a row 3 · 7 · 30 · 100 · 365 |
| **Record** | Activities logged, days flagged ☆ | everything | 10 · 50 · 150 · 500 · 1,000 |

Weeks peak lower than days, since a week is seven of them: 520 weeks
is ten years.

Never in the catalogue:

- anything derived from events **not** ticked, such as attending every
  lecture in a week (ADR-0038 §5 stands);
- anything compared with other people;
- anything that rewards working past the day's cap, so extra-run
  credit counts as ticks and nothing more.

### 4. Plan weeks and score: what changes, and what keeps it kind

This **amends the AGENTS.md invariant** that "no adherence rate,
streak, or plan-completion percentage is computed, stored, or
derivable" (ADR-0024 §2). The exception covers **achievements only**:

- A week counts when a task's weekly target was met, or every task in a
  unit met its target, by the week's end. Days off and Away days don't
  break a run.
- It is **never** a rate or a percentage, and never compares done with
  planned. There is no "missed weeks" count and no list of weeks that
  weren't met.
- It **never reaches the daily surface or the grade**. Home, Plan and
  the day's score don't change. A pinned day that lapses still lapses
  silently (ADR-0024 §2), and nothing compares a tick's date with the
  day it was pinned to.
- **A run ending is never mentioned** (copy guide). No streak freezes,
  no warnings, nothing to buy back.

Score achievements read **settled grades only**, from the stored
`day_grade` once a day has ended. A day off and an ungraded day are
neither good nor bad; they are skipped and never break a run.
Celebration may condition on positive events (ADR-0008), and
achievements condition on nothing else. No copy anywhere conditions on
a low grade or a low count.

### 5. Runs on screen

- A **current run** shows only while it's at least the series' first
  rank (7 days, or 2 weeks), as a small streak icon on the task or the
  unit. It disappears quietly when the run ends.
- A run's **earned ranks stay earned**. The Achievements screen shows
  them with when they were earned, and never puts a past best beside a
  shorter current run (copy guide).
- **Locked achievements** show their requirement and their progress:
  "Gold: 100 completions · 62 / 100", and for a run, the current run
  against the next rank. When a run ends its progress simply starts
  again, and nothing says so (Henry, 2026-10-21: failure is part of the
  journey, not something to hide, and not something to bring up).

### 6. When they're awarded

- Counted series (completions, hours, attended, record) are awarded as
  the tick lands.
- Every-day streaks and score series are awarded once the day ends.
- Plan-week series are awarded once the week ends (Saturday's
  rollover).
- **Nothing is ever taken back.** If a tick that earned one is undone,
  the achievement stays: it happened. Earning is a moment of
  celebration in the app (a haptic and a short card on the next open),
  never a notification about losing one.

### 7. Where they show

- **Life → Achievements**: the full list, grouped by unit (and area),
  commitments, and everything, with locked ones in grey outline.
  Shapes follow Apple's lead: a circle for counts, a hexagon for runs.
- **Unit badges**: each unit's row on Life and its screen show its
  highest rank earned, and a streak icon while a run is going.
- **The month review** (Log) lists what was earned that month.
- Private, as everything is. No sharing, no leaderboards, no rarity
  figures.

## Consequences

- **Easier.** Nothing to set up. Achievements are earned for what the
  app already counts, and goal setup, templates and screens go.
- **Harder.** One invariant gains an exception, so the plan-week and
  score series need the guard rails in §4, enforced by the invariant
  reviewer and by tests that look for rate or percentage copy.
- **Revisit** the thresholds after real use. They're in the engine, so
  changing them is a code change, not a migration: an earned rank is
  stored by name and rank, and stays.
- **Supersedes** ADR-0042. **Amends** ADR-0007 (goal lifecycle;
  achievements are no longer made by finishing a goal), ADR-0015 (goal
  metrics), ADR-0024 §2 (the exception in §4), ADR-0006 (goal library)
  and spec §5.6.

## Action items

1. [x] Henry accepts this ADR (2026-10-21), with progress shown on
       locked runs and peaks to 1,000.
2. [x] Amend AGENTS.md: the goal vocabulary, "Goals never grade a day"
       (which becomes the same rule for achievements), and the §4
       exception to the plan-completion invariant.
3. [ ] Engine: `achievements.ts`, pure, holding the catalogue and the
       rule for what a set of facts has earned, with tests, including
       the guard rails in §4.
4. [ ] Data: drop the goal tables; reshape `achievement` (series, rank,
       subject, earned on); award on tick, at day end and at week end.
       Generated, forward-only migrations.
5. [ ] Screens: Life → Achievements, unit badges and streak icons, the
       earning card, the month review list. Remove the goal code.
6. [ ] Update the spec (§5.4, §5.6) and the build tracker.
