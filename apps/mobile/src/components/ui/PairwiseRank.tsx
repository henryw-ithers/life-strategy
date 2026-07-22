import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "./AppText";

export interface RankableItem {
  id: string;
  label: string;
}

interface PairwiseRankProps {
  /** The item being placed. */
  newItem: RankableItem;
  /** Already sorted, rank 1 = index 0. Must be non-empty — callers
   *  resolve rank 1 directly when there's nothing to compare against. */
  existingItems: RankableItem[];
  prompt: string;
  /** Omit to hide the skip option. */
  skipLabel?: string;
  theme: ThemeTokens;
  disabled?: boolean;
  /** rank is 1-based. */
  onResolve: (rank: number) => void;
}

/**
 * Beli-style binary-insertion comparison: ~⌈log₂(n+1)⌉ taps to place
 * one new item into an existing sorted list of n, no numbers typed.
 * Pass a `key` that changes per placement so internal low/high state
 * resets between items.
 */
export function PairwiseRank({
  newItem,
  existingItems,
  prompt,
  skipLabel,
  theme,
  disabled,
  onResolve,
}: PairwiseRankProps) {
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(existingItems.length);

  const mid = Math.floor((low + high) / 2);
  const opponent = existingItems[mid];

  const choose = (newWins: boolean) => {
    if (disabled) return;
    void Haptics.selectionAsync();
    const nextLow = newWins ? low : mid + 1;
    const nextHigh = newWins ? mid : high;
    if (nextLow >= nextHigh) {
      onResolve(nextLow + 1);
      return;
    }
    setLow(nextLow);
    setHigh(nextHigh);
  };

  return (
    <View>
      <AppText variant="title" color={theme.ink}>
        {prompt}
      </AppText>
      <View style={styles.cards}>
        <Pressable
          onPress={() => choose(true)}
          disabled={disabled}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.hairline,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <AppText variant="headline" color={theme.ink}>
            {newItem.label}
          </AppText>
        </Pressable>
        <AppText variant="caption" color={theme.muted} style={styles.vs}>
          or
        </AppText>
        <Pressable
          onPress={() => choose(false)}
          disabled={disabled}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.hairline,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <AppText variant="headline" color={theme.ink}>
            {opponent?.label ?? ""}
          </AppText>
        </Pressable>
      </View>
      {skipLabel ? (
        <Pressable
          onPress={() => !disabled && onResolve(existingItems.length + 1)}
          disabled={disabled}
          accessibilityRole="button"
          style={({ pressed }) => [styles.skip, { opacity: pressed ? 0.5 : 1 }]}
        >
          <AppText variant="label" color={theme.muted}>
            {skipLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { gap: space.sm, marginTop: space.lg },
  card: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  vs: { alignSelf: "center" },
  skip: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.sm,
  },
});
