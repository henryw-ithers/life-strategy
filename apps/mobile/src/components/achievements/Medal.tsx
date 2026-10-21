/**
 * An achievement's mark (ADR-0047 §7). Shapes follow Apple's lead: a
 * circle for a count, a hexagon for a run. Earned, it's filled in the
 * rank's colour; locked, a grey outline. The rank is always said in
 * words beside it or in its label, never by colour alone.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Rank } from "@glide/scoring";
import { SymbolView } from "expo-symbols";

import { rankColor, streakColor, type ThemeTokens } from "../../theme/colors";

export function Medal({
  rank,
  run,
  theme,
  size = 22,
}: {
  /** The rank shown; null draws the locked outline. */
  rank: Rank | null;
  run: boolean;
  theme: ThemeTokens;
  size?: number;
}) {
  const color = rank === null ? theme.muted : rankColor(rank, theme);
  const filled = rank !== null;
  const name = run ? (filled ? "hexagon.fill" : "hexagon") : filled ? "circle.fill" : "circle";
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      accessible={false}
      fallback={
        run ? (
          <MaterialCommunityIcons name={filled ? "hexagon" : "hexagon-outline"} size={size} color={color} />
        ) : (
          <Ionicons name={filled ? "ellipse" : "ellipse-outline"} size={size} color={color} />
        )
      }
    />
  );
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
