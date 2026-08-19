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

type Phase = "choose" | "followup";

interface CompleteGoalModalProps {
  visible: boolean;
  onClose: () => void;
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
  goalTitle,
  tasks,
  accent,
  theme,
  onArchive,
  onMaintenance,
  onFollowUp,
}: CompleteGoalModalProps) {
  const insets = useSafeAreaInsets();
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

  const close = () => {
    reset();
    onClose();
  };

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

          {phase === "choose" ? (
            <>
              <AppText variant="title" color={theme.ink}>
                Goal complete
              </AppText>
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

              <Button label="Cancel" variant="quiet" onPress={close} theme={theme} />
            </>
          ) : (
            <>
              <AppText variant="title" color={theme.ink}>
                Follow-up goal
              </AppText>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder={`e.g. ${goalTitle}, next stage`}
                placeholderTextColor={theme.muted}
                autoFocus
                style={[styles.input, { backgroundColor: theme.surface, color: theme.ink }]}
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
                label="Create follow-up"
                color={accent}
                disabled={newTitle.trim().length === 0 || saving}
                onPress={runFollowUp}
                theme={theme}
              />
              <Button
                label="Back"
                variant="quiet"
                onPress={() => setPhase("choose")}
                theme={theme}
              />
            </>
          )}
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
    gap: space.md,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
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
