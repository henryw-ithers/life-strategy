# ADR-0008: Contentment calibration and sensitive data

> **Status:** Accepted\
> **Date:** 2026-07-16\
> **Deciders:** Henry

## Context

The app's most experimental feature and its end-state success metric:
a grade that predicts the user's own felt contentment. Data sources:
the weekly check-in ("how content did you feel this week, 1–10?") and
special-day satisfaction ratings (ADR-0004). Constraints already in
force: everything computes on-device (ADR-0001/0002), stored grades
are never altered for emotional effect (vision.md, docs/backburner.md),
formula changes are versioned (ADR-0002/0003), and the app is
explicitly not a mental-health tool.

Guiding principle decided here: **kindness is ambient, never
targeted.** People can tell when software noticed their bad week;
being reacted to is often more painful than being left alone.

## Decisions

### 1. Mechanism: insight + suggestion, user confirms

- Calibration compares weekly grades against contentment check-ins
  over a rolling window (~12 weeks) using simple, explainable
  statistics (direction and size of the divergence, rank agreement) —
  no opaque models.
- **Cold start:** nothing is said until ≥ 8 contentment data points
  span ≥ 6 weeks. Until then the calibration screen shows a plain
  "still learning your rhythm" state.
- Findings surface in plain language — "your grades have been running
  higher than your weeks felt" — each paired with **one specific,
  previewable suggestion**: nudge `GAP_COEFFICIENT` (bumps
  `formula_version`), revisit a named unit's weight, or revisit a task
  lineup at the next monthly review. Every change applies only on an
  explicit yes.
- **Dismissed means dismissed.** A rejected suggestion is never
  re-surfaced. All insights and suggestions — pending, accepted,
  dismissed — live in a **Calibration section** the user can visit
  anytime; re-proposing only happens when the user asks from there.
  (Schema: a `calibration_suggestion` table — id, created_at, insight
  text, proposed_change, status `proposed|accepted|dismissed`,
  resolved_at — amends ADR-0002.)
- Levers calibration may touch: the gap coefficient, unit-weight
  suggestions, task/recommendation revisits, rest-day/special-day
  usage hints. Never: past grades, silent changes of any kind.

### 2. Low contentment: resources present, never pushed

- A **Support Resources section** exists permanently in the app
  (settings/profile area) — crisis lines, finding-support guidance —
  mentioned once, neutrally, during onboarding so the user knows it's
  there. It is **never surfaced reactively**, no matter what the data
  says. The user should know where it is; the app should never imply
  "you need this."
- **Encouragement is ambient and untargeted.** Warm copy appears with
  the same tone on good weeks and bad; nothing consoling is ever
  conditioned on low grades or low contentment, because conditioned
  comfort reads as surveillance. **Celebration may condition on
  positive events** (goal completed, special day logged) — being
  noticed at your best is welcome; being noticed at your worst is not.
- The "scores are guidelines" reassurance follows the same rule: it
  lives **persistently** where grades are displayed and in the monthly
  review — constant, not triggered.
- No diagnosis language anywhere, ever. The app measures contentment
  to calibrate itself, not to assess the user.

### 3. Check-in mechanics

- One question, weekly, two taps, **skippable indefinitely** — skipping
  is never nagged (a tool, not a taskmaster). Sparse data simply slows
  calibration; the Calibration section states this once, factually,
  where the user can see it, not as a push.
- Special-day satisfaction ratings (ADR-0004) join the dataset as
  bonus ground truth.

### 4. Privacy posture

- All calibration computation happens **on-device**. Contentment and
  diagnostic data never leave the phone except inside the client-side
  encrypted backup (ADR-0002), which the server cannot read.
- **Export and delete are absolute:** full JSON export of everything
  (grades, check-ins, journals, suggestions) and a full local wipe
  (plus deletion of backup ciphertext) available in settings.
- If LLM recommendations ever arrive (ADR-0006's deferred opt-in),
  contentment data is **excluded from any payload by default**,
  separately and explicitly.

## Consequences

- **Easier:** trust — the score never changes itself, dismissals
  stick, and comfort never feels like surveillance; the calibration
  loop has a clean home (one section, explainable stats, previewable
  changes); the privacy story stays one sentence long.
- **Harder:** ambient-not-targeted requires copy discipline
  everywhere (an A/B-style "we noticed you're struggling" feature can
  never ship); explainable statistics cap how clever calibration can
  get; dismissed-forever means a genuinely good suggestion can die to
  a misclick — mitigated by the Calibration section being browsable.
- **Revisit when:** enough real data exists to evaluate whether the
  simple statistics find true mismatches; if users never visit the
  Calibration section, findings may need a (still untargeted) monthly
  -review slot; the LLM opt-in ADR must re-confirm the contentment
  exclusion.

## Action items

1. [ ] Amend ADR-0002: add `calibration_suggestion`.
2. [ ] Implement divergence statistics + cold-start gating as pure
       functions in the `scoring` package.
3. [ ] Design the Calibration section (insights, suggestion states,
       re-propose affordance) and the Support Resources section.
4. [ ] Write the ambient-kindness copy rules into the app's copy
       guide (with AGENTS.md pointing at them).
