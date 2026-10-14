# Research brief: planning around work windows

Written 2026-10-12 for the windows redesign and revised 2026-10-13. It
collects the evidence behind [redesign-spec.md](redesign-spec.md),
which refers to the principles here as P1–P20.

It draws on three pieces of research:

1. A look at how other planning apps work: Sunsama, Akiflow, Morgen,
   Motion, Reclaim, Structured, Tiimo, Things 3, Todoist, Ellie, Llama
   Life, Amie, Routine, Fantastical, Apple Reminders and Opal.
2. Apple's iOS 26 design guidelines and what Expo currently supports.
3. Studies on time management, planning, motivation and onboarding.

The main academic papers were checked against their sources. Reddit
couldn't be reached directly, so complaints from there come through
review sites that quote it. Some reviews were written by competing
companies. Books by Newport, Burkeman and Fogg are treated as advice,
not evidence.

[scheduling-and-motivation.md](scheduling-and-motivation.md) is still
the reference for implementation intentions, flow and
self-determination theory. This brief adds the app comparison and the
iOS 26 material, and doesn't contradict it.

## 1. What other apps do

### Blocks you fill later

Three apps already have something like windows:

- **Akiflow** has Time Slots: repeating, labelled blocks you set up
  once. One reviewer said that on the weekend they "just fill them".
- **Morgen** has Frames: weekly blocks with a filter for which tasks
  can go in them. Its AI places only matching tasks inside a Frame.
- **Reclaim** has sets of hours (work, personal, custom) and habits
  defined as a range with an ideal time, such as "11:30–2, 30 to 60
  minutes, ideally 12".

Morgen is the closest to this design. Its suggestions show as
unconfirmed blocks until you accept them. If you ignore one, the next
task takes its place. If you drag one, it stays where you put it and
the rest rearrange around it. Reviewers say this is what keeps the
automation from feeling out of control. The weak point is setup:
Frames take about an hour to configure, and the phone app does nothing
until the desktop app is set up.

### Planning rituals

Sunsama's daily planning takes 5 to 10 minutes: look back at
yesterday, pull in tasks, check the total against an hours limit (which
can differ by weekday), order the tasks, set a time to stop. Its
weekly planning sets goals for the week rather than placing tasks.

In Sunsama and Akiflow, if you skip the end-of-day review, it becomes
the first step of your next planning session. Nothing is lost and
nothing nags.

Structured's Replan shows yesterday's leftovers one at a time, and for
each you choose reschedule, inbox, done or delete. Repeating tasks are
left out by default.

### Automatic scheduling going wrong

Motion asks for a duration plus a deadline or priority on every task,
or it can't schedule it. It also keeps moving tasks around. App Store
reviews say it "doesn't keep any tasks where I move them" and "if I
have to supervise the scheduler, it defeats the purpose". Reviewers
report two to four weeks of setup, and it costs $29 to $49 a month.
Some users love being told what to do next, so there is demand for
it; the complaint is about losing control.

Reclaim users say it "over-schedules" and that the result "looks
overwhelming". Some want to switch auto-planning off for part of a
day.

### Unfinished tasks

| App | What happens | Result |
|---|---|---|
| Sunsama | Rolls over at midnight; archived after about 4 rollovers | Users asked for archived tasks to stay visible, greyed out |
| Ellie | Goes back to the brain dump, not to "overdue" | The gentlest approach found |
| Tiimo | No rollover | Led to at least one refund dispute |
| Structured | Re-adds repeating tasks at their usual time even when done | Reported as a bug |

### Task sizes

Morgen has a default length for tasks without one, and an option to
add 20% to every estimate. Structured uses preset length buttons;
users want longer options and fewer taps. Things and Ellie don't use
lengths at all. Tiimo's AI estimates times and splits tasks up, but it
deliberately doesn't plan your whole day.

### Repeats

Things 3.23 (August 2026) lets you change one occurrence or the whole
rule, complete a repeat early, pause repeats in bulk and see a list of
everything that repeats. It still has no "skip this week". Todoist
handles end dates in plain language ("every day ending Aug 3"). Reclaim
lets you skip a single occurrence.

### Home screens and other days

Structured opens on a vertical timeline for today with a week strip
you can swipe. Todoist's Upcoming view is a week strip over a list
grouped by date, with drag between days. Tiimo keeps timed tasks and
"anytime" tasks apart, and users want to choose which comes first.
Llama Life shows when you'll finish your list.

### Onboarding

