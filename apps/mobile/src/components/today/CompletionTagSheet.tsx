/**
 * Who you were with, on one completed task (ADR-0025 §4).
 *
 * Reached by press-and-hold on a completed row — never by a prompt.
 * A prompt after every tick would put a second decision on the daily
 * surface, and the daily surface is a checklist openable and closable
 * in under a minute (PRODUCT.md design principle 2). Long-press is
 * already this app's gesture for secondary actions on a row, so it is
 * vocabulary the user has.
 *
 * **Units, never named people.** That is an explicit non-goal of
 * ADR-0025 §4, not an unbuilt feature: tagging a unit records a fact
 * about the user, while tagging a person would create records about
 * someone who never agreed to be in this database. The app's privacy
 * story fits in one sentence because everything in it is self-reported
 * about the self, and a person graph would end that.
 */
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

export interface TaggableUnit {
  id: string;
  name: string;
  areaId: string;
}

interface CompletionTagSheetProps {
  visible: boolean;
  taskTitle: string;
  units: TaggableUnit[];
  selected: readonly string[];
  areaColors: Record<string, string>;
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  onSave: (unitIds: string[]) => void;
}

export function CompletionTagSheet({
  visible,
  taskTitle,
  units,
  selected,
  areaColors,
  accent,
  theme,
  onClose,
  onSave,
}: CompletionTagSheetProps) {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<string[]>([...selected]);

  const toggle = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.canvas,
            borderColor: theme.hairline,
            paddingBottom: insets.bottom + space.lg,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.hairline }]} />

        <View style={styles.head}>
          <AppText variant="title" color={theme.ink}>
            Who were you with?
          </AppText>
          <AppText variant="footnote" color={theme.muted} numberOfLines={1}>
            {taskTitle}
          </AppText>
        </View>

        <View style={styles.chips}>
          {units.map((u) => {
            const on = picked.includes(u.id);
            const hue = areaColors[u.areaId] ?? accent;
            return (
              <Pressable
                key={u.id}
                onPress={() => toggle(u.id)}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={u.name}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: on ? hue : theme.surface,
                    borderColor: on ? hue : theme.hairline,
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <AppText variant="label" color={on ? theme.onAccent : theme.ink}>
                  {u.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Says what the tag is for without implying it is owed. The
            line reads the same whether nothing is picked or everything
            is (the ambient-kindness test, ADR-0008). */}
        <AppText variant="footnote" color={theme.muted}>
          Noting company here shapes your portfolio, not your score.
        </AppText>

        <Button
          label="Done"
          color={accent}
          onPress={() => {
            onSave(picked);
            onClose();
          }}
          theme={theme}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: SCRIM },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.sm + 2,
    gap: space.lg,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  head: { gap: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
