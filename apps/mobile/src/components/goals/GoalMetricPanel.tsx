/**
 * A metric goal's progress, on the goal detail screen (ADR-0015 §§1–4).
 *
 * **Nothing here appears on the daily checklist** (§6). Etkin's
 * experiments measured *continuous output display* — the count in front
 * of you while you do the thing — and that is exactly what a progress
 * bar on Today would be. A target you visit when you choose to is a
 * different object, which is why metric goals are a legitimate shape at
 * all. This panel lives where you came to look at it.
 */
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import {
  barFraction,
  metricState,
  milestonesReached,
  type MetricKind,
} from "@glide/scoring";
import type { GoalMilestone, GoalProgressEntry } from "../../db/goals";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "October 2026" from `'2026-10'`. */
export function formatTargetMonth(ym: string): string {
  const month = MONTH_NAMES[Number(ym.slice(5, 7)) - 1];
  return month ? `${month} ${ym.slice(0, 4)}` : ym;
}

/** Trims a float without printing "5.0" for whole numbers. */
function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

interface GoalMetricPanelProps {
  kind: MetricKind;
  unit: string | null;
  targetValue: number;
  targetDate: string | null;
  entries: GoalProgressEntry[];
  /** For the rung prompt (ADR-0015 §5). */
  milestones: GoalMilestone[];
  editable: boolean;
  accent: string;
  theme: ThemeTokens;
  onAdd: (value: number, note: string | null) => void;
  onDelete: (entryId: string) => void;
  onEdit: () => void;
  /** Reaching a target *invites* completion; it never performs it
   *  (ADR-0015 §3). Routes into ADR-0007 §2's three-path exit. */
  onComplete: () => void;
  /** Advance a rung the readings have passed. Also a prompt, never
   *  automatic. */
  onAdvanceMilestone: (milestoneId: string) => void;
}

export function GoalMetricPanel({
  kind,
  unit,
  targetValue,
  targetDate,
  entries,
  milestones,
  editable,
  accent,
  theme,
  onAdd,
  onDelete,
  onEdit,
  onComplete,
  onAdvanceMilestone,
}: GoalMetricPanelProps) {
  const [draft, setDraft] = useState("");
  const def = { kind, targetValue };
  const state = metricState(def, entries);
  const width = barFraction(state);
  const label = unit ?? "";

  // The rung the readings have reached but the user hasn't ticked.
  // Only the *current* one: advancing is sequential (ADR-0007 §3), so
  // offering a later rung would skip the ones between it.
  const current = milestones.find((m) => m.status === "current");
  const passed =
    current && current.targetValue !== null
      ? milestonesReached(def, state, [
          { id: current.id, targetValue: current.targetValue },
        ]).length > 0
      : false;

  const value = Number(draft);
  const canAdd = draft.trim().length > 0 && Number.isFinite(value);

  const add = () => {
    if (!canAdd) return;
    onAdd(value, null);
    setDraft("");
  };

  return (
    <View style={[styles.section, { borderTopColor: theme.hairline }]}>
      <View style={styles.head}>
        <AppText variant="headline" color={theme.ink}>
          Progress
        </AppText>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="Edit how this goal is measured"
          hitSlop={8}
        >
          <AppText variant="caption" color={accent}>
            Edit
          </AppText>
        </Pressable>
      </View>

      {/* Before the first reading a target goal has no starting point,
          so it states the target instead of drawing a bar from an
          invented zero (ADR-0015 §1). */}
      <AppText variant="display" color={theme.ink} tabular>
        {state.current === null
          ? `${num(targetValue)} ${label}`.trim()
          : `${num(state.current)} / ${num(targetValue)} ${label}`.trim()}
      </AppText>

      {width !== null ? (
        <View
          style={[styles.track, { backgroundColor: theme.surface }]}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(width * 100),
          }}
        >
          <View
            style={[
              styles.fill,
              { backgroundColor: accent, width: `${width * 100}%` },
            ]}
          />
        </View>
      ) : (
        <AppText variant="caption" color={theme.muted}>
          Log your first reading and this starts tracking.
        </AppText>
      )}

      {/* Celebration may condition on a positive event (ADR-0008); the
          absence of one is never remarked on. And it is an invitation,
          never an action: "I benched 225 once" and "I am now a person
          who benches 225" are different claims, and only the user
          knows which happened (ADR-0015 §3). */}
      {state.met && editable ? (
        <View style={styles.invite}>
          <AppText variant="label" color={accent}>
            Target reached.
          </AppText>
          <Button
            label="Complete this goal"
            color={accent}
            onPress={onComplete}
            theme={theme}
          />
        </View>
      ) : state.met ? (
        <AppText variant="label" color={accent}>
          Target reached.
        </AppText>
      ) : null}

      {passed && current && editable ? (
        <View style={styles.invite}>
          <AppText variant="caption" color={theme.muted}>
            Your readings have passed “{current.title}”.
          </AppText>
          <Button
            label="Mark it done"
            variant="quiet"
            onPress={() => onAdvanceMilestone(current.id)}
            theme={theme}
          />
        </View>
      ) : null}

      {targetDate ? (
        <AppText variant="caption" color={theme.muted}>
          Aiming for {formatTargetMonth(targetDate)}
        </AppText>
      ) : null}

      {editable ? (
        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={kind === "cumulative" ? "Add" : "Latest"}
            placeholderTextColor={theme.muted}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={add}
            accessibilityLabel={
              kind === "cumulative" ? "How much to add" : "Your latest reading"
            }
            style={[
              styles.input,
              { backgroundColor: theme.surface, color: theme.ink },
            ]}
          />
          <Pressable
            onPress={add}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityLabel="Log this reading"
            accessibilityState={{ disabled: !canAdd }}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: accent,
                opacity: !canAdd ? 0.35 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText variant="label" color={theme.onAccent}>
              Log
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {entries.length > 0 ? (
        <View style={styles.entries}>
          {[...entries].reverse().map((e) => (
            <Pressable
              key={e.id}
              onLongPress={editable ? () => onDelete(e.id) : undefined}
              accessibilityRole="button"
              accessibilityLabel={`${num(e.value)} ${label} on ${e.localDate}${
                e.source === "task" ? ", counted from a task" : ""
              }`}
              accessibilityHint={editable ? "Press and hold to delete" : undefined}
              style={[styles.entryRow, { borderTopColor: theme.hairline }]}
            >
              <AppText variant="caption" color={theme.muted} tabular>
                {e.localDate}
              </AppText>
              {/* Auto-counted rows are marked, so a number the app added
                  on your behalf is never mistaken for one you typed
                  (ADR-0015 §2). */}
              {e.source === "task" ? (
                <AppText variant="footnote" color={theme.muted}>
                  from a task
                </AppText>
              ) : null}
              <AppText variant="label" color={theme.ink} tabular style={styles.entryValue}>
                {kind === "cumulative" ? `+${num(e.value)}` : num(e.value)}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.lg,
    marginTop: space.lg,
    gap: space.sm,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  track: { height: 10, borderRadius: 5, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5 },
  invite: { gap: space.sm, marginTop: space.xs },
  addRow: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  input: {
    ...typeScale.body,
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  addButton: {
    minWidth: 72,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  entries: { marginTop: space.xs },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  entryValue: { marginLeft: "auto" },
});
