/**
 * An achievement's badge: a shield (Henry, 2026-10-25). Earned, it's a
 * rim in the rank's palette colour around a face in its light tone, with
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
import { PALETTE, type PaletteKey } from "../../theme/palette";

export type BadgeIcon = React.ComponentProps<typeof Ionicons>["name"];

/**
 * Each rank's colour, from the palette (spec §883; DESIGN.md: no colour
 * outside it). Silver is the muted grey.
 */
const RANK_HUE: Record<Rank, PaletteKey | "muted"> = {
  bronze: "brown",
  silver: "muted",
  gold: "yellow",
  platinum: "mint",
  diamond: "cyan",
};

/** `a` mixed `t` of the way toward `b`, both #RRGGBB: a solid face, so
 *  the rim drawn under it doesn't show through as a wash would. */
function mix(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** A rank's deep rim (the palette colour) and light face (that colour
 *  three quarters of the way to the card). */
function metalOf(rank: Rank, theme: ThemeTokens): { deep: string; light: string } {
  const key = RANK_HUE[rank];
  const deep = key === "muted" ? theme.muted : PALETTE[key][theme.name === "dark" ? "dark" : "light"];
  return { deep, light: mix(deep, theme.surface, 0.75) };
}

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
  const metal = rank ? metalOf(rank, theme) : null;
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
