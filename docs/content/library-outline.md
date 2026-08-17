# The content library — what needs writing

The writing brief for [ADR-0006](../adr/0006-task-and-goal-recommendations.md),
whose action item 2 is the largest unwritten thing in the product.
ADR-0006 §4 makes this a **launch deliverable with the same weight as
code** — v1 does not ship until the bar in §3 below is met.

**Write it in [library.md](library.md)**, which is the source of truth —
`npm run content:build` turns it into typed data, validates it, and
prints what is still short of the bar. Companion doc:
[inventory.md](inventory.md) maps every string the app displays.

## 1. What the package is

A hand-curated set of goal and task suggestions that ships **inside the
app** — no network, no per-user cost, no diagnostic data leaving the
device. After the first diagnostic the app drafts a complete starter
plan from it; nothing is created until the user accepts.

It also carries the activity keyword map (ADR-0009) and, since
ADR-0025 §13, a short editorial note for seven units.

## 2. The editorial rules

Condensed from ADR-0006 §1 and the header of
`apps/mobile/src/content/units.ts`, which is the register to match —
read a few entries there before writing anything new.

- **Direct, factual, concise.** Write like a person: short sentences,
  few dashes, no tidy parallel constructions.
- **Descriptions carry the weight.** What the unit is and why it
  matters, plainly.
- **Guidelines exist to help someone judge their own satisfaction
  rating**, and their philosophy is **balance**.
- **Specificity matches measurability.** Sleep really is 7–9 hours.
  Relational and subjective units get broad functional dimensions —
  novelty, real time, reciprocity, room for the rest of your life —
  never one shape of success. Felt experience can rightly override the
  standard picture.
- **Evidence where it earns its place.** A line may stand alone where
  it speaks for itself.
- **No prescriptions, no pampering, no shame framing, no "you should."**
  Gentleness lives in what is omitted, not in softeners.
- **Sensitive units carry no clinical, therapeutic, or theological
  advice** — Mental & emotional health, Spirituality, Significant
  other. Every entry gets a hand-review pass.
- **The ambient-kindness test** (ADR-0008): every line must read
  identically well on a good week and a bad one. If it would land
  differently, rewrite it.

## 3. The launch bar, and how much is left

ADR-0006 §4 set the bar at *every one of the 18 units has ≥3 goal
templates and ≥6 tasks, across all three profile tags*.

> **Amended by ADR-0025 §5:** the library **never proposes a task for a
> communal unit** — Significant other, Family, Friendship. Those three
> are served by tagging, not by a checklist. They still get **goals**
> (ADR-0025 §11 leaves goals unrestricted everywhere), and a goal there
> simply carries no tasks.
>
> So the task bar covers **15 units, not 18**. That is roughly 20 fewer
> entries than ADR-0006 anticipated.

| Piece | Bar | Count | Status |
|---|---|---|---|
| Unit descriptions | 18 | 18 | ✅ done — `content/units.ts` |
| Unit guidelines | 18 sets | 18 | ✅ done — `content/units.ts` |
| Activity keyword map | common activities | 18 units seeded | ✅ done — `content/tagKeywords.ts`, extend as gaps appear |
| **Goal templates** | ≥3 per unit × 18 | **54–90** | ❌ none written |
| **Tasks** | ≥6 per unit × 15 | **90–150** | ❌ none written |
| Editorial notes (ADR-0025 §13) | 7 units | 7 | ✅ done — [units.md](units.md), under `### Note` |

## 4. The shape of an entry

ADR-0006 action item 1 asked for the package schema. **This is it, and
it is built** — the types below are generated into
`apps/mobile/src/content/library.ts` from [library.md](library.md),
whose header documents the markdown fields that map onto them.

```ts
type Profile = "gap-closing" | "maintenance" | "light";

interface GoalTemplate {
  id: string;              // stable slug, e.g. "run-5k"
  title: string;           // "Run 5k without stopping"
  description?: string;    // one line: what finishing looks like
  profiles: Profile[];     // which situations this suits
  milestones?: string[];   // ordered rung titles
  metric?: {               // optional, ADR-0015
    kind: "cumulative" | "target";
    unit: string;          // "books", "lb", "sessions"
    suggestedTarget?: number;
  };
}

interface TaskTemplate {
  id: string;
  title: string;           // "Strength training session"
  description?: string;    // the self-contract: what counts as done
  timesPerWeek: number;    // 0 = fortnightly, 1–7
  profiles: Profile[];
  defaultRank: number;     // order within the unit (ADR-0006 §2)
  goalId?: string;         // if it serves a goal template
}
```

**Profile tags** decide when a suggestion surfaces:

| Tag | Means | Typical shape |
|---|---|---|
| `gap-closing` | Priority well above satisfaction — the user said this needs attention | More ambitious, higher cadence |
| `maintenance` | Satisfied *and* important — protect what works | Steady, low-friction upkeep |
| `light` | Low weight — shouldn't nag | Weekly cadence, one small thing |

Every unit needs coverage across **all three**, because the same unit
looks different to different people. A unit with only gap-closing goals
has nothing to offer someone whose life is already going well there.

