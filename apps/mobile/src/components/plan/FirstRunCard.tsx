/**
 * Shown on a fresh plan — the diagnostic is done and nothing spends its
 * points yet. Teaches the screen instead of leaving eighteen rows of
 * zero to be interpreted, and sits above the list rather than replacing
 * it, so the weights just earned stay visible while you read what to do
 * with them.
 */
import { StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

export function FirstRunCard({
  topUnitName,
  onAddToTopUnit,
  theme,
}: {
  /** The unit holding the most points, where a first task is worth the
   *  most; null when there is none to suggest. */
  topUnitName: string | null;
  onAddToTopUnit: () => void;
  theme: ThemeTokens;
}) {
  return (
    <View style={[styles.card, { borderColor: theme.hairline }]}>
      <AppText variant="headline" color={theme.ink}>
        Your points are all unspent
      </AppText>
      <AppText color={theme.muted}>
        Every part of your life below holds a share of your daily 100. A task earns those points
        when you tick it off, so nothing counts until you add some.
      </AppText>
      {topUnitName ? (
        <Button label={`Add a task to ${topUnitName}`} onPress={onAddToTopUnit} theme={theme} />
      ) : null}
      <AppText variant="caption" color={theme.muted}>
        {topUnitName
          ? `${topUnitName} carries the most points, so it's the best place to start. Any unit works.`
          : "Open any unit below to add one."}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Outlined rather than surface-filled: the area groups below own the
   *  filled look, and a filled block above them reads as a nested card. */
  card: {
    marginTop: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
});
