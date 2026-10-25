/**
 * An achievement's badge: a shield (Henry, 2026-10-25). Earned, it's a
 * rim in the rank's deep metal around a face in its light tone, with
 * the series' icon in the middle. Not yet earned, it's the outline: the
 * pre-Bronze shape, so a locked badge still shows what it will be.
 *
 * Built from the system's shield symbol, layered, rather than drawn on
 * a canvas: the Achievements screen shows forty at once, and a canvas
 * each is too much for a phone (and runs the browser preview out of
 * graphics contexts).
 *
 * The rank is always said in words beside it or in its label, never by
 * colour alone.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Rank } from "@glide/scoring";
import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";

export type BadgeIcon = React.ComponentProps<typeof Ionicons>["name"];

/** Each metal's deep rim and light face. */
const METAL: Record<Rank, { deep: string; light: string }> = {
  bronze: { deep: "#9A5A2C", light: "#E8B38A" },
  silver: { deep: "#7D8794", light: "#E2E6EC" },
  gold: { deep: "#B07D0B", light: "#F7D774" },
  platinum: { deep: "#4E9A8E", light: "#CDEFE8" },
  diamond: { deep: "#2F7FC8", light: "#BFE6FF" },
};

function Shield({ size, color, filled }: { size: number; color: string; filled: boolean }) {
  return (
    <SymbolView
      name={filled ? "shield.fill" : "shield"}
      size={size}
      tintColor={color}
      weight={filled ? "regular" : "light"}
      fallback={<Ionicons name={filled ? "shield" : "shield-outline"} size={size} color={color} />}
    />
  );
}

export function ShieldBadge({
  rank,
  icon,
  theme,
  size = 56,
}: {
  /** The rank earned; null draws the pre-Bronze outline. */
  rank: Rank | null;
  /** The series' icon; left out on a mark too small to hold one. */
  icon?: BadgeIcon;
  theme: ThemeTokens;
  size?: number;
}) {
  const metal = rank ? METAL[rank] : null;
  return (
    <View style={[styles.box, { width: size, height: size }]} accessible={false}>
      {metal ? (
        <>
          <View style={styles.layer}>
            <Shield size={size} color={metal.deep} filled />
          </View>
          <View style={styles.layer}>
            <Shield size={size * 0.78} color={metal.light} filled />
          </View>
        </>
      ) : (
        <View style={styles.layer}>
          <Shield size={size} color={theme.hairline} filled={false} />
        </View>
      )}
      {icon ? (
        <View style={[styles.layer, { paddingBottom: size * 0.06 }]}>
          <Ionicons name={icon} size={size * 0.34} color={metal ? metal.deep : theme.muted} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
  layer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
});
