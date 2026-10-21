/**
 * Making a goal (spec §5.6, ADR-0042): optional, and always built on
 * something the app can count. Pick where it lives (unless you came
 * from there), then a template or "Start from scratch", then the sheet
 * asks only what that kind needs:
 *
 * - **Times done**: which tasks' ticks count.
 * - **Time spent**: tasks you choose, or everything here.
 * - **Points earned**: nothing; the whole unit counts, as a running
 *   total.
 * - **Streak**: one every-day task. No target and nothing to finish.
 *
 * An end date is a month, never a day (ADR-0015 §4), and optional.
 * Nothing here grades a day.
 */
import {
  addDays,
  goalProblem,
  type GoalKind,
  type GoalMeasure,
  type GoalTaskFacts,
} from "@glide/scoring";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { goalTemplatesFor, titleWith, type GoalTemplate } from "../../content/goalTemplates";
import { createGoal, loadGoalTaskOptions, type GoalTaskOption } from "../../db/goals";
import { currentLocalDate } from "../../lib/calendar";
import { recordProblem } from "../../lib/problemLog";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { Segmented } from "../plan/Segmented";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";
import { TextField } from "../ui/TextField";
import { KIND_LABEL } from "./goalText";

export interface GoalUnit {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly commitment: boolean;
}

interface GoalSheetProps {
  visible: boolean;
  /** Where it lives, when opened from a unit or commitment; otherwise
   *  the sheet asks first. */
  unit?: GoalUnit;
  /** What it can live in, for that first question. */
  units: readonly GoalUnit[];
  theme: ThemeTokens;
  onClose: () => void;
  onDismissed?: () => void;
  onSaved: (goalId: string) => void;
}

/** Where a kind's target starts when you switch to it. */
const DEFAULT_TARGET: Record<GoalKind, number> = {
  timesDone: 20,
  timeSpent: 20,
  pointsEarned: 300,
  streak: 1,
};

const KINDS: { value: GoalKind; label: string }[] = [
  { value: "timesDone", label: "Times" },
  { value: "timeSpent", label: "Time" },
  { value: "pointsEarned", label: "Points" },
  { value: "streak", label: "Streak" },
];

/** The next 12 months, `YYYY-MM`, for "by when". */
function nextMonths(today: string): string[] {
  const out: string[] = [];
  let d = today;
  while (out.length < 12) {
    const m = d.slice(0, 7);
    if (!out.includes(m)) out.push(m);
    d = addDays(d, 28);
  }
  return out;
}

const monthLabel = (m: string) =>
  new Date(`${m}-15T12:00:00`).toLocaleDateString("en-AU", { month: "short", year: "numeric" });

