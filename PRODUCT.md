# Product

## Register

product

## Platform

adaptive

## Users

Henry first: the app is designed around its builder's own daily use.
That means a reflective person who wants a reason behind their
checklist, opens the app briefly each morning and evening, and sits
down once a month for a longer review. It is also built to share, so
every decision should hold up for people who liked Strack's HBR
article, journaling apps or habit trackers but wanted the "why" those
tools leave out. When real use and imagined users disagree, real use
wins.

The app has its own design language and should feel like itself
rather than like a system app. It targets iOS only
([ADR-0020](docs/adr/0020-backup-cryptography-and-export-exemption.md)).

## Product Purpose

A personal planning and reflection app. A monthly diagnostic (a
priority ranking and a satisfaction rating for each of 18 life units)
becomes a daily checklist and a grade out of 100. The daily part is a
checklist and a number; the monthly part is a review (diagnostic,
portfolio graph, goals); and over time the record reads as a log of a
life, with journals, photos and flagged memories beside the grades.

Long-term success: the daily grade comes to match how content the user
actually felt (the calibration experiment). Success for version 1:
Henry uses it every day without friction or resentment.

## Positioning

Habit apps start with tasks. This one starts with what matters, and the
checklist follows from it. In one line: line up daily action with what
matters most.

## Brand Personality

Clear, confident, encouraging. A coach with a clipboard: crisp
hierarchy, decisive colour, satisfying check-offs. Warmth comes from
celebration (completed goals, special days, memories resurfacing), not
from softness or decoration. Copy is direct and kind. It never nags or
guilt-trips, and it presents every score as a guideline.

## Anti-references

- Project-management software: Jira- or Notion-style density, nested
  settings, dashboard sprawl. The daily screen is a checklist, not a
  workspace.
- Streak-shame gamification: Habitica-style punishments,
  Duolingo-style nagging mascots, alarm colours on missed days,
  loss-aversion tricks.
- SaaS dashboard styling: hero metrics with gradient accents, grids of
  identical stat cards.
- Social comparison: leaderboards, shared scores, anything competitive.

## Design Principles

1. **Strategy before execution.** The diagnostic comes first, and every
   task exists because the user said its unit matters.
2. **Daily simplicity.** By default the daily screen is a checklist and
   a number that can be opened, used and closed in under a minute.
3. **Gentle by design.** Low grades are shown neutrally. Scores are
   guidelines and the app says so. Nothing is designed to shame.
4. **A tool, not a taskmaster.** Using part of the app is a valid way to
   use it, and coming back after time away never brings guilt.
5. **The log is a record of a life.** Over time, memories (journals,
   photos, special days, achievements) come before metrics in what the
   app shows again.
6. **Granularity is the user's.** The app supports planning a day to the
   minute and not planning it at all, and neither is the lesser use. The
   defaults sit at the light end (`anytime` is a full option,
   part-of-day is the default, and nothing requires a time), and more
   precision is always available but never required
   ([ADR-0036](docs/adr/0036-granularity-is-the-users.md)). This is why
   principle 2 describes the default, not a limit.

## Accessibility & Inclusion

WCAG AA contrast throughout; full Dynamic Type support; reduced-motion
alternatives for the portfolio graph animations and celebrations; and
screen-reader labels on every interactive element, including the Skia
charts, whose data is also available as text.
