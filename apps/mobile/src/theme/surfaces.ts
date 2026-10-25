/**
 * The card: the one container the app's screens are built from (Group,
 * window cards, Home's lists). White on the cool canvas with a soft
 * shadow in light mode; a slate card with a fine edge in dark, where a
 * shadow wouldn't show (Henry, 2026-10-25: screens read as "an
 * interactive text file" without them).
 */
import type { ViewStyle } from "react-native";

import type { ThemeTokens } from "./colors";
import { radius } from "./tokens";

export function cardStyle(theme: ThemeTokens): ViewStyle {
  return theme.name === "dark"
    ? {
        backgroundColor: theme.surface,
        borderRadius: radius.xl - 6,
        borderWidth: 1,
        borderColor: theme.hairline,
      }
    : {
        backgroundColor: theme.surface,
        borderRadius: radius.xl - 6,
        shadowColor: "#1B2B44",
        shadowOpacity: 0.07,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      };
}
