# ADR-0043: The app uses native iOS controls

> **Status:** Accepted\
> **Date:** 2026-10-13\
> **Deciders:** Henry

## Context

The app draws its own tab bar (an opaque bar with a pill), its own
bottom sheets (about 28 custom modals), its own menus and its own
confirmation dialogs (DESIGN.md, `components/nav/TabBar.tsx`). On
iOS 26 that looks dated next to Apple's apps. Henry, 2026-10-12: "We
need to move to follow the current Apple UI guidelines with liquid
glass. That means the different style of menu bar and any other
guidelines that we aren't currently following."

Testing also turned up problems in these custom parts:

- the keyboard shrinks whole sheets
- time pickers close as soon as you let go of the wheel
- titles that should be tappable aren't

The app is pinned to Expo SDK 54 because that's the newest version Expo
Go supports (AGENTS.md). In the design review Henry decided to leave
Expo Go for good ("move on from expo go entirely"), to keep React
Native, and to build through EAS. He's enrolled in the Apple Developer
Program and already uses TestFlight. His iPhone runs iOS 26.5.

He chose the Prism direction from three prototypes: system backgrounds,
colour carried by units, a monochrome accent, and the bubble backdrop
kept. He also asked for "four tabs: Home · Plan · Life · Log", and for
user-chosen colours for units and commitments.

Apple's guidance and the Expo options are summarised in
[research-brief.md](../design/research-brief.md) §3, and the screen
rules are in [redesign-spec.md](../design/redesign-spec.md) §2.

## Open questions

1. Which parts become native?
2. What is the visual style?
3. Can users choose colours, and what does that change?
4. How is the app built and run?

## Options considered

- **Restyle the custom parts with blur.** Keeps full control, but the
  result is still an imitation, and the iOS 27 Liquid Glass slider won't
  apply to it.
- **Native controls for navigation and system parts, with the app's
  identity in content** (chosen). This is what Things and Todoist did
  for iOS 26.
- **Rewrite in Swift and SwiftUI.** Fully native, but it means
  rebuilding everything, including the scoring engine. Henry chose to
  keep React Native.

## Decision

### 1. Native where iOS has it

The following become native:

- **Tabs:** Expo Router native tabs, with SF Symbols, a label on every
  tab, and minimising on scroll. Home (`sun.max`), Plan (`calendar`),
  Life (`square.grid.2x2`), Log (`book.closed`).
- **Sheets:** form sheets with detents and a grabber, Cancel on the
  left and Done on the right, one sheet at a time, swipe to dismiss.
- **Menus:** context menus and pull-down menus. Anything in a long-press
  menu is also reachable from a ••• button or a swipe.
- **Pickers:** compact date and time pickers from `@expo/ui`. They stay
  open while you scroll.
- **Confirmations:** native alerts, used only where something can't be
  undone. Everything else gets an Undo toast.

Settings opens from a toolbar button rather than a tab. Adding things
goes through a `+` menu in the toolbar.

### 2. Liquid Glass on controls only

Glass is used only on the tab bar, toolbars, sheets and buttons that
float over content. Cards, rows and the score are never glass, and glass
never sits on glass. Custom glass falls back to solid when Reduce
Transparency is on.

### 3. The Prism style

- System backgrounds, in light and dark mode.
- Colour comes from units: checkboxes and event bars use the unit's
  colour.
- The accent is the label colour (black in light mode, white in dark),
  so it is never confused with a unit's colour.
- SF throughout.
- The bubble backdrop stays behind content, thinned near the top bars.
- A layered Icon Composer app icon built from the bubbles.

Text must reach 4.5:1 contrast in light mode, dark mode and Increase
Contrast, and scale to 200% with Dynamic Type.

### 4. Users can choose colours

There is a palette of 12, each with light, dark and fill versions
checked for contrast. The six area colours are among the 12. A
commitment or unit can take any of them, stored as a palette key in
`life_unit.colour`; with none set, a unit uses its area's colour.
Colour never affects weight, rank or order, so ADR-0021 §1 still holds.

### 5. Keyboard and text fields

Every text field uses one shared field component with
`react-native-keyboard-controller`. Sheets keep their height and the
active field scrolls into view. A bar above the keyboard has ⌄ to hide
it, and ‹ › to move between fields where that helps. Return works as
normal.

> **Amended 2026-10-14: no ‹ › arrows.** On the device, the arrows
> beside ⌄ read as three buttons doing one thing (Henry). The bar now
> has a single button, iOS's keyboard-down symbol, that hides the
> keyboard. Return still says Next where moving to the next field
> helps.

Titles of commitments, sub-commitments, goals and custom units can be
renamed by tapping them.

### 6. Builds

The app leaves Expo Go. It runs as an EAS development build on the
iPhone (the `development` profile in `eas.json`), with code loaded from
`npm run mobile` as before. TestFlight builds are unchanged.

Expo SDK 54 is upgraded to the current stable SDK (57, or 58 if it's
stable by then), as its own change before the redesign. SDK 56 removed
React Navigation from Expo Router, so `TabBar.tsx`'s imports move or go.

The web preview stays a development-only tool (docs/web-preview.md).

## Consequences

- **Easier.** The app looks and behaves like an iOS 26 app, and gets
  Apple's accessibility support for free. Several bugs disappear with
  the custom parts they lived in.
- **Harder.** Native tabs offer less visual control and mount all tabs
  at once. Native modules change only with a new development build, so
  testing needs one build after each native change. Expo Go no longer
  runs the app at all.
- **Revisit** custom glass when iOS 27's Liquid Glass slider ships;
  test at both ends of it.

**Amends, on acceptance:**

| ADR / doc | What changes |
|---|---|
| ADR-0021 | §2 area colours are no longer the only colours. Users can pick from the palette |
| ADR-0001 | The app is built with EAS development builds, not Expo Go |
| DESIGN.md | Rewritten for Prism, native tabs and Liquid Glass |
| AGENTS.md | The SDK 54 pin and the Expo Go notes go |

## Action items

1. [ ] Upgrade the Expo SDK and make an EAS development build
       (Phase 0).
2. [ ] Shared text field, picker fix, tap-to-rename and removing the
       location field (Phase 2).
3. [ ] Native tabs, form sheets, context menus, alerts, the Prism
       tokens, the colour palette and the app icon (Phase 3).
4. [ ] Check every screen against the iOS 26 checklist in the
       research.
5. [ ] Amend ADR-0001 and 0021. Rewrite DESIGN.md. Update AGENTS.md
       and `apps/mobile/AGENTS.md`.
