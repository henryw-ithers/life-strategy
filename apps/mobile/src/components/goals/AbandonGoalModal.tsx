import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";

type TaskAction = "detach" | "archive";

interface AbandonGoalModalProps {
  visible: boolean;
  onClose: () => void;
  /** After it has finished closing (`NativeSheet`). */
  onDismissed?: () => void;
  goalTitle: string;
  tasks: { id: string; title: string }[];
  accent: string;
  theme: ThemeTokens;
  onCommit: (decisions: { taskId: string; action: TaskAction }[]) => Promise<void>;
}

/** Abandon is revivable, never a failure — copy stays neutral by rule
 *  ("set aside," never "failed"; ADR-0007 §1). Detach is the default
 *  per task since it's the least destructive choice. */
export function AbandonGoalModal({
  visible,
  onClose,
  onDismissed,
  goalTitle,
  tasks,
  accent,
  theme,
  onCommit,
}: AbandonGoalModalProps) {
  const [actions, setActions] = useState<Record<string, TaskAction>>({});
  const [saving, setSaving] = useState(false);

  const actionFor = (taskId: string): TaskAction => actions[taskId] ?? "detach";

  const close = () => {
    setActions({});
    setSaving(false);
    onClose();
  };

  const commit = () => {
    if (saving) return;
    setSaving(true);
    const decisions = tasks.map((t) => ({ taskId: t.id, action: actionFor(t.id) }));
    close();
    void onCommit(decisions);
  };

  return (
    <NativeSheet onDismissed={onDismissed}
      visible={visible}
      onClose={close}
      title="Set aside"
      confirm={{ label: "Set aside", onPress: commit, disabled: saving }}
    >
      <AppText color={theme.muted}>
        “{goalTitle}” can be revived anytime, and it keeps its history. Its
        tasks: keep them as unit habits, or remove them too.
      </AppText>
      {tasks.length > 0 ? (
        <ScrollView style={styles.list}>
          {tasks.map((t) => (
            <View key={t.id} style={[styles.row, { borderTopColor: theme.hairline }]}>
              <AppText color={theme.ink} style={styles.grow} numberOfLines={2}>
                {t.title}
              </AppText>
              <View style={styles.segment}>
                <Pressable
                  onPress={() => setActions((prev) => ({ ...prev, [t.id]: "detach" }))}
                  accessibilityRole="button"
                  style={[
                    styles.segmentOption,
                    {
                      backgroundColor:
                        actionFor(t.id) === "detach" ? `${accent}1f` : "transparent",
                    },
                  ]}
                >
                  <AppText variant="footnote" color={theme.ink}>
                    Keep
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => setActions((prev) => ({ ...prev, [t.id]: "archive" }))}
                  accessibilityRole="button"
                  style={[
                    styles.segmentOption,
                    {
                      backgroundColor:
                        actionFor(t.id) === "archive" ? `${theme.danger}1f` : "transparent",
                    },
                  ]}
                >
                  <AppText variant="footnote" color={theme.ink}>
                    Remove
                  </AppText>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 260 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1 },
  segment: { flexDirection: "row", gap: space.xs },
  segmentOption: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.pill,
  },
});
