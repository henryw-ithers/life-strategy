---
name: Life Strategy
description: A personal planning app that turns your priorities into a daily checklist and a grade out of 100.
colors:
  canvas-light: "#FFFFFF"
  canvas-dark: "#000000"
  surface-light: "#F2F2F7"
  surface-dark: "#1C1C1E"
  ink-light: "#000000"
  ink-dark: "#FFFFFF"
  muted-light: "#6C6C70"
  muted-dark: "#98989F"
  hairline-light: "#C6C6C8"
  hairline-dark: "#38383A"
  accent-light: "#000000"
  accent-dark: "#FFFFFF"
  on-accent-light: "#FFFFFF"
  on-accent-dark: "#000000"
  danger-light: "#D70015"
  danger-dark: "#FF6961"
  scrim: "rgba(0, 0, 0, 0.45)"
  palette-red: { light: "#D70015", dark: "#FF6961" }
  palette-orange: { light: "#C93400", dark: "#FFB340" }
  palette-yellow: { light: "#B25000", dark: "#FFD426" }
  palette-green: { light: "#1F7F38", dark: "#30DB5B" }
  palette-mint: { light: "#0C817B", dark: "#66D4CF" }
  palette-teal: { light: "#008299", dark: "#5DE6FF" }
  palette-cyan: { light: "#0071A4", dark: "#70D7FF" }
  palette-blue: { light: "#0040DD", dark: "#409CFF" }
  palette-indigo: { light: "#3634A3", dark: "#7D7AFF" }
  palette-purple: { light: "#8944AB", dark: "#DA8FFF" }
  palette-pink: { light: "#D30F45", dark: "#FF6482" }
  palette-brown: { light: "#7F6545", dark: "#B59469" }
typography:
  family: "SF (the system font), every weight built in"
  display: { fontSize: "28px", fontWeight: 700, lineHeight: "34px" }
  title: { fontSize: "22px", fontWeight: 700, lineHeight: "28px" }
  headline: { fontSize: "17px", fontWeight: 600, lineHeight: "22px" }
  body: { fontSize: "16px", fontWeight: 400, lineHeight: "24px" }
  label: { fontSize: "15px", fontWeight: 600, lineHeight: "20px" }
  caption: { fontSize: "13px", fontWeight: 500, lineHeight: "18px" }
  footnote: { fontSize: "12px", fontWeight: 500, lineHeight: "16px" }
  numeral: { fontSize: "44px", fontWeight: 700, lineHeight: "48px" }
rounded:
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
  screen: "20px"
---

# Design System: Life Strategy

The app follows the **Prism** style, chosen on 2026-10-13
([ADR-0043](docs/adr/0043-the-app-uses-native-ios-controls.md),
[redesign spec](docs/design/redesign-spec.md) §2). The tokens live in
`apps/mobile/src/theme/`: `colors.ts` for the theme, `palette.ts` for
the 12 unit colours and `tokens.ts` for type and spacing. Contrast is
checked by `theme/__tests__/palette.test.ts`.

Phase 3 of the redesign is nearly done. Native tabs, sheets, menus,
alerts, Liquid Glass and the app icon are in; plain backups are its
last step.

## 1. Overview

Prism looks like an iOS app first. The backgrounds, text and dividers
are Apple's system colours, the type is SF, and buttons use the label
colour: black in light mode, white in dark. All the colour in the app
comes from your units and commitments, so a checkbox or an event bar is
the colour of the part of life it belongs to.

One element is the app's own: the bubble backdrop, soft circles in the
area colours behind the content.

The app rejects:

- dense, nested configuration (the daily surface is a checklist)
- streak shame, alarm colours on missed days, nagging
- dashboard clichés such as hero metrics and gradient accents
- leaderboards or any comparison of scores

Warmth comes from celebration (finished goals, special days, memories),
never from decoration or softened numbers.

## 2. Colours

### Theme

| Token | Light | Dark | Use |
|---|---|---|---|
| canvas | `#FFFFFF` | `#000000` | Screen background (systemBackground) |
| surface | `#F2F2F7` | `#1C1C1E` | Cards and groups (secondarySystemBackground) |
| ink | `#000000` | `#FFFFFF` | Text (label) |
| muted | `#6C6C70` | `#98989F` | Secondary text, captions |
| hairline | `#C6C6C8` | `#38383A` | Dividers (separator) |
| accent | `#000000` | `#FFFFFF` | Buttons and highlights (label colour) |
| onAccent | `#FFFFFF` | `#000000` | Text and ticks on the accent or a unit colour |
| danger | `#D70015` | `#FF6961` | Destructive actions only |

Muted is opaque so it holds 4.5:1 on cards as well as the background.
iOS's own secondaryLabel is translucent and drops below that on a card.

The accent is the label colour on purpose: it can never be mistaken for
a unit's colour.