export function GoalSheet({ visible, unit: given, units, theme, onClose, onDismissed, onSaved }: GoalSheetProps) {
  const [unit, setUnit] = useState<GoalUnit | null>(given ?? null);
  const [step, setStep] = useState<"unit" | "template" | "form">(given ? "template" : "unit");
  const [options, setOptions] = useState<GoalTaskOption[] | null>(null);
  const [kind, setKind] = useState<GoalKind>("timesDone");
  const [title, setTitle] = useState("");
  /** A template's title, with `{n}`: it follows the target until you
   *  write your own. */
  const [titlePattern, setTitlePattern] = useState<string | null>(null);
  const [target, setTarget] = useState(20);
  const [month, setMonth] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [wholeUnit, setWholeUnit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!unit) return;
    let live = true;
    void loadGoalTaskOptions(unit.id)
      .then((rows) => {
        if (live) setOptions(rows);
      })
      .catch((e: unknown) => recordProblem(e instanceof Error ? e : new Error(String(e)), "load"));
    return () => {
      live = false;
    };
  }, [unit]);

  const pickTemplate = (t: GoalTemplate | null) => {
    if (t) {
      setKind(t.kind);
      setTarget(t.target ?? 20);
      setTitle(titleWith(t.title, t.target));
      setTitlePattern(t.title.includes("{n}") ? t.title : null);
      setWholeUnit(t.wholeUnit === true);
    } else {
      setTitle("");
      setTitlePattern(null);
    }
    setChosen([]);
    setStep("form");
  };

  const loaded = options ?? [];
  const everyDay = loaded.filter((o) => o.kind === "task" && o.timesPerWeek === 7);
  // Events count toward times done and time spent (ADR-0042, clarified
  // 2026-10-17); a streak follows one every-day task, never an event.
  const countable = loaded;
  const changeTarget = (next: number) => {
    setTarget(next);
    if (titlePattern) setTitle(titleWith(titlePattern, next));
  };
  const measure: GoalMeasure | null =
    kind === "timesDone"
      ? { kind, taskIds: new Set(chosen), target }
      : kind === "timeSpent"
        ? { kind, counts: wholeUnit ? "wholeUnit" : { taskIds: new Set(chosen) }, target }
        : kind === "pointsEarned"
          ? { kind, target }
          : chosen[0]
            ? { kind, taskId: chosen[0] }
            : null;
  const facts = new Map<string, GoalTaskFacts>(
    loaded.map((o) => [o.id, { taskId: o.id, timesPerWeek: o.timesPerWeek, isEvent: o.kind === "event" }]),
  );
  const problem = !unit
    ? null
    : measure === null
      ? "Choose the every-day task to keep going."
      : title.trim().length === 0
        ? "Give it a name."
        : goalProblem({ measure, unitIds: new Set([unit.id]) }, facts);

  /** One save at a time, even from two taps before a re-render. */
  const busy = useRef(false);
  const save = async () => {
    if (!unit || !measure || problem !== null || busy.current) return;
    busy.current = true;
    setSaving(true);
    setFailed(null);
    let id: string | null = null;
    try {
      id = await createGoal({ unitId: unit.id, title, measure, targetDate: kind === "streak" ? null : month });
    } catch (e) {
      recordProblem(e instanceof Error ? e : new Error(String(e)), "save");
      // About the app, never the person.
      setFailed("That didn\u2019t save. Try again, and if it keeps happening, the problem log in Settings has the details.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
    if (id !== null) onSaved(id);
  };

  const toggle = (id: string) =>
    setChosen((c) => (kind === "streak" ? [id] : c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  // Points move in fifties; times and hours one at a time, from 1.
  const step_ = kind === "pointsEarned" ? 50 : 1;

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      dismissible={!saving}
      title="New goal"
      size="large"
      scroll
      confirm={
        step === "form"
          ? { label: "Add", onPress: () => void save(), disabled: problem !== null || saving }
          : undefined
      }
    >
      {step === "unit" ? (
        <>
          <AppText variant="caption" color={theme.muted}>
            Goals are optional. Where does this one belong?
          </AppText>
          {units.map((u) => (
            <Row
              key={u.id}
              label={u.name}
              hue={theme.areas[u.areaId] ?? theme.accent}
              onPress={() => {
                setUnit(u);
                setStep("template");
              }}
              theme={theme}
            />
          ))}
        </>
      ) : step === "template" && unit ? (
        <>
          <AppText variant="caption" color={theme.muted}>
            Start from one of these and change anything, or start from scratch.
          </AppText>
          {goalTemplatesFor(unit).map((t) => (
            <Row
              key={t.id}
              label={titleWith(t.title, t.target)}
              detail={KIND_LABEL[t.kind].name}
              onPress={() => pickTemplate(t)}
              theme={theme}
            />
          ))}
          <Row label="Start from scratch" onPress={() => pickTemplate(null)} theme={theme} />
        </>
      ) : unit ? (
        <>
          <TextField
            theme={theme}
            value={title}
            onChangeText={(next) => {
              setTitle(next);
              setTitlePattern(null);
            }}
            placeholder="Name it, like Run 30 times"
            accessibilityLabel="Goal name"
            maxLength={80}
          />
          <Segmented
            segments={KINDS}
            value={kind}
            onChange={(k) => {
              // Each kind counts in its own unit, so its target starts fresh.
              setKind(k);
              setChosen([]);
              setFailed(null);
              changeTarget(DEFAULT_TARGET[k]);
            }}
            accent={theme.accent}
            theme={theme}
            label="What it counts"
          />
          <AppText variant="caption" color={theme.muted}>
            {KIND_LABEL[kind].counts}.
          </AppText>

          {kind !== "streak" ? (
            <View style={styles.stepper}>
              <AppText color={theme.ink} style={styles.grow}>
                Target
              </AppText>
              <Step label="Less" icon="−" disabled={target <= 1} onPress={() => changeTarget(Math.max(1, target - step_))} theme={theme} />
              <View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Target"
                accessibilityValue={{ text: String(target) }}
                accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                onAccessibilityAction={(e) =>
                  changeTarget(Math.max(1, target + (e.nativeEvent.actionName === "increment" ? step_ : -step_)))
                }
                style={styles.value}
              >
                <AppText variant="label" color={theme.ink} tabular>
                  {target} {kind === "timesDone" ? "times" : kind === "timeSpent" ? "hours" : "points"}
                </AppText>
              </View>
              <Step label="More" icon="+" onPress={() => changeTarget(target + step_)} theme={theme} />
            </View>
          ) : null}

          {kind === "timeSpent" ? (
            <View style={styles.row}>
              <AppText color={theme.ink} style={styles.grow}>
                Every task in {unit.name}
              </AppText>
              <Switch
                value={wholeUnit}
                onValueChange={setWholeUnit}
                trackColor={{ true: theme.accent }}
                accessibilityLabel={`Count every task in ${unit.name}`}
              />
            </View>
          ) : null}

          {kind === "timesDone" || (kind === "timeSpent" && !wholeUnit) || kind === "streak" ? (
            <View style={styles.list}>
              <AppText variant="caption" color={theme.muted}>
                {kind === "streak" ? "The every-day task to keep going" : "Tasks that count"}
              </AppText>
              {options === null ? null : (kind === "streak" ? everyDay : countable).length === 0 ? (
                <AppText color={theme.muted}>
                  {kind === "streak"
                    ? `${unit.name} has no every-day task yet.`
                    : `${unit.name} has no tasks yet.`}
                </AppText>
              ) : (
                (kind === "streak" ? everyDay : countable).map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={() => toggle(o.id)}
                    accessibilityRole={kind === "streak" ? "radio" : "checkbox"}
                    accessibilityState={kind === "streak" ? { selected: chosen.includes(o.id) } : { checked: chosen.includes(o.id) }}
                    accessibilityLabel={o.title}
                    style={styles.row}
                  >
                    <View
                      style={[
                        styles.box,
                        kind === "streak" ? styles.round : null,
                        {
                          borderColor: theme.accent,
                          backgroundColor: chosen.includes(o.id) ? theme.accent : "transparent",
                        },
                      ]}
                    />
                    <AppText color={theme.ink} style={styles.grow}>
                      {o.title}
                    </AppText>
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          {kind !== "streak" ? (
            <View style={styles.list}>
              <AppText variant="caption" color={theme.muted}>
                By when (optional)
              </AppText>
              <View style={styles.chips}>
                {[null, ...nextMonths(currentLocalDate())].map((m) => (
                  <Pressable
                    key={m ?? "none"}
                    onPress={() => setMonth(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: month === m }}
                    style={[
                      styles.chip,
                      { borderColor: month === m ? theme.accent : theme.hairline },
                    ]}
                  >
                    <AppText variant="caption" color={theme.ink}>
                      {m === null ? "No date" : monthLabel(m)}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {problem ?? failed ? (
            <AppText variant="caption" color={theme.ink} accessibilityRole="alert">
              {failed ?? problem}
            </AppText>
          ) : null}
        </>
      ) : null}
    </NativeSheet>
  );
}

function Row({
  label,
  detail,
  hue,
  onPress,
  theme,
}: {
  label: string;
  detail?: string;
  hue?: string;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.5 : 1 }]}
    >
      {hue ? <View style={[styles.dot, { backgroundColor: hue }]} /> : null}
      <View style={styles.grow}>
        <AppText color={theme.ink}>{label}</AppText>
        {detail ? (
          <AppText variant="footnote" color={theme.muted}>
            {detail}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

function Step({
  label,
  icon,
  disabled = false,
  onPress,
  theme,
}: {
  label: string;
  icon: string;
  disabled?: boolean;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.step, { opacity: disabled ? 0.4 : pressed ? 0.55 : 1 }]}
    >
      <AppText variant="title" color={theme.ink}>
        {icon}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  step: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  value: { minWidth: 96, alignItems: "center" },
  list: { gap: space.xs },
  box: { width: 20, height: 20, borderRadius: radius.sm / 2, borderWidth: 2 },
  round: { borderRadius: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 44, justifyContent: "center" },
});
