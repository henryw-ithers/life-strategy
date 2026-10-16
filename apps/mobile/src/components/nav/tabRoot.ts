/**
 * How a tab's root screen sits in its native stack (ADR-0043 §1, spec
 * §2.2): a native nav bar with a large title that collapses as you
 * scroll, transparent so the glass edge and the backdrop behind the tabs
 * show, and see-through content for the same reason (see
 * `app/(tabs)/_layout.tsx`).
 *
 * The screen's scroll view needs `contentInsetAdjustmentBehavior=
 * "automatic"` and must come first in the screen, or the title won't
 * collapse.
 *
 * Pushed screens get the same bar (`pushedOptions`), so a push is one
 * native transition: the title, back button and toolbar animate
 * together. They used to hide the bar and draw their own header, and
 * the bar's buttons and the two titles glitched across each other
 * mid-push (Henry, 2026-10-16).
 */
import { Platform } from "react-native";

import type { ThemeTokens } from "../../theme/colors";

export function tabRootOptions(theme: ThemeTokens, title: string) {
  return {
    title,
    headerShown: true,
    headerLargeTitleEnabled: title.length > 0,
    // Transparent on iOS, where the scroll view's automatic insets keep
    // content clear of the bar. The web preview has no such insets.
    headerTransparent: Platform.OS === "ios",
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerTintColor: theme.ink,
    headerTitleStyle: { color: theme.ink },
    headerLargeTitleStyle: { color: theme.ink },
    contentStyle: { backgroundColor: "transparent" },
  } as const;
}

/**
 * A pushed screen's nav bar: the system back button and the screen's
 * title, large unless `inline`. The screen sets its title and toolbar
 * itself (`<Stack.Screen options={{ title }} />`, `Stack.Toolbar`).
 *
 * Unlike a tab root its content is opaque: a pushed screen slides over
 * the one beneath, which would show through. Same rule for the scroll
 * view, which must come first, so the screen's backdrop goes inside it
 * (`ScrollBackdrop`).
 */
export function pushedOptions(theme: ThemeTokens, opts?: { inline?: boolean }) {
  return {
    ...tabRootOptions(theme, ""),
    headerLargeTitleEnabled: opts?.inline !== true,
    contentStyle: { backgroundColor: theme.canvas },
  } as const;
}
