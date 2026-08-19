import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

interface ReviseGoalModalProps {
  visible: boolean;
  onClose: () => void;
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
  goalTitle,
  goalDescription,
  tasks,
  accent,
  theme,
  onCommit,
}: ReviseGoalModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(goalTitle);
  const [description, setDescription] = useState(goalDescription ?? "");
  const [carry, setCarry] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const carries = (taskId: string): boolean => carry[taskId] ?? true;

  const close = () => {
    setTitle(goalTitle);
    setDescription(goalDescription ?? "");
    setCarry({});
    setSaving(false);
    onClose();
  };

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <SheetFrame onClose={close} avoidsKeyboard>
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
          <AppText variant="title" color={theme.ink}>
            Re-scope this goal
          </AppText>
          <AppText color={theme.muted}>
            “{goalTitle}” closes as revised; this becomes its successor.
          </AppText>
          <TextInput
            value={title}
            accessibilityLabel="Goal"
            onChangeText={setTitle}
            placeholderTextColor={theme.muted}
            autoFocus
            returnKeyType="next"
            style={[styles.input, { backgroundColor: theme.surface, color: theme.ink }]}
          />
          <TextInput
            value={description}
            accessibilityLabel="Notes, optional"
            onChangeText={setDescription}
            placeholder="Notes (optional)"
            placeholderTextColor={theme.muted}
            multiline
            style={[
              styles.input,
              styles.description,
              { backgroundColor: theme.surface, color: theme.ink },
            ]}
          />

          {tasks.length > 0 ? (
            <>
              <AppText variant="caption" color={theme.muted}>
                Carry these tasks to the new goal
              </AppText>
              <ScrollView style={styles.list}>
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

          <Button
            label="Save as new goal"
            color={accent}
            disabled={title.trim().length === 0 || saving}
            onPress={commit}
            theme={theme}
          />
          <Button label="Cancel" variant="quiet" onPress={close} theme={theme} />
        </View>
      </SheetFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.sm + 2,
    gap: space.lg,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
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
