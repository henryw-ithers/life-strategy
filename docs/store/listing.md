# App Store listing

What goes into App Store Connect for Life Strategy, drafted
2026-10-26. Paste each field as it is; the limits are App Store
Connect's own. The runbook for builds and TestFlight is
[release.md](../release.md).

## App information

| Field | Value |
|---|---|
| Name (30) | Life Strategy |
| Subtitle (30) | Plan your week around life |
| Bundle ID | `com.glidelifestrategy.app` |
| Primary category | Productivity |
| Secondary category | Lifestyle |
| Age rating | 4+ (answer "None" to every content question) |
| Price | Free |
| Privacy policy URL | https://github.com/henryw-ithers/life-strategy/blob/main/docs/privacy.md |
| Support URL | https://github.com/henryw-ithers/life-strategy/blob/main/docs/support.md |
| Copyright | 2026 Henry Withers |

"Life Strategy" must be confirmed free in App Store Connect
([release.md](../release.md), Identity). If it's taken, add a short
suffix to the name only; the home-screen label stays "Strategy".

## Promotional text (170)

> Sort what matters into tiers and get a calm daily checklist that
> fits around your classes, shifts and commitments. A score that's a
> guide, never a judge.

## Description (4000)

> Most planners start with a to-do list. Life Strategy starts with your
> life.
>
> Sort the 18 parts of your life, from sleep and exercise to friendship
> and finances, into four tiers: Top, Important, Background and Not
> now. Your tiers decide what each part is worth, so the things you
> care about most come first, without setting a single priority by
> hand.
>
> A DAY IN ITS PARTS
> • Today lays your tasks out in the morning, afternoon and evening,
>   with events at their times. Hold any task to move it.
> • Add classes, shifts and appointments as events, once or every week.
> • Commitments like School or Work get their own share of the day,
>   sized from the time they actually take.
> • Not today sets a task aside; work from other days waits under Not
>   on today, ready to add.
>
> A SCORE THAT'S A GUIDE, NOT A JUDGE
> • Each day is scored out of 100 for how much of its plan you got
>   through.
> • Do Friday's run on Tuesday and it still counts. Nothing is ever
>   owed, and a missed day is never held against you.
> • A day that asks nothing is a rest day.
>
> SEE WHERE YOUR TIME WENT
> • Life shows each part of your life's share of the work you did in
>   the last four weeks.
> • Achievements are earned from what you do, Bronze to Diamond.
>   Nothing to set up, and nothing earned is ever taken back.
> • Log keeps your notes, photos and days worth remembering.
>
> PRIVATE BY DESIGN
> • No account, no server, no ads, no tracking.
> • Everything stays on your phone. Back it up to a file whenever you
>   like.
> • Your scores are yours alone: no leaderboards, no comparisons.

## Keywords (100)

    planner,habits,routine,checklist,schedule,priorities,life balance,daily plan,focus,tiers

(88 characters. Apple adds the name and subtitle on its own, so
they're not repeated here.)

## What's New (version 1.5.0)

> The first public version of Life Strategy.

## Privacy nutrition label

App Store Connect → App Privacy → Get Started:

- **Do you or your third-party partners collect data from this app?**
  **No, we do not collect data from this app.**

That gives the label **"Data Not Collected"**. It's true because:

- the app has no account, no server, no analytics and no third-party
  SDK that sends anything ([privacy.md](../privacy.md));
- feedback and the problem log leave the phone only when the person
  sends them from their own mail app or share sheet, which Apple
  doesn't count as collection by the app;
- reminders are local notifications, with no push server.

Revisit the label if anything ever sends data on its own.

## Screenshots

Required: **6.9"** (iPhone 16 Pro Max, 1320 × 2868) and **6.5"**
(1284 × 2778 or 1242 × 2688). Up to ten each; five is plenty. Take
them on a simulator or the phone with a believable week, light mode:

1. Today: the day in its parts, a few ticked, the score.
2. Life: the four tiers, one unit opened to its tasks.
3. A commitment (School) with its events.
4. Achievements: a few earned shields.
5. Log: a month with notes and a photo.

## App Review notes

> Life Strategy needs no account or sign-in. All data stays on the
> device. After the short opening pages the app starts empty. To see
> a plan: on Life, tap the ≡ on a few units and choose Move to Top or
> Important; open one and use Add task; then tick it on Today and the
> day's score updates. Notifications are optional, local reminders.
> The app contains no encryption of its own
> (usesNonExemptEncryption is false).

Contact: henrywithersfeedback@gmail.com

## TestFlight

**Beta App Description**

> Life Strategy turns what matters to you into a daily checklist. Sort
> your life into tiers, add tasks and events, and tick off your day in
> its parts.

**What to Test**

> Thanks for testing! Please try:
> • Sorting your units into tiers on Life, and adding a few tasks.
> • A commitment (School, Work) with its events, one-time or weekly.
> • Today: ticking, Not today, moving a task between parts of the day.
> • Leaving the app open overnight: next morning should be a new day.
> • Editing or deleting anything you can see.
> Settings → Send feedback reaches me directly, and Settings → Problem
> log → Send log helps if something breaks.

**Feedback email:** henrywithersfeedback@gmail.com
