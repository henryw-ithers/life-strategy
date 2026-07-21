import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { FrequencyPicker } from "./FrequencyPicker";

export interface ComparisonTask {
  id: string;
  title: string;
}

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  /** Active tasks sorted by rank (1 = most important). */
  existingTasks: ComparisonTask[];
  accent: string;
  theme: ThemeTokens;
  /** rank is 1-based; commits the insert. */
  onCommit: (title: string, timesPerWeek: number, rank: number) => Promise<void>;
}

type Phase = "form" | "compare";

/**
 * Task creation: title + cadence, then — when the unit already has
 * tasks — the Beli comparison ritual: "Which matters more right now?"
 * Binary insertion, ~⌈log₂(n+1)⌉ taps, no numbers typed.
 */
export function AddTaskModal({
  visible,
  onClose,
  existingTasks,
  accent,
  theme,
  onCommit,
}: AddTaskModalProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("form");
  const [title, setTitle] = useState("");
  const [timesPerWeek, setTimesPerWeek] = useState(7);
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(0);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPhase("form");
    setTitle("");
    setTimesPerWeek(7);
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  /** Close immediately; the write and reload happen behind the sheet's
   *  exit animation — the interaction never waits on the database. */
  const commit = (rank: number) => {
    if (saving) return;
    setSaving(true);
    const committedTitle = title.trim();
    const committedTimes = timesPerWeek;
    close();
    void onCommit(committedTitle, committedTimes, rank);
  };

  const startPlacement = () => {
    if (title.trim().length === 0) return;
    if (existingTasks.length === 0) {
      commit(1);
      return;
    }
    setLow(0);
    setHigh(existingTasks.length);
    setPhase("compare");
  };

  const choose = (newWins: boolean) => {
    void Haptics.selectionAsync();
    const mid = Math.floor((low + high) / 2);
    const nextLow = newWins ? low : mid + 1;
    const nextHigh = newWins ? mid : high;
    if (nextLow >= nextHigh) {
      commit(nextLow + 1);
      return;
    }
    setLow(nextLow);
    setHigh(nextHigh);
  };

  const mid = Math.floor((low + high) / 2);
  const opponent = existingTasks[mid];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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

          {phase === "form" ? (
            <>
              <AppText variant="title" color={theme.ink}>
                New task
              </AppText>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. 30 minutes of movement"
                placeholderTextColor={theme.muted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={startPlacement}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    color: theme.ink,
                  },
                ]}
              />
              <View style={styles.repeatBlock}>
                <AppText variant="caption" color={theme.muted}>
                  How often
                </AppText>
                <FrequencyPicker
                  value={timesPerWeek}
                  onChange={setTimesPerWeek}
                  accent={accent}
                  theme={theme}
                />
              </View>
              <Button
                label={existingTasks.length === 0 ? "Add task" : "Next: rank it"}
                color={accent}
                disabled={title.trim().length === 0 || saving}
                onPress={startPlacement}
                theme={theme}
              />
            </>
          ) : (
            <>
              <AppText variant="title" color={theme.ink}>
                Which matters more right now?
              </AppText>
              <View style={styles.cards}>
                <Pressable
                  onPress={() => choose(true)}
                  disabled={saving}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.hairline,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <AppText variant="headline" color={theme.ink}>
                    {title.trim()}
                  </AppText>
                </Pressable>
                <AppText variant="caption" color={theme.muted} style={styles.vs}>
                  or
                </AppText>
                <Pressable
                  onPress={() => choose(false)}
                  disabled={saving}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.hairline,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <AppText variant="headline" color={theme.ink}>
                    {opponent?.title ?? ""}
                  </AppText>
                </Pressable>
              </View>
              <Pressable
                onPress={() => commit(existingTasks.length + 1)}
                disabled={saving}
                accessibilityRole="button"
                style={({ pressed }) => [styles.skipLast, { opacity: pressed ? 0.5 : 1 }]}
              >
                <AppText variant="label" color={theme.muted}>
                  Skip — rank it last
                </AppText>
              </Pressable>
            </>
          )}

          <Button label="Cancel" variant="quiet" onPress={close} theme={theme} />
        </View>
      </KeyboardAvoidingView>
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
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  repeatBlock: { gap: space.sm },
  cards: { gap: space.sm },
  skipLast: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  vs: { alignSelf: "center" },
});
