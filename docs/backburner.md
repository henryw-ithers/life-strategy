# Backburner

Ideas deliberately parked — recorded so they aren't lost, with the
concerns that parked them.

## Rosy retrospection: softening past scores

*Parked 2026-07-15.*

**The idea:** over time, slightly boost past scores at random —
mirroring how human memory genuinely works (rosy retrospection /
fading affect bias). A hard month, viewed from a year away, shouldn't
sting the way it did in the moment.

**Why it's parked, not rejected:** the insight is good; the mechanism
as stated has problems worth solving first:

- **It corrupts the calibration experiment.** ADR-0008 needs true
  grades to correlate against felt contentment; silently inflated
  grades poison the ground truth.
- **It breaks reproducible history**, the principle the entire data
  model (ADR-0002) is built on.
- **It risks all trust in the log.** If a user notices numbers
  drifting upward, every number becomes suspect — and the "log of your
  life" is only valuable while the log is true.

**The likely honest version (presentation-layer kindness):** keep
stored grades true; render distance softly. Older periods display as
coarser, kinder summaries ("a solid week" instead of "71"); zoomed-out
views foreground trends, bests, and special days rather than
individual low numbers; year-in-review reads like memory does, not
like an audit. Same emotional effect, no falsified data. Partially
adopted already in vision.md ("Scores are guidelines, not judgments");
the fuller treatment (grade "fading" into display bands with age)
stays here until the core loop ships.

## Streaks

*Raised 2026-07-26.*

**The idea:** a streak mechanic — consecutive days of completing the
daily checklist — as a motivational surface.

**Status: already half-decided, in the permissive direction.** This
is less parked than it looks. ADR-0004 §5 explicitly allows it:
"Consistency is *shown*, not *enforced*: streaks, variance, and
best/worst days are separate statistics that never bend the grade."
ADR-0004 §3 goes further and already presumes streaks exist as a
concept — rest days are defined as "no grade, no penalty, **no streak
break**." The invariant in AGENTS.md prohibits "streak guilt," not
streaks.

**So the live question is presentation, not existence.** The line the
existing decisions draw:

- **Allowed:** a streak counted and displayed as one statistic among
  several (variance, bests), sitting in the strategy/stats layer.
- **Not allowed:** the streak affecting the grade (§5 — the grade is
  purely additive, and this would be a formula-version change, not a
  UI addition); alarm colors or mourning copy on a break; anything
  that makes the number feel like it can be *lost* rather than
  *observed*. That's the loss-aversion mechanic PRODUCT.md names as
  an anti-reference, and vision.md's "no streak guilt."

**The design risk worth naming before building it:** a streak is the
single most load-bearing shame surface in habit apps, and its
emotional weight comes almost entirely from the break, not the count.
A streak that genuinely never punishes may also not motivate — at
which point it's decoration. Worth deciding what it's *for* before
adding it. The gentler framings already available: "best month so
far," "days logged this month," or consistency as a shape (the month
grid already tints days) rather than a fragile integer.

**Prerequisite:** rest days must not break it (already specified) and
neither should days outside the edit window that were simply never
opened — see the aggregation gap noted 2026-07-26, where untouched
days currently vanish rather than counting as zero.

## Screen-time limits with negative scoring

*Parked 2026-07-26.*

**The idea:** track device screen time, let the user set their own
limits, and dock points from the daily grade when a limit is broken.

**Why it's parked, not rejected:** the underlying goal — making a
real behavioural constraint count for something — is legitimate, and
the taxonomy already has somewhere to put it (ADR-0003's worked
example uses "Online entertainment" as an SLU). The stated mechanism
hits four walls:

- **Negative scoring contradicts ADR-0004 §5.** The grade is "purely
  additive… no floors, curves, or weighting tricks anywhere."
  Subtracting points is not a UI addition; it is a formula-version
  change, and the ADR says so explicitly.
- **A penalty is a loss-aversion mechanic** — the exact pattern
  PRODUCT.md lists as an anti-reference and AGENTS.md lists as an
  invariant. Points you can *lose* behave differently from points you
  haven't *earned yet*, even when the arithmetic is identical.
- **iOS makes it close to impossible.** Screen Time data lives behind
  FamilyControls / DeviceActivity / ManagedSettings, which need the
  Family Controls entitlement (an Apple approval process), and the
  usage data is rendered inside a sandboxed report extension — the
  host app cannot read raw numbers out of it. Android is far more
  permissive (`UsageStatsManager` + the `PACKAGE_USAGE_STATS`
  special-access grant), so this would be a lopsided feature at best.
- **It ends the Expo Go workflow.** No part of this runs in Expo Go;
  it needs a config plugin and a development build. The SDK 54 pin
  exists precisely because the test iPhone's Expo Go caps there
  (ADR-0001, apps/mobile/AGENTS.md). This feature would force that
  decision open.

There is also a softer objection: every input in the app today is
self-reported. Passive device surveillance is a different
relationship with the user, and worth choosing deliberately rather
than arriving at via a feature.

**The likely honest version (invert the sign):** staying under a
self-set limit becomes a *task* under its SLU — completed, earning
its rank-derived points like any other task, on the additive model
that already exists. Same behavioural target, no penalty, no formula
change, and it works today with manual self-report and zero platform
APIs. If manual reporting proves unreliable in real use, *that* is
the trigger to open an ADR for automated measurement (Android first,
iOS as a known-degraded case) — and the ADR would then be about the
data source only, since the scoring question would already be
settled.

## Wrapped-style monthly and yearly recaps

*Raised 2026-07-26.*

**The idea:** a Spotify-Wrapped-style recap — a designed, celebratory
retrospective of the month or year, rather than a table of numbers.

**Status: aligned with existing direction, blocked on
infrastructure.** This is the most compatible of the three. Design
principle #5 ("the log is a record of a life") and vision.md's
long-term framing both point here, and the rosy-retrospection entry
above already sketched the same instinct: "year-in-review reads like
memory does, not like an audit."

**What it needs first** — none of it exists yet:

- A look-back / history surface at all. `journal_entry`, `photo`, and
  `achievement` rows are currently written and never read back
  outside the day they belong to.
- The monthly review ritual (ADR-0002 decision 5), still unbuilt —
  `loadMonthGrade` has no caller.
- Memory flags and special days to have accumulated enough history to
  have something to resurface. A recap over six weeks of data is a
  thin experience; this wants a year.

**Constraints to carry into the design:**

- ADR-0008: celebration may condition on **positive events only**.
  A recap must not surface "your worst month" or lead with a low
  number — and it has to read identically well after a bad year, which
  is the hard part of the brief.
- The backburner entry above applies directly: render distance
  softly, but never falsify the stored numbers.
- PRODUCT.md excludes social comparison by design. Wrapped's actual
  engine is shareability and implicit ranking against other people;
  strip that and what remains is a personal retrospective — which is
  the thing worth building, but it is a genuinely different artifact
  from its reference. Worth being clear that only the *form* is being
  borrowed.
