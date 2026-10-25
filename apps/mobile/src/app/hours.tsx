/**
 * Working hours (spec §5.3.1, ADR-0039 §1), from Plan's ⋯ menu: groups
 * of weekdays with one or more time ranges, set like iOS Sleep
 * schedules, and named gaps ("Lunch"). A day used by another group is
 * greyed out. A preview shows today's windows with today's events as
 * you change things.
 *
 * Nothing saves until Done. Once the week has begun, Done asks "Just
 * this week" (each day left this week gets its own hours) or "This week
 * and after" (a new version of the template from today; earlier days
 * keep the hours they had, EC-15). Days already begun keep the hours
 * they began with for the commitment share either way (ADR-0044 §5).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  dayHours,
  totalMinutes,
  type NamedGap,
  type TimeRange,
  type Weekday,
  type WorkSchedule,
} from "@glide/scoring";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

import {
  draftFrom,
  nextRange,
  nextSchedule,
  rangesOn,
  restOfWeek,
  takenElsewhere,
  weekHasBegun,
  type HoursDraft,
} from "../components/plan/hoursDraft";
import { spanLabel } from "../components/plan/dayView";
import { formatWeekdaySummary } from "../components/plan/planning";
import { WeekdayPicker } from "../components/plan/WeekdayPicker";
import { AppText } from "../components/ui/AppText";
import { Button } from "../components/ui/Button";
import { TimeField } from "../components/ui/DateTimeField";
import { Group } from "../components/ui/Group";
import { InfoButton } from "../components/ui/InfoButton";
import { KeyboardScroll } from "../components/ui/KeyboardScroll";
import { LoadFailure, useScreenLoad } from "../components/ui/ScreenLoad";
import { TextField } from "../components/ui/TextField";
import { loadDayPlan } from "../db/dayPlan";
import { loadHoursVersions, saveHoursFrom, setDayOverride } from "../db/hours";
import { hoursProblem } from "../db/windowRules";
import { recordProblem } from "../lib/problemLog";
import { currentLocalDate } from "../lib/calendar";
import { templateFor } from "../lib/onboardingTemplates";
import { getTheme } from "../theme/colors";
import { radius, space } from "../theme/tokens";

/** "Weekdays", "Weekends", "Every day", else "Mon, Wed, Fri". */
function groupTitle(days: readonly number[]): string | null {
  const key = [...days].sort().join("");
  if (key === "12345") return "Weekdays";
  if (key === "67") return "Weekends";
  return formatWeekdaySummary(days as readonly Weekday[]);
}

