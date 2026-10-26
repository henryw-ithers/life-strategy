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

> Sort what matters into tiers, set the hours you're actually free,
> and get a calm daily plan that fits around your classes, shifts and
> commitments.

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
> PLAN AROUND THE TIME YOU REALLY HAVE
> • Set your working hours once, like a sleep schedule.
> • Add classes, shifts and appointments as events. They're taken out
>   of your hours, and what's left becomes the day's windows.
> • Each window fills itself with suggestions. Pin what you want to
>   keep; the rest adjusts as you go.
> • Commitments like School or Work get their own share of the day,
>   sized from the time they actually take.
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
> • A weekly plan takes about five minutes: look back, check what's
>   different, and pin the week ahead.
> • Forty achievements, earned from what you do, Bronze to Diamond.
>   Nothing to set up, and nothing earned is ever taken back.
>
> PRIVATE BY DESIGN
> • No account, no server, no ads, no tracking.
> • Everything stays on your phone. Back it up to a file whenever you
>   like.
> • Your scores are yours alone: no leaderboards, no comparisons.

## Keywords (100)

    planner,habits,routine,schedule,time blocking,priorities,life balance,weekly plan,focus,tiers

(93 characters. Apple adds the name and subtitle on its own, so
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

1. Home: today's windows, a few ticked, the score.
2. Plan: the week strip and a day with windows and an event.
3. Priorities: the four tiers.
4. Life: units with their bars, one opened.
5. Achievements: the shield grid.

## App Review notes

> Life Strategy needs no account or sign-in. All data stays on the
> device. To see a full plan quickly, go through onboarding: sort the
> units into tiers, pick "9–5 job", accept the suggested hours and tap
> a few starter tasks. Notifications are optional, local reminders.
> The app contains no encryption of its own
> (usesNonExemptEncryption is false).

Contact: henrywithersfeedback@gmail.com

## TestFlight

**Beta App Description**

> Life Strategy plans your week around what matters to you and the time
> you actually have. Sort your life into tiers, set your working hours,
> and get windows of time filled with suggestions you can pin.

**What to Test**

> Thanks for testing! Please try:
> • Onboarding from the start, including commitments and hours.
> • Adding events, including one at the same time as another.
> • Adding a window, and "Every <day>".
> • Pinning in windows (hold a pin for what the pins mean).
> • Editing or deleting anything you can see.
> Settings → Send feedback reaches me directly, and Settings → Problem
> log → Send log helps if something breaks.

**Feedback email:** henrywithersfeedback@gmail.com