Structured asks almost nothing. Two starter tasks (wake up and wind
down) frame the day, and adding meals shows your free time. It has a
4.8 rating from about 167,000 reviews. Sunsama, Morgen and Reclaim
need desktop setup and lose people who start on a phone.

### Drift

Amie moved its focus to notes and Motion grew into a much broader
product. Users of both lost the main thing they signed up for.

### Patterns to copy

| # | Pattern | From |
|---|---|---|
| A1 | Repeating blocks you fill later | Akiflow, Morgen, Reclaim |
| A2 | Suggestions you accept; dragging pins a task and the rest move around it | Morgen |
| A3 | Ignoring a suggestion brings in the next one | Morgen |
| A4 | A skipped review becomes the first step of the next one | Sunsama, Akiflow |
| A5 | Weekly planning stays light | Sunsama |
| A6 | Unfinished tasks go back to the list, not to "overdue" | Ellie |
| A7 | Starter tasks during onboarding | Structured |
| A8 | Add tasks now, place them later | Tiimo, Structured, Ellie |
| A9 | Change one occurrence or the whole series | Things 3.23 |
| A10 | End dates in plain language | Todoist, Things |
| A11 | A swipeable week strip with a Today button | Todoist, Structured, Fantastical |
| A12 | Breaks from a rule, not drawn by hand | Morgen |
| A13 | Different hours for different weekdays | Sunsama |
| A14 | Show how much time is left or planned | Llama Life, Sunsama |

### Things to avoid

| # | Problem | Seen in |
|---|---|---|
| X1 | The app moves tasks you placed | Motion |
| X2 | A warning every time you move something | Motion |
| X3 | Required fields before a task can be scheduled | Motion |
| X4 | Every free minute filled | Reclaim |
| X5 | Long setup before anything is useful | Morgen, Reclaim |
| X6 | Setup only possible on a computer | Sunsama, Morgen |
| X7 | Tasks disappearing without notice | Sunsama |
| X8 | A growing overdue list in red | Many planners |
| X9 | Repeats that ignore what you already did | Structured |
| X10 | A "now" indicator that's wrong | Tiimo widget |
| X11 | Streak pressure and locked sessions | Opal |
| X12 | Losing the core feature to new ones | Amie, Motion |

## 2. What the research says

**Naming a time works, and a window is precise enough.** Plans of the
form "if it's Tuesday evening, I'll…" improved goal attainment by about
d = 0.65 across 94 studies (Gollwitzer & Sheeran, 2006). Most of the
effect comes from choosing when and where, not the exact minute. (P1)

**People underestimate how long things take.** They do this even when
they know past projects ran over (Kahneman & Tversky; Buehler et al.,
1994), and they misremember how long past tasks took (Roy et al.,
2005). Breaking a task into steps reduces the error (Kruger & Evans,
2004). (P2, P3, P4, P5)

**Unfinished tasks stop nagging once they have a plan.** Making a
specific plan for an unfinished goal stopped it intruding on other
work (Masicampo & Baumeister, 2011). A 2025 meta-analysis found no
memory advantage for unfinished tasks, but a reliable urge to get back
to them (Ghibellini & Meier). (P7, P8)

**How many options to show.** On average, more options don't harm
choices (Scheibehenne et al., 2010). They do when the choice is
complicated, preferences are unclear and the person wants to decide
fast (Chernev et al., 2015). "What should I do now?" is all three.
People hold about four items in mind at once (Cowan, 2001). (P6)

**People accept automation they can adjust.** They stop using an
imperfect algorithm, but keep using it if they can change its output
even a little (Dietvorst et al., 2018). Users of a fully automatic
scheduler felt it took too much control and tried to take it back
(Endacott, 2024). People also accept suggestions without checking them
(Parasuraman & Manzey, 2010). People value what they help make, but
only once it's finished (Norton et al., 2012). (P9, P10, P11)

**Goals.** Specific, hard goals beat "do your best" (Locke & Latham,
2002). For complex work, goals about the process work better than
goals about the result (Seijts & Latham, 2001). Narrow goals can crowd
out everything else (Ordóñez et al., 2009). Imagining success without
a plan reduces effort (Oettingen & Mayer, 2002). Goal features in apps
go unused when they aren't connected to what you do each day. (P12,
P13)

**Weekly routines and defaults.** People act on goals more at the
start of a week or month (Dai, Milkman & Riis, 2014). Whatever is
default is what most people end up with (Johnson & Goldstein, 2003).
Habits form slowly and unevenly: 66 days on average, anywhere from 18
to 254 (Lally et al., 2010). No study gives an ideal length for a
planning routine; 3 to 10 minutes on a phone is a judgement call.
(P14, P15)

