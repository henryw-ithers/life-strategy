/**
 * One unit on Priorities, without dragging (WCAG 2.2 SC 2.5.7): its
 * tier, its place in the tier, and your own weight for it.
 *
 * The recommended weight stays on screen beside whatever you type
 * (AGENTS.md: every override shows the recommended value), and an empty
 * field means the recommended one. Tier and weight apply on Save; Move
 * up and Move down act on the board straight away, as a drag would.
 * Nothing is stored until Done on Priorities saves the whole board.
 */
import { TIERS, type Tier } from "@glide/scoring";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { Segmented } from "../plan/Segmented";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { NativeSheet } from "../ui/NativeSheet";
import { TextField } from "../ui/TextField";

export const TIER_LABEL: Record<Tier, string> = {
  top: "Top",
  important: "Important",
  background: "Background",
  notNow: "Not now",
};

interface UnitSheetProps {
  visible: boolean;
  unitName: string;
  tier: Tier;
  recommended: number;
  override: number | null;
  /** Whether it can move within its tier. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  theme: ThemeTokens;
  onMove: (delta: -1 | 1) => void;
  /** The weight is a whole number from 1 to 99, or null for the
   *  recommended one. Ignored in Not now, which has no weight. */
  onSave: (next: { tier: Tier; override: number | null }) => void;
  onClose: () => void;
  onDismissed?: () => void;
}

/** The typed value as an override, or undefined when it isn't one. */
function parse(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return n >= 1 && n <= 99 ? n : undefined;
}

export function UnitSheet({
  visible,
  unitName,
  tier: startTier,
  recommended,
  override,
  canMoveUp,
  canMoveDown,
  theme,
  onMove,
  onSave,
  onClose,
  onDismissed,
}: UnitSheetProps) {
  const [tier, setTier] = useState<Tier>(startTier);
  const [text, setText] = useState(override === null ? "" : String(override));
  const value = parse(text);
  const empty = text.trim() === "";
  const planned = tier !== "notNow";
  const bad = planned && !empty && value === undefined;

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      title={unitName}
      confirm={{
        label: "Save",
        disabled: bad,
        onPress: () => {
          onSave({ tier, override: planned && !empty ? (value ?? null) : null });
          onClose();
        },
      }}
    >
      <View style={styles.body}>
        <Segmented
          segments={TIERS.map((t) => ({ value: t, label: TIER_LABEL[t] }))}
          value={tier}
          onChange={setTier}
          accent={theme.accent}
          theme={theme}
          label="Tier"
        />
        {tier === startTier ? (
          <View style={styles.moves}>
            <Button
              variant="tonal"
              icon="arrow-up"
              label="Move up"
              disabled={!canMoveUp}
              onPress={() => onMove(-1)}
              theme={theme}
            />
            <Button
              variant="tonal"
              icon="arrow-down"
              label="Move down"
              disabled={!canMoveDown}
              onPress={() => onMove(1)}
              theme={theme}
            />
          </View>
        ) : null}

        {planned ? (
          <>
            <AppText color={theme.ink}>
              {tier === startTier ? `Recommended: ${recommended}` : "Your own weight, if you want one"}
            </AppText>
            <TextField
              theme={theme}
              value={text}
              onChangeText={setText}
              keyboardType="number-pad"
              placeholder={tier === startTier ? String(recommended) : "Recommended"}
              accessibilityLabel={`Your weight for ${unitName}`}
              accessibilityHint={
                tier === startTier
                  ? `Recommended is ${recommended}. Leave empty to use it.`
                  : "Leave empty to use the recommended weight."
              }
              maxLength={2}
            />
            <AppText variant="footnote" color={theme.muted}>
              {bad
                ? "A whole number from 1 to 99."
                : "Your other units share what's left, so the plan still adds up to 100. This is a guideline, not a verdict."}
            </AppText>
            {override !== null ? (
              <Button
                variant="quiet"
                label="Use recommended"
                onPress={() => setText("")}
                theme={theme}
              />
            ) : null}
          </>
        ) : (
          <AppText variant="footnote" color={theme.muted}>
            Not now is out of your plan: no weight and no tasks. Its tasks are paused when you
            save, and come back if you move it up again.
          </AppText>
        )}
      </View>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  moves: { flexDirection: "row", gap: space.sm },
});
