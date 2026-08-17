/**
 * Where else a completed task counts (ADR-0025 §4).
 *
 * Reached by press-and-hold on a completed row — never by a prompt.
 * A prompt after every tick would put a second decision on the daily
 * surface, and the daily surface is a checklist openable and closable
 * in under a minute (PRODUCT.md design principle 2). Long-press is
 * already this app's gesture for secondary actions on a row, so it is
 * vocabulary the user has.
 *
 * **This asks about categories, not about people.** The question is
 * the same one `ActivitySheet` already asks — *where does this count?*
 * — and the wording deliberately matches it. An earlier draft framed
 * it as "who were you with", which described the feature as tracking
 * other people even though nothing about a person is stored. Recording
 * that an hour counted toward Family is a fact about the user's own
 * life; asking them to name who was there is not, and the app must not
 * suggest it. If someone wants to write a name in a journal entry that
 * is theirs to do — but nothing here invites it.
 *
 * **Units, never named people**, is an explicit non-goal of ADR-0025
 * §4: a person graph would create records about someone who never
 * agreed to be in this database, and the app's privacy story fits in
 * one sentence precisely because everything in it is self-reported
 * about the self.
 */
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SCRIM, wash, type ThemeTokens } from "../../theme/colors";
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
          {/* Matches ActivitySheet's "Where it counts", because it is
              the same question about the same thing. */}
          <AppText variant="title" color={theme.ink}>
            Where else it counts
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
                    backgroundColor: on ? wash(hue, theme) : theme.surface,
                    borderColor: on ? hue : theme.hairline,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <AppText variant="label" color={theme.ink}>
                  {u.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* States the earning rule, because it is not obvious that one
            mark is enough (ADR-0025 §3). Reads the same whether nothing
            is picked or everything is — the ambient-kindness test. */}
        <AppText variant="footnote" color={theme.muted}>
          A day that counts toward one of these earns it in full.
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
