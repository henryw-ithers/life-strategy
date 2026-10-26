/**
 * An achievement's small mark beside a unit or on a card: a tiny shield
 * in the rank's metal, or a dashed outline before the first rank
 * (`ShieldBadge`). The rank is always said in words beside it or in its
 * label, never by colour alone.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Rank } from "@glide/scoring";
import { SymbolView } from "expo-symbols";

import { streakColor, type ThemeTokens } from "../../theme/colors";
import { ShieldBadge } from "./ShieldBadge";

export function Medal({
  rank,
  theme,
  size = 22,
}: {
  /** The rank shown; null draws the locked outline. */
  rank: Rank | null;
  /** Kept for callers; every mark is a shield now. */
  run?: boolean;
  theme: ThemeTokens;
  size?: number;
}) {
  return <ShieldBadge rank={rank} theme={theme} size={size} />;
}

/** A run going now (§5): a flame. Shown only from the series' first
 *  rank, and gone quietly when the run ends. */
export function StreakFlame({ theme, size = 13 }: { theme: ThemeTokens; size?: number }) {
  const color = streakColor(theme);
  return (
    <SymbolView
      name="flame.fill"
      size={size}
      tintColor={color}
      accessible={false}
      fallback={<Ionicons name="flame" size={size} color={color} />}
    />
  );
}