### The 12 unit colours

Units and commitments take their colour from 12, which are iOS's
system colours in the higher-contrast versions Apple publishes. Each
works as a checkbox ring, an event bar or tinted text at 4.5:1 or
better, on the background and on cards, in both modes. A filled checkbox uses the same colour with a
white tick in light mode and a black tick in dark mode.

| Colour | Light | Dark | Area |
|---|---|---|---|
| Red | `#D70015` | `#FF6961` | |
| Orange | `#C93400` | `#FFB340` | Environment |
| Yellow | `#B25000` | `#FFD426` | |
| Green | `#1F7F38` | `#30DB5B` | Physical health |
| Mint | `#0B7A74` | `#66D4CF` | |
| Teal | `#00778C` | `#5DE6FF` | Mental wellbeing |
| Cyan | `#0071A4` | `#70D7FF` | |
| Blue | `#0040DD` | `#409CFF` | Work and money |
| Indigo | `#3634A3` | `#7D7AFF` | |
| Purple | `#8944AB` | `#DA8FFF` | Leisure and creativity |
| Pink | `#D30F45` | `#FF6482` | Relationships |
| Brown | `#7F6545` | `#B59469` | |

Three light versions are a step darker than Apple's: green (Apple's
`#248A3D` measured 4.4:1 on white, Henry, 2026-10-14), and teal and
mint, which measured 4.0 and 4.2:1 on a card.

A unit stores its colour as a palette key in `life_unit.colour`. With
none set, it uses its area's colour (`unitHue` in `colors.ts`). A
sub-commitment with no colour of its own uses its commitment's. Colour
is presentation only: it never changes a weight, a rank or the order
of anything (ADR-0021).

Text links in the label colour carry a chevron so they read as links:
› for one that opens something, and a turning chevron for one that
expands in place. In-place actions such as Undo stay plain buttons.

`wash(hue, theme)` gives a hue as a selectable surface (12% in light,
18% in dark) with an Ink label on top. `solidFill(hue, theme)` is where
a fill behind text is chosen; under Prism it returns the hue, because
every palette colour already carries its tick.

### The calendar exception

The monthly calendar colours each day by a six-band grade ramp in
palette colours: Red below 50, then Orange, Yellow, Green and Mint for
the 50s to the 80s, and Blue at 90 and above. The week strip at the top of Home
carries the same grade chip. These two are the one exception to the
no-alarm-colours rule in PRODUCT.md, and the ramp must not spread
anywhere else. It colours the chip border and tint only; the numerals
stay in Ink.

The danger colour is the same red as the palette's Red, as on iOS. A
destructive action is known by its label, never by colour alone.

## 3. Typography

The app is set in SF, the system font. It comes with the phone, so
nothing loads at launch, every weight is built in, and iOS applies its
own letter spacing for each size. Sizes kept their Manrope values when
the font changed, so no screen reflowed.

| Variant | Weight | Size / line | Use |
|---|---|---|---|
| numeral | 700 | 44 / 48 | The day's grade, and only that |
| display | 700 | 28 / 34 | Screen titles |
| title | 700 | 22 / 28 | Section headers, a goal's title |
| headline | 600 | 17 / 22 | Primary button labels, list emphasis |
| body | 400 | 16 / 24 | Running text, notes |
| label | 600 | 15 / 20 | Secondary buttons, form labels |
| caption | 500 | 13 / 18 | Captions |
| footnote | 500 | 12 / 16 | Timestamps, fine print |

`AppText` is the only text component. Every string picks a variant and
an explicit colour. The few places outside it (text fields, the number
dial) take their weight from `tokens.weight`. Use tabular numerals
(`fontVariant: ["tabular-nums"]`) wherever numbers line up. Text must
scale to 200% with Dynamic Type.

## 4. Elevation

Flat. Canvas and surface differ by fill, never by shadow. Sheets and
overlays are the only things that sit above the screen, and from Phase
3c they are native sheets that draw their own edge. A card or button
that needs emphasis gets colour or weight, never a shadow.

Liquid Glass is for controls only: the tab bar, toolbars, sheets and
buttons that float over content. iOS draws the bars, menus and sheets;
the app's own floating controls use `Glass` (`expo-glass-effect`): the
Undo bar, the keyboard's hide button and a photo viewer's buttons.
Cards, rows and the score are never glass, and glass never sits on
glass. `Glass` turns solid when Reduce Transparency is on, before iOS
26 and in the web preview. Nothing above glass may fade, or it stops
rendering: move it instead, as the Undo bar does.

## 5. Components

### Buttons

- **Primary:** filled with the accent (or a unit's colour for an action
  that belongs to it), onAccent label at Headline weight, 52pt tall.
- **Tonal:** a wash of the accent with an Ink label, 48pt tall, for a
  standing action on a screen.
