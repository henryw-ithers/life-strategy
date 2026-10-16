import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { NativeSheet } from "../ui/NativeSheet";
import { TextField } from "../ui/TextField";

type Phase = "choose" | "followup";

interface CompleteGoalModalProps {
  visible: boolean;
  onClose: () => void;
  /** After it has finished closing (`NativeSheet`). */
  onDismissed?: () => void;
  goalTitle: string;
  tasks: { id: string; title: string }[];
  accent: string;
  theme: ThemeTokens;
  onArchive: () => Promise<void>;
  onMaintenance: () => Promise<void>;
  onFollowUp: (
    newTitle: string,
    taskCarry: { taskId: string; carry: boolean }[],
  ) => Promise<void>;
}

/** Completion is deliberate and celebrated — then asks what the goal
 *  leaves behind: archive its tasks, spin off a follow-up, or let the
 *  tasks continue as unit habits (ADR-0007 §2). */
export function CompleteGoalModal({
  visible,
  onClose,
  onDismissed,
  goalTitle,
  tasks,
  accent,
  theme,
  onArchive,
  onMaintenance,
  onFollowUp,
}: CompleteGoalModalProps) {
  const [phase, setPhase] = useState<Phase>("choose");
  const [newTitle, setNewTitle] = useState("");
  const [carry, setCarry] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const carries = (taskId: string): boolean => carry[taskId] ?? true;

  const reset = () => {
    setPhase("choose");
    setNewTitle("");
    setCarry({});
    setSaving(false);
  };

  // Reset as it opens, not as it closes: a reset during the closing
  // slide would snap back to the first step on screen.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) reset();
  }
  const close = onClose;

  const runArchive = () => {
    if (saving) return;
    setSaving(true);
    close();
    void onArchive();
  };

  const runMaintenance = () => {
    if (saving) return;
    setSaving(true);
    close();
    void onMaintenance();
  };

  const runFollowUp = () => {
    if (newTitle.trim().length === 0 || saving) return;
    setSaving(true);
    const committedTitle = newTitle.trim();
    const taskCarry = tasks.map((t) => ({ taskId: t.id, carry: carries(t.id) }));
    close();
    void onFollowUp(committedTitle, taskCarry);
  };

  return (
    <NativeSheet onDismissed={onDismissed}
      visible={visible}
      onClose={close}
      size={phase === "followup" ? "large" : "fit"}
      scroll={phase === "followup"}
      title={phase === "choose" ? "Goal complete" : "Follow-up goal"}
      confirm={
        phase === "followup"
          ? {
              label: "Create",
              onPress: runFollowUp,
              disabled: newTitle.trim().length === 0 || saving,
            }
          : undefined
      }
    >
      {phase === "choose" ? (
        <>
          <AppText color={theme.muted}>
            What does “{goalTitle}” leave behind?
          </AppText>

          <Pressable
            onPress={runArchive}
            disabled={saving}
            style={({ pressed }) => [
              styles.option,
              { borderColor: theme.hairline, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <AppText variant="headline" color={theme.ink}>
              Archive
            </AppText>
            <AppText variant="caption" color={theme.muted}>
              Its tasks retire with it.
            </AppText>
          </Pressable>

          <Pressable
            onPress={() => setPhase("followup")}
            disabled={saving}
            style={({ pressed }) => [
              styles.option,
              { borderColor: theme.hairline, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <AppText variant="headline" color={theme.ink}>
              Follow-up goal
            </AppText>
            <AppText variant="caption" color={theme.muted}>
              Turn it into a new goal, keeping whichever tasks still serve
              it.
            </AppText>
          </Pressable>

          <Pressable
            onPress={runMaintenance}
            disabled={saving}
            style={({ pressed }) => [
              styles.option,
              { borderColor: theme.hairline, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <AppText variant="headline" color={theme.ink}>
              Transition to maintenance
            </AppText>
            <AppText variant="caption" color={theme.muted}>
              The goal ends; its tasks continue as unit habits.
            </AppText>
          </Pressable>
        </>
      ) : (
        <>
          <TextField
            theme={theme}
            value={newTitle}
            accessibilityLabel="What comes next"
            onChangeText={setNewTitle}
            placeholder={`e.g. ${goalTitle}, next stage`}
            autoFocus
            style={styles.input}
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
                    onPress={() =>
                      setCarry((prev) => ({ ...prev, [t.id]: !carries(t.id) }))
                    }
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
            label="Back"
            variant="quiet"
            onPress={() => setPhase("choose")}
            theme={theme}
          />
        </>
      )}
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  option: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
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
