/**
 * "Skip weeks ›" in the event sheet (ADR-0040 §2; spec §5.8): the
 * series' weeks with a switch each. A week that has started can't be
 * switched off (EC-25). Each switch saves at once, as a skip is its own
 * small change, and nothing anywhere counts what was skipped
 * (ADR-0038 §5).
 */
import { addDays } from "@glide/scoring";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import type { Bounds } from "../../db/seriesRules";
import { seriesWeeks } from "../../db/seriesRules";
import { addSkip, loadTaskSkips, removeSkip } from "../../db/skips";
import { currentLocalDate } from "../../lib/calendar";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

/** "27 Oct – 2 Nov". */
function weekLabel(weekStart: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(weekStart)} – ${fmt(addDays(weekStart, 6))}`;
}

export function SkipWeeks({
  taskId,
  bounds,
  accent,
  theme,
}: {
  taskId: string;
  bounds: Bounds;
  accent: string;
  theme: ThemeTokens;
}) {
  /** Null until loaded: the switches wait for it. */
  const [skipped, setSkipped] = useState<Map<string, string> | null>(null);
  /** Weeks whose switch is saving, so a second tap can't race it. */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const weeksSkipped = async () =>
    new Map(
      (await loadTaskSkips(taskId))
        .filter((r) => r.kind === "taskWeek")
        .map((r) => [r.localDate, r.id] as const),
    );

  useEffect(() => {
    let live = true;
    void loadTaskSkips(taskId)
      .then((rows) => {
        if (live) {
          setSkipped(new Map(rows.filter((r) => r.kind === "taskWeek").map((r) => [r.localDate, r.id])));
        }
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      live = false;
    };
  }, [taskId]);

  const toggle = async (weekStart: string, runs: boolean) => {
    if (skipped === null || busy.has(weekStart)) return;
    setError(null);
    setBusy((b) => new Set(b).add(weekStart));
    try {
      const id = skipped.get(weekStart);
      if (runs && id) await removeSkip(id);
      if (!runs && !id) await addSkip({ kind: "taskWeek", taskId, date: weekStart });
      setSkipped(await weeksSkipped());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(weekStart);
        return next;
      });
    }
  };

  const weeks = seriesWeeks(bounds, currentLocalDate());
  return (
    <View style={styles.list}>
      {weeks.map((w) => {
        const runs = !(skipped?.has(w.weekStart) ?? false);
        return (
          <View key={w.weekStart} style={styles.row}>
            <AppText color={w.skippable ? theme.ink : theme.muted} style={styles.grow}>
              {weekLabel(w.weekStart)}
            </AppText>
            <Switch
              value={runs}
              disabled={!w.skippable || skipped === null || busy.has(w.weekStart)}
              onValueChange={(on) => void toggle(w.weekStart, on)}
              trackColor={{ true: accent }}
              accessibilityLabel={`Week of ${weekLabel(w.weekStart)}`}
              accessibilityHint={w.skippable ? "Off skips this week" : "This week has started"}
            />
          </View>
        );
      })}
      {error ? (
        <AppText variant="footnote" color={theme.muted} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md },
  grow: { flex: 1 },
});