export default function HoursScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const today = currentLocalDate();
  /** From onboarding (ADR-0045 step 4): `template` fills in hours not
   *  yet set, and `setup`, sent only when none are, saves them from
   *  today with no question. */
  const { template, setup } = useLocalSearchParams<{ template?: string; setup?: string }>();
  const [draft, setDraft] = useState<HoursDraft | null>(null);
  const [events, setEvents] = useState<TimeRange[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    // Only the first load seeds the draft: coming back from a sheet
    // mustn't throw away what you've changed.
    const [versions, plan] = await Promise.all([loadHoursVersions(), loadDayPlan(today)]);
    setDraft((d) => d ?? draftFrom(versions, today, templateFor(template)?.schedules));
    setEvents(plan.events.map((e) => ({ start: e.start, end: e.end })));
  }, [today, template]);
  const { error, retry } = useScreenLoad(load);

  const problem = draft ? hoursProblem(today, draft.schedules, draft.gaps) : null;
  const preview = useMemo(
    () =>
      draft
        ? dayHours({
            date: today,
            versions: [{ from: today, schedules: draft.schedules, gaps: draft.gaps }],
            events,
          })
        : null,
    [draft, events, today],
  );

  const setSchedule = (i: number, next: WorkSchedule | null) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            schedules: next === null ? d.schedules.filter((_, j) => j !== i) : d.schedules.map((s, j) => (j === i ? next : s)),
          }
        : d,
    );
  const setGap = (i: number, next: NamedGap | null) =>
    setDraft((d) =>
      d
        ? { ...d, gaps: next === null ? d.gaps.filter((_, j) => j !== i) : d.gaps.map((g, j) => (j === i ? next : g)) }
        : d,
    );

  const save = async (scope: "week" | "after") => {
    if (!draft) return;
    setSaving(true);
    try {
      if (scope === "after") await saveHoursFrom(today, draft.schedules, draft.gaps);
      else for (const d of restOfWeek(today)) await setDayOverride(d, rangesOn(draft, d));
      router.back();
    } catch (e) {
      recordProblem(e instanceof Error ? e : new Error(String(e)), "save");
      Alert.alert("Your hours weren't saved", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const done = () => {
    if (!draft || problem !== null || saving) return;
    if (setup !== undefined || !weekHasBegun(today)) {
      void save("after");
      return;
    }
    Alert.alert("Change your hours for", undefined, [
      { text: "Just this week", onPress: () => void save("week") },
      { text: "This week and after", onPress: () => void save("after") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant="done"
          disabled={!draft || problem !== null || saving}
          onPress={done}
        >
          Done
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      {/* The scroll view is there from the first frame, loading or not:
          iOS ties the large title to the first scroll view it finds, and
          one that mounts later leaves the title floating over the page. */}
      <KeyboardScroll
        style={styles.root}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
      {error ? (
        <LoadFailure error={error} onRetry={retry} theme={theme} />
      ) : !draft ? (
        <ActivityIndicator color={theme.muted} style={styles.loading} />
      ) : (
        <>
          <View style={styles.leadRow}>
            <AppText variant="caption" color={theme.muted} style={styles.grow}>
              When you&apos;re free to work.
            </AppText>
            <InfoButton
              title="Working hours"
              body="Events are taken out of these hours, and what's left becomes each day's windows. Gaps are named breaks between windows, like lunch."
              theme={theme}
            />
          </View>

          {draft.schedules.map((s, i) => (
            <Group
              key={`s-${s.weekdays.join("")}-${i}`}
              theme={theme}
              title={groupTitle(s.weekdays) ?? `Group ${i + 1}`}
            >
              <View style={styles.stack}>
                <WeekdayPicker
                  value={s.weekdays}
                  taken={takenElsewhere(draft.schedules, i)}
                  onChange={(weekdays) => setSchedule(i, { ...s, weekdays })}
                  accent={theme.accent}
                  theme={theme}
                />
                {s.ranges.map((r, j) => (
                  <RangeRow
                    key={`r-${r.start}-${r.end}`}
                    range={r}
                    label={`Group ${i + 1}, range ${j + 1}`}
                    theme={theme}
                    onChange={(next) =>
                      setSchedule(i, { ...s, ranges: s.ranges.map((x, k) => (k === j ? next : x)) })
                    }
                    onRemove={
                      s.ranges.length > 1
                        ? () => setSchedule(i, { ...s, ranges: s.ranges.filter((_, k) => k !== j) })
                        : undefined
                    }
                  />
                ))}
                {nextRange(s.ranges) ? (
                  <Button
                    variant="quiet"
                    label="Add another time range"
                    onPress={() => {
                      const r = nextRange(s.ranges);
                      if (r) setSchedule(i, { ...s, ranges: [...s.ranges, r] });
                    }}
                    theme={theme}
                  />
                ) : null}
                <Button
                  variant="quiet"
                  label="Remove this group"
                  onPress={() => setSchedule(i, null)}
                  theme={theme}
                />
              </View>
            </Group>
          ))}
          {nextSchedule(draft.schedules) ? (
            <Button
              variant="tonal"
              icon="add"
              label="Add group"
              onPress={() => {
                const s = nextSchedule(draft.schedules);
                if (s) setDraft({ ...draft, schedules: [...draft.schedules, s] });
              }}
              theme={theme}
            />
          ) : null}

          <AppText variant="headline" color={theme.ink} style={styles.heading}>
            Gaps
          </AppText>
          {draft.gaps.map((g, i) => (
            <Group key={`g-${i}`} theme={theme}>
              <View style={styles.stack}>
                <TextField
                  theme={theme}
                  value={g.name}
                  onChangeText={(name) => setGap(i, { ...g, name })}
                  placeholder="Name, like Lunch"
                  accessibilityLabel="Gap name"
                  maxLength={40}
                />
                <WeekdayPicker
                  value={g.weekdays}
                  onChange={(weekdays) => setGap(i, { ...g, weekdays })}
                  accent={theme.accent}
                  theme={theme}
                />
                <RangeRow
                  range={g.range}
                  label={`${g.name || "Gap"}`}
                  theme={theme}
                  onChange={(range) => setGap(i, { ...g, range })}
                  onRemove={() => setGap(i, null)}
                />
              </View>
            </Group>
          ))}
          <Button
            variant="quiet"
            label="Name a gap"
            onPress={() =>
              setDraft({
                ...draft,
                gaps: [...draft.gaps, { name: "", weekdays: [1, 2, 3, 4, 5], range: { start: 12 * 60, end: 13 * 60 } }],
              })
            }
            theme={theme}
          />

          {preview ? (
            <Group theme={theme} title="Preview: today">
              <AppText variant="body" color={theme.ink} tabular>
                {preview.windows.length === 0
                  ? "No windows"
                  : preview.windows.map(spanLabel).join("  ·  ")}
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                About {Math.round(totalMinutes(preview.windows) / 30) / 2} h free
              </AppText>
            </Group>
          ) : null}

          {problem ? (
            <AppText variant="caption" color={theme.ink} accessibilityRole="alert">
              {problem}
            </AppText>
          ) : null}
        </>
      )}
      </KeyboardScroll>
    </View>
  );
}

function RangeRow({
  range,
  label,
  theme,
  onChange,
  onRemove,
}: {
  range: TimeRange;
  label: string;
  theme: ReturnType<typeof getTheme>;
  onChange: (r: TimeRange) => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.range}>
      <TimeField
        minutes={range.start}
        onChange={(start) => onChange({ start, end: Math.max(range.end, start + 15) })}
        label={`${label}, starts`}
        accent={theme.accent}
        theme={theme}
      />
      <AppText color={theme.muted}>–</AppText>
      <TimeField
        minutes={range.end}
        min={range.start + 15}
        onChange={(end) => onChange({ ...range, end })}
        label={`${label}, ends`}
        accent={theme.accent}
        theme={theme}
      />
      <View style={styles.grow} />
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          hitSlop={8}
          style={styles.remove}
        >
          <Ionicons name="remove-circle" size={22} color={theme.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { marginTop: space.xxl },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl, gap: space.md },
  stack: { gap: space.sm },
  leadRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  heading: { paddingTop: space.lg },
  range: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 },
  grow: { flex: 1 },
  remove: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.xs, borderRadius: radius.sm },
});
