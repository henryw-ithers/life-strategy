/**
 * "Do N of these" (ADR-0039 §6, ADR-0033 §3): two or three tasks from
 * one commitment, pinned in one window, any N of which satisfy it. The
 * planned count divides the commitment's share, so this is one of the
 * two things about windows that can change a score (ADR-0039 §12).
 *
 * Only commitment work due that day is offered: its tasks are worth the
 * same, so the choice is free and never made by the points.
 */
import { MAX_CHOICE_TASKS } from "../../db/commitmentPlan";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { TodayTask } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { NativeSheet } from "../ui/NativeSheet";

interface ChoiceSheetProps {
  visible: boolean;
  windowLabel: string;
  /** Commitment work due that day, in or offered to this window. */
  candidates: readonly TodayTask[];
  /** The choice already in the window, if any. */
  initial?: { taskIds: readonly string[]; plannedCount: number };
  hueFor: (t: TodayTask) => string;
  theme: ThemeTokens;
  onClose: () => void;
  onDismissed?: () => void;
  /** Resolves to a problem to show, or null once saved. */
  onSave: (taskIds: string[], plannedCount: number) => Promise<string | null>;
  onRemove?: () => void;
}

export function ChoiceSheet({
  visible,
  windowLabel,
  candidates,
  initial,
  hueFor,
  theme,
  onClose,
  onDismissed,
  onSave,
  onRemove,
}: ChoiceSheetProps) {
  const [chosen, setChosen] = useState<string[]>([...(initial?.taskIds ?? [])]);
  const [count, setCount] = useState(initial?.plannedCount ?? 1);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setChosen([...(initial?.taskIds ?? [])]);
      setCount(initial?.plannedCount ?? 1);
      setProblem(null);
      setSaving(false);
    }
  }

  const toggle = (id: string) =>
    setChosen((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_CHOICE_TASKS ? c : [...c, id],
    );
  const planned = Math.max(1, Math.min(count, Math.max(1, chosen.length)));
  const ready = chosen.length >= 2;

  const save = async () => {
    if (saving || !ready) return;
    setSaving(true);
    const said = await onSave(chosen, planned);
    setSaving(false);
    setProblem(said);
  };

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      dismissible={!saving}
      title="Do N of these"
      confirm={{ label: "Save", onPress: () => void save(), disabled: saving || !ready }}
    >
      <AppText variant="caption" color={theme.muted}>
        Pick two or three from one commitment for {windowLabel}. Any of them counts.
      </AppText>
      {candidates.length < 2 ? (
        <AppText color={theme.muted}>
          This needs at least two pieces of commitment work due that day.
        </AppText>
      ) : (
        candidates.map((t) => {
          const on = chosen.includes(t.id);
          return (
            <Pressable
              key={t.id}
              onPress={() => toggle(t.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t.title}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.5 : 1 }]}
            >
              <View
                style={[
                  styles.box,
                  { borderColor: hueFor(t), backgroundColor: on ? hueFor(t) : "transparent" },
                ]}
              />
              <AppText variant="body" color={theme.ink} style={styles.grow} numberOfLines={2}>
                {t.title}
              </AppText>
            </Pressable>
          );
        })
      )}
      {ready ? (
        <View style={styles.row}>
          <AppText variant="body" color={theme.ink} style={styles.grow}>
            Do {planned} of {chosen.length}
          </AppText>
          <Button
            variant="secondary"
            label="−"
            onPress={() => setCount(Math.max(1, planned - 1))}
            disabled={planned <= 1}
            theme={theme}
          />
          <Button
            variant="secondary"
            label="+"
            onPress={() => setCount(Math.min(chosen.length, planned + 1))}
            disabled={planned >= chosen.length}
            theme={theme}
          />
        </View>
      ) : null}
      {problem ? (
        <AppText variant="caption" color={theme.ink} accessibilityRole="alert">
          {problem}
        </AppText>
      ) : null}
      {onRemove ? (
        <Button variant="quiet" label="Remove the choice" onPress={onRemove} theme={theme} />
      ) : null}
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  box: { width: 20, height: 20, borderRadius: radius.sm / 2, borderWidth: 2 },
  grow: { flex: 1 },
});