- **Secondary:** filled with surface, Ink label, 48pt tall.
- **Quiet:** no fill, Muted label, 44pt tall, for dismissive actions.
- **Disabled:** lowered opacity, never a separate palette.

### Text fields

Every field is `TextField` (ADR-0043 §5). Its keyboard carries one
round ⌄ button that hides it, attached through iOS's input accessory
view so it stays on the keyboard in screens and sheets alike. Sheets
keep their height when the keyboard opens.

### Menus, alerts and Undo

Menus are native (`ActionMenu`, `Stack.Toolbar.Menu`). Anything a long
press opens is also reachable from a tap or a ••• button, and an
action that can't apply is left out, not greyed.

An everyday delete (a note, a photo, an activity, a task, an event, a
goal reading, a condition, a sub-commitment from its parent's list)
asks nothing. The thing goes at once and the Undo bar shows above the
tab bar for about five seconds (`useUndoDelete`, `UndoBar`). The delete
itself runs only when the bar goes, or when you leave the screen or the
app, so Undo never has to rebuild anything. With VoiceOver on the bar
waits until you leave.

A native alert asks only where the loss can't be taken back: deleting
a goal, deleting a commitment from its own page, and resetting
everything, which asks twice.

### Date and time pickers

`DateTimeField`: iOS's compact picker, which stays open while you
scroll (ADR-0043 §1).

### Cards and groups

Surface fill, 12pt corners, at least 16pt padding, 20pt screen gutter.
A `Group` holds a related set with its label above it, in the iOS
inset-grouped style. Groups never nest.

### Number dial

The 1 to 10 rating control: a scroll-snapped carousel on a surface
track with a haptic tick at each step. Unset, it shows a dash rather
than a default value, so the app never suggests an answer.

### Backdrop

Soft circles in the area colours bleeding off the screen edges, alpha
between about 2% and 10%. Nothing starts above the large title, so the
navigation bar has little to blur at rest (spec §2.2). Two modes:

- **Constellation:** all six area colours. The `faint` version is the
  default on content screens.
- **Hue wash:** one unit's colour, on that unit's own screen (a
  commitment, a goal).

The backdrop never sits behind dense data such as a graph.

### App icon

The constellation: the six area colours as bubbles, the backdrop
drawn as an icon. It is an Icon Composer `.icon` package
(`assets/app.icon`), written by hand: `icon.json` and one SVG per
bubble, in three glass groups (the two smallest at the front, the two
largest at the back). White behind it in light mode, black in dark;
iOS makes the tinted version. `assets/images/icon.png` is the same
drawing flattened, for iOS before 26, and the launch screen and web
favicon match it.

### Navigation

Native iOS tabs (`app/(tabs)/_layout.tsx`): Home (`sun.max`), Plan
(`calendar`), Life (`square.grid.2x2`) and Log (`book.closed`), a label
on each, shrinking as you scroll down. Each tab is a native stack whose
root has a large title (Home has none until Phase 9 rebuilds its own
header). The nav bar carries a `+` pull-down menu (Task, Event, Log
something, and Goal on Life) and, on Home and Life, Settings. A menu
item another tab owns switches to that tab and opens it there.

Every screen is opaque and draws its own backdrop. iOS changes tabs
with both pages on screen for a moment, so see-through pages over one
shared backdrop showed through each other on every switch. iOS finds
the scroll view that drives the large title, the glass edge and the
shrinking tab bar by following each screen's first child, so a
screen's scroll view must come first, with
`contentInsetAdjustmentBehavior="automatic"`, and the backdrop goes
first inside it (`ScrollBackdrop`). Home keeps its own header above its
scroll view until Phase 9, so its backdrop sits fixed behind it.

A screen's nav bar must be right on its first frame. Any change to a
toolbar or title makes iOS rebuild every bar button, which shows as
flicker, and a change during a push is drawn over the transition. So a
pushed screen reads its title synchronously (`useFirstRead`), and
toolbar buttons call their handlers through `useLatest`.

Focused screens (Settings, Backup, Priorities, a day) are pushed by
the root stack and cover the tabs; a goal or a commitment pushes within
Life. Every pushed screen has the same native nav bar as a tab root,
with the system back button, so a push is one native transition. Its
own actions go in a ••• menu in that bar. Onboarding and the
diagnostic are full-screen flows with no bar.

## 6. Do and don't

Do:

- keep backgrounds to the system colours and let unit colours carry
  all the colour
- use the label colour for buttons, so actions never look like a unit
- use tabular numerals wherever numbers line up
- frame every score as a guideline, and say "Priority", never
  "Importance"

Don't:

- add a colour outside the palette, or tint a background
- use streak shame, nagging or alarm colours (outside the calendar
  ramp)
- add leaderboards or score comparisons
- use a shadow for emphasis
- put glass on cards, rows or the score