**`defaultRank`** matters: proposed tasks arrive pre-ranked so
onboarding needs no pairwise comparisons (ADR-0006 §2). Rank 1 is the
task you would keep if you could only keep one.

**Metric hints are new** — ADR-0015 postdates ADR-0006, so the library
can now suggest "read 24 books this year" as a cumulative goal or
"bench 225 lb" as a target reading with milestones. Use them where the
goal is genuinely countable; leave `metric` off where it isn't.

## 5. The per-unit worksheet

15 units need goals **and** tasks. 3 need goals only. Sensitive units
are marked ⚠ and need the extra review pass.

| # | Unit | Area | Goals | Tasks | Notes |
|---|---|---|---|---|---|
| 1 | Significant other ⚠ | Relationships | 3–5 | — | Communal. No clinical or relationship-counselling advice. |
| 2 | Family | Relationships | 3–5 | — | Communal. |
| 3 | Friendship | Relationships | 3–5 | — | Communal. |
| 4 | Exercise & fitness | Physical health | 3–5 | 6–10 | Most measurable unit; metric goals fit well. |
| 5 | Nutrition | Physical health | 3–5 | 6–10 | Avoid diet prescription; no calorie targets. |
| 6 | Sleep & recovery | Physical health | 3–5 | 6–10 | 7–9 hours is the honest benchmark. |
| 7 | Mental & emotional health ⚠ | Mental wellbeing | 3–5 | 6–10 | **No therapeutic advice.** Support resources live in Settings, unconditionally. |
| 8 | Spirituality ⚠ | Mental wellbeing | 3–5 | 6–10 | **No theological content.** Inclusive framing — "in touch with reality beyond the everyday," whatever one's beliefs. |
| 9 | Giving & service | Mental wellbeing | 3–5 | 6–10 | Instrumental per ADR-0025 §1 — standing commitments are legitimate tasks. |
| 10 | Job/career | Work & money | 3–5 | 6–10 | |
| 11 | Learning & growth | Work & money | 3–5 | 6–10 | Books, courses — good metric-goal territory. |
| 12 | Finances | Work & money | 3–5 | 6–10 | **No investment advice.** Habits and admin only. |
| 13 | Living space | Wellness | 3–5 | 6–10 | Maintenance area — low-effort, high-return. |
| 14 | Nature | Wellness | 3–5 | 6–10 | Instrumental per ADR-0025 §1. |
| 15 | Hygiene | Wellness | 3–5 | 6–10 | The clearest upkeep unit; keep it unfussy. |
| 16 | Hobbies & projects | Leisure & creativity | 3–5 | 6–10 | |
| 17 | Art & media | Leisure & creativity | 3–5 | 6–10 | |
| 18 | Adventure & experiences | Leisure & creativity | 3–5 | 6–10 | Often date-anchored; trips are legitimate one-off placements. |

Unit ids are the slugs in `apps/mobile/src/db/taxonomy.ts` — use them
verbatim as keys.

## 6. The seven editorial notes (ADR-0025 §13) — **written**

**Done 2026-08-16.** All seven are in [units.md](units.md) under a
`### Note` heading, and render last in the unit info sheet in a quieter
block than the guidelines. The brief below is kept because it is the
standard to edit them against, and the rules now also live in
[copy-guide.md](../design/copy-guide.md).

Short notes for the unit info sheet, explaining the app's own thinking.
Both halves of each tension, because the tension is the content.

**The three communal units** — Significant other, Family, Friendship.
One note, or three variations. The idea: the app doesn't suggest tasks
here and doesn't ask you to tick relationships off. Keeping score of
what you put *into* a relationship is what exchange relationships do,
so the app records who you were with instead. Do not explain the
research; state the app's behaviour and why, in two or three sentences.

**The four intrinsic units** — Spirituality, Hobbies & projects, Art &
media, Adventure & experiences. That these are worth making time for
*and* worth not letting become a chore. Both halves. The failure modes
are opposite and both real: never getting round to it, and turning it
into homework.

This is the hardest writing in the package. It has to convey a real
tension without becoming an instruction about how to live.

## 7. Order I'd suggest

1. **Three units end to end first** — one gap-closing-heavy, one
   maintenance-heavy, one communal. That surfaces schema problems while
   they are cheap to fix, and gives the starter-plan generator
   something real to run against.
2. **The rest of the goals** (18 units), which are the shorter half.
3. **The tasks** (15 units), the bulk of the work.
4. **The seven notes**, last — they will read better once you have
   spent time in the register.

## 8. Where this connects

- **ADR-0019 action item 5** wants the schema to express **default
  multi-unit memberships** for recommended tasks — a suggested "walk
  with a friend" could ship tagged to Exercise and Friendship. Not in
  the schema above; add `units?: string[]` when that item is picked up.
- **ADR-0003 §6's recommended task counts** per weight band decide how
  many of these the starter plan actually proposes. Writing more than
  the bar is not wasted; it widens the draw.
- **ADR-0011 onboarding** shows the starter plan. Content quality is
  the first-run experience.
- **ADR-0017** (LLM personalization, reserved) has as its trigger *"the
  curated library starts feeling generic."* Writing this well is what
  keeps that ADR closed.
