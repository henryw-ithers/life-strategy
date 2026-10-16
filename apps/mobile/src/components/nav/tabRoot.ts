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
 * Pushed screens keep their own headers until Phase 3d.
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

/** Pushed screens draw their own header for now (Phase 3d). */
export const PUSHED_OPTIONS = { headerShown: false } as const;
