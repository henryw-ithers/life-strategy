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
import { PairwiseRank } from "../ui/PairwiseRank";
import { FrequencyPicker } from "./FrequencyPicker";
import { UnitPicker, type PickableUnit } from "./UnitPicker";

export interface ComparisonTask {
  id: string;
  title: string;
}

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  /** Active tasks sorted by rank (1 = most important). */
  existingTasks: ComparisonTask[];
  /** Every scoreable unit, for linking the task to more than one. */
  units: PickableUnit[];
  /** The unit this was opened from — the default home unit. */
  homeUnitId: string;
  areaColors: Record<string, string>;
  accent: string;
  theme: ThemeTokens;
  /** rank is 1-based and applies to `unitIds[0]`, the home unit. */
  onCommit: (
    title: string,
    timesPerWeek: number,
    rank: number,
    unitIds: string[],
  ) => Promise<void>;
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
  units,
  homeUnitId,
  areaColors,
  accent,
  theme,
  onCommit,
}: AddTaskModalProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("form");
  const [title, setTitle] = useState("");
  const [timesPerWeek, setTimesPerWeek] = useState(7);
  const [unitIds, setUnitIds] = useState<string[]>([homeUnitId]);
  const [placementKey, setPlacementKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPhase("form");
    setTitle("");
    setTimesPerWeek(7);
    setUnitIds([homeUnitId]);
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
    const committedUnits = unitIds;
    close();
    void onCommit(committedTitle, committedTimes, rank, committedUnits);
  };

  const startPlacement = () => {
    if (title.trim().length === 0) return;
    if (existingTasks.length === 0) {
      commit(1);
      return;
    }
    setPlacementKey((k) => k + 1);
    setPhase("compare");
  };

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
              <UnitPicker
                units={units}
                value={unitIds}
                onChange={setUnitIds}
                theme={theme}
                areaColors={areaColors}
              />
              <Button
                label={existingTasks.length === 0 ? "Add task" : "Next: rank it"}
                color={accent}
                disabled={title.trim().length === 0 || saving}
                onPress={startPlacement}
                theme={theme}
              />
            </>
          ) : (
            <PairwiseRank
              key={placementKey}
              newItem={{ id: "new", label: title.trim() }}
              existingItems={existingTasks.map((t) => ({ id: t.id, label: t.title }))}
              prompt="Which matters more right now?"
              skipLabel="Skip — rank it last"
              theme={theme}
              disabled={saving}
              onResolve={commit}
            />
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
});