**Guilt makes things worse.** Being kind to yourself after a setback
increases the effort to improve (Breines & Chen, 2012). People who
forgave themselves for procrastinating procrastinated less later
(Wohl et al., 2010). Procrastination is mostly about feeling better in
the short term (Sirois & Pychyl, 2013). Pointing out a broken streak
makes people less likely to continue (Silverman & Barasch, 2023). (P8,
P20)

**Interface basics.** Show advanced options one level down (Nielsen
Norman Group). Complexity doesn't go away; it can only be moved, so the
app should carry it rather than the user (Tesler's law). More choices
take longer to decide (Hick's law). About half of phone use is one
thumb (Hoober, 2013). Let people drag things directly (Shneiderman,
1983). Offer undo instead of asking for confirmation (Raskin). Design
for bad days first (Meyer & Wachter-Boettcher). (P16–P19)

## 3. Apple's iOS 26 guidelines

Sources: the Human Interface Guidelines pages on materials, tab bars,
toolbars, sheets, menus, buttons, colour, typography, accessibility,
app icons, keyboards and onboarding, and WWDC25 sessions 219, 356 and
323.

**Liquid Glass** is for navigation and controls that float over
content. Cards, rows and other content shouldn't be glass, and glass
shouldn't sit on glass. Use the regular style, not the clear one.

**Tab bars** float, can shrink as you scroll, and label every tab with
an SF Symbol. Tabs are for moving between sections; actions go in
toolbars. Don't give the bar a custom background.

**Toolbars** have at most one highlighted button, on the right. Large
titles shrink as you scroll.

**Sheets** use the system heights and a grabber, with Cancel on the
left and Done on the right. Swiping down closes them, with a prompt
only if there are unsaved changes. Show one sheet at a time, and don't
set a custom background.

**Menus.** A long press opens a context menu, and every action in it
must also be available somewhere visible. Date pickers should be the
compact style with a minute step. Short lists should use a pull-down
menu.

**Text and accessibility.** Custom fonts must support Dynamic Type and
Bold Text and scale to 200%. Text needs 4.5:1 contrast, including in
Increase Contrast mode. Reduce Transparency and Reduce Motion must be
respected. Touch targets are at least 44 points.

**Keyboard.** A bar above the keyboard should only hold controls for
the current task, and the field being edited should stay visible. A
native sheet moves up with the keyboard; it shouldn't shrink.

**App icon.** Layered, made in Icon Composer, with default, dark,
clear and tinted versions, and no text.

**iOS 27** adds a setting that lets users make Liquid Glass more clear
or more tinted, so the app should be tested at both ends. The option to
opt out of Liquid Glass ends with Xcode 27.

**Expo, October 2026.**

- SDK 57 is the current stable release. Use 57.0.17 or later, which
  fixes a memory problem affecting Reanimated.
- SDK 58 is in beta. It targets iOS 27 and makes native tabs and
  `Stack.Toolbar` stable.
- SDK 56 removed React Navigation from Expo Router (a codemod handles
  it) and needs iOS 16.4 and Xcode 26.4.
- Useful packages:
  - native tabs in `expo-router`
  - `expo-glass-effect`
  - `@expo/ui/swift-ui` (date picker, menus, context menus, dialogs,
    sheets, swipe actions)
  - form sheets with set heights in Expo Router
  - `react-native-keyboard-controller` for the keyboard bar and
    scrolling

Other apps' updates for iOS 26 follow a similar pattern. Things 3.22
added glass buttons and a new icon and otherwise looks like Things.
Todoist moved to the native tab bar. The system controls are native,
and the app's identity comes from its colours, icon, content and one
or two distinctive controls.

## 4. Principles

| # | Principle | Based on |
|---|---|---|
| P1 | Placing a task in a window is the plan. Exact minutes are optional | Gollwitzer & Sheeran 2006 |
| P2 | Sizes are quick, normal or big, not minutes | Planning fallacy; Hick's law |
| P3 | Fill windows to about 80% by default | Planning fallacy; Newport |
| P4 | Let people record how long something really took, without commenting on the estimate | Roy et al. 2005 |
| P5 | Offer to split big tasks | Kruger & Evans 2004 |
| P6 | Show 3 to 5 tasks per window, with the rest one tap away | Cowan 2001; Chernev 2015 |
| P7 | Every open task has somewhere to go. Unfinished work is placed again | Masicampo & Baumeister 2011 |
| P8 | No overdue count, no red, no "missed" | Silverman & Barasch 2023; X8 |
| P9 | Suggestions are a draft. The app never moves what you placed | Dietvorst 2018; Endacott 2024; X1 |
| P10 | Ask for one small choice: accept, swap or pin | Norton et al. 2012 |
| P11 | Give each suggestion a short reason ("fits your 1 h gap · Exercise") | Lee & See 2004 |
| P12 | Goals are measurable and steer suggestions. They don't grade the day | Locke & Latham; Ordóñez et al. 2009 |
| P13 | A goal links to tasks that get placed | Oettingen & Mayer 2002 |
| P14 | The weekly pass takes about 5 minutes, at the start of the week | Dai et al. 2014 |
| P15 | Skipping the weekly pass leaves the defaults in place, without comment | Johnson & Goldstein 2003; A4 |
| P16 | Undo instead of confirmation, except where something can't be recovered | Raskin; NN/g |
| P17 | Drag to move, with a menu alternative for VoiceOver | Shneiderman 1983; HIG |
| P18 | A usable plan in the first session, from three or fewer questions | NN/g; Buell & Norton 2011; A7 |
| P19 | Design for hard cases first: no windows, a task too big for any window, sick days, time away | Meyer & Wachter-Boettcher |
| P20 | Encouragement reads the same on a good week and a bad one | Breines & Chen 2012; ADR-0008 |

## Sources

**Apps**
- Sunsama help: [daily planning](https://help.sunsama.com/docs/usage-guides/daily-planning),
  [weekly planning](https://help.sunsama.com/docs/weekly-planning),
  [rollover](https://help.sunsama.com/docs/task-rollover-and-recurring-tasks-the-basics)
- Akiflow: [rituals](https://akiflow.featurebase.app/en/help/articles/0805246-rituals),
  [time blocking](https://akiflow.featurebase.app/en/help/articles/3677363-time-blocking-101)
- Morgen: [review](https://dhruvirzala.com/morgen-review/),
  [AI planner](https://www.morgen.so/for-ai)
- Motion: [what auto-scheduling considers](https://www.usemotion.com/help/time-management/auto-scheduling/reference-auto-scheduling/what-auto-scheduling-considers),
  [App Store reviews](https://apps.apple.com/us/app/motion-ai-calendar-planner/id1580440623?see-all=reviews)
- Reclaim: [habits](https://help.reclaim.ai/en/articles/12295315-stay-consistent-with-routines-using-habits)
- Structured: [Replan](https://structured.app/blog/replan),
  [getting started](https://help.structured.app/en/articles/380546)
- Tiimo: [how to start planning](https://www.tiimoapp.com/resource-hub/how-to-start-planning)
- Things: [repeating to-dos](https://culturedcode.com/things/blog/2026/08/repeating-to-dos-refined/)
- Todoist: [recurring dates](https://todoist.com/help/articles/introduction-to-recurring-due-dates-YUYVJJAV),
  [Upcoming](https://www.todoist.com/help/articles/plan-your-week-with-the-upcoming-view-OKOg1mR8)

**Apple and Expo**
- HIG: [Materials](https://developer.apple.com/design/human-interface-guidelines/materials),
  [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars),
  [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets),
  [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars),
  [Menus](https://developer.apple.com/design/human-interface-guidelines/menus),
  [Color](https://developer.apple.com/design/human-interface-guidelines/color),
  [Typography](https://developer.apple.com/design/human-interface-guidelines/typography),
  [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)
- WWDC25: [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/),
  [Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/)
- Expo: [SDK 57](https://expo.dev/changelog/sdk-57),
  [SDK 58 beta](https://expo.dev/changelog/sdk-58-beta),
  [native tabs](https://docs.expo.dev/router/advanced/native-tabs/),
  [glass effect](https://docs.expo.dev/versions/latest/sdk/glass-effect/),
  [@expo/ui SwiftUI](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/),
  [keyboard handling](https://docs.expo.dev/guides/keyboard-handling/)

**Studies**
- Aeon, Faber & Panaccio 2021 (PLOS ONE)
- Gollwitzer & Sheeran 2006
- Masicampo & Baumeister 2011
- Ghibellini & Meier 2025
- Scheibehenne et al. 2010
- Dietvorst, Simmons & Massey 2018
- Endacott 2024 (JCMC)
- Norton, Mochon & Ariely 2012
- Dai, Milkman & Riis 2014
- Lally et al. 2010
- Silverman & Barasch 2023
- Breines & Chen 2012
- Wohl, Pychyl & Bennett 2010
- Wang et al. 2021 (MCII meta-analysis)
