import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";
import { TextField } from "../ui/TextField";

interface ReviseGoalModalProps {
  visible: boolean;
  onClose: () => void;
  /** After it has finished closing (`NativeSheet`). */
  onDismissed?: () => void;
  goalTitle: string;
  goalDescription: string | null;
  tasks: { id: string; title: string }[];
  accent: string;
  theme: ThemeTokens;
  onCommit: (
    newTitle: string,
    newDescription: string | undefined,
    taskCarry: { taskId: string; carry: boolean }[],
  ) => Promise<void>;
}

/** Revise never mutates — it closes this goal as `revised` and opens a
 *  new, linked one. Both stay in the log, honestly (ADR-0007 §1). */
export function ReviseGoalModal({
  visible,
  onClose,
  onDismissed,
  goalTitle,
  goalDescription,
  tasks,
  accent,
  theme,
  onCommit,
}: ReviseGoalModalProps) {
  const [title, setTitle] = useState(goalTitle);
  const [description, setDescription] = useState(goalDescription ?? "");
  const [carry, setCarry] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const carries = (taskId: string): boolean => carry[taskId] ?? true;

  // Reset as it opens, not as it closes, so nothing changes on screen
  // while it slides away.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setTitle(goalTitle);
      setDescription(goalDescription ?? "");
      setCarry({});
      setSaving(false);
    }
  }
  const close = onClose;

  const commit = () => {
    if (title.trim().length === 0 || saving) return;
    setSaving(true);
    const committedTitle = title.trim();
    const committedDescription =
      description.trim().length > 0 ? description.trim() : undefined;
    const taskCarry = tasks.map((t) => ({ taskId: t.id, carry: carries(t.id) }));
    close();
    void onCommit(committedTitle, committedDescription, taskCarry);
  };

  return (
    <NativeSheet onDismissed={onDismissed}
      visible={visible}
      onClose={close}
      size="large"
      scroll
      title="Re-scope this goal"
      // Not "Save": this closes the goal and starts its successor.
      confirm={{ label: "Re-scope", onPress: commit, disabled: title.trim().length === 0 || saving }}
    >
      <AppText color={theme.muted}>
        “{goalTitle}” closes as revised; this becomes its successor.
      </AppText>
      <TextField
        theme={theme}
        value={title}
        accessibilityLabel="Goal"
        onChangeText={setTitle}
        autoFocus
        returnKeyType="next"
        style={styles.input}
      />
      <TextField
        theme={theme}
        value={description}
        accessibilityLabel="Notes, optional"
        onChangeText={setDescription}
        placeholder="Notes (optional)"
        multiline
        style={[styles.input, styles.description]}
      />

      {tasks.length > 0 ? (
        <>
          <AppText variant="caption" color={theme.muted}>
            Carry these tasks to the new goal
          </AppText>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {tasks.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setCarry((prev) => ({ ...prev, [t.id]: !carries(t.id) }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: carries(t.id) }}
                style={[styles.row, { borderTopColor: theme.hairline }]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: accent,
                      backgroundColor: carries(t.id) ? accent : "transparent",
                    },
                  ]}
                />
                <AppText color={theme.ink} style={styles.grow} numberOfLines={2}>
                  {t.title}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  description: { minHeight: 64, paddingTop: space.sm, textAlignVertical: "top" },
  list: { maxHeight: 200 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2 },
});
