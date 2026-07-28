/**
 * Choosing which units a task serves (ADR-0019).
 *
 * Chips rather than a nested list or a second modal: the whole point of
 * the change is that linking a second unit should cost one tap, and
 * anything that opens a new surface to do it has already lost. The
 * home unit — the one the task is listed under — is whichever chip is
 * selected first, and it's labelled so that isn't a hidden rule.
 */
import { ScrollView, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Pressable } from "react-native";

export interface PickableUnit {
  id: string;
  name: string;
  areaId: string;
}

interface UnitPickerProps {
  units: PickableUnit[];
  /** Selected ids, in selection order; index 0 is the home unit. */
  value: string[];
  onChange: (next: string[]) => void;
  theme: ThemeTokens;
  areaColors: Record<string, string>;
  /** Cap; a task serving everything is a task serving nothing. */
  max?: number;
}

const DEFAULT_MAX = 3;

export function UnitPicker({
  units,
  value,
  onChange,
  theme,
  areaColors,
  max = DEFAULT_MAX,
}: UnitPickerProps) {
  const toggle = (id: string) => {
    if (value.includes(id)) {
      // Never leave a task homeless — the last chip can't be cleared.
      if (value.length === 1) return;
      onChange(value.filter((v) => v !== id));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, id]);
  };

  const atMax = value.length >= max;

  return (
    <View style={styles.root}>
      <View style={styles.headingRow}>
        <AppText variant="caption" color={theme.muted}>
          {value.length > 1 ? "Counts toward" : "Unit"}
        </AppText>
        {value.length > 1 ? (
          <AppText variant="footnote" color={theme.muted}>
            Earns from each · listed under {nameOf(units, value[0])}
          </AppText>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {units.map((u) => {
          const index = value.indexOf(u.id);
          const selected = index >= 0;
          const hue = areaColors[u.areaId] ?? theme.accent;
          const locked = selected && value.length === 1;
          const blocked = !selected && atMax;
          return (
            <Pressable
              key={u.id}
              onPress={() => toggle(u.id)}
              disabled={locked || blocked}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: locked || blocked }}
              accessibilityLabel={
                selected && index === 0 ? `${u.name}, listed under this unit` : u.name
              }
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected ? hue : theme.surface,
                  borderColor: selected ? hue : theme.hairline,
                  opacity: blocked ? 0.35 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <AppText
                variant="label"
                color={selected ? theme.onAccent : theme.ink}
                numberOfLines={1}
              >
                {u.name}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      {atMax ? (
        <AppText variant="footnote" color={theme.muted}>
          Up to {max} units — past that, it isn't really one task.
        </AppText>
      ) : null}
    </View>
  );
}

function nameOf(units: PickableUnit[], id: string | undefined): string {
  return units.find((u) => u.id === id)?.name ?? "";
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  headingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.sm,
  },
  chips: { gap: space.sm, paddingRight: space.sm },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 190,
  },
});
