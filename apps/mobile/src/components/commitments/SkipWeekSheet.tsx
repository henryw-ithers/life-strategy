/**
 * "Skip a week…" on a commitment (ADR-0040 §2; spec §5.5): the next 26
 * weeks, each with a switch. Switching one off skips every event and
 * task of the commitment that week, including ones added later. Life
 * tasks aren't touched. A week that has started can't be skipped whole
 * (EC-25), so the list starts next week. Each switch saves at once.
 */
import { addDays } from "@glide/scoring";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";

import { commitmentWeeks } from "../../db/seriesRules";
import { addSkip, loadCommitmentWeekSkips, removeSkip } from "../../db/skips";
import { currentLocalDate } from "../../lib/calendar";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";

function weekLabel(weekStart: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(weekStart)} – ${fmt(addDays(weekStart, 6))}`;
}

export function SkipWeekSheet({
  visible,
  unitId,
  name,
  accent,
  theme,
  onClose,
  onDismissed,
}: {
  visible: boolean;
  unitId: string;
  name: string;
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  onDismissed?: () => void;
}) {
  /** Null until loaded: the switches wait for it. */
  const [skipped, setSkipped] = useState<Map<string, string> | null>(null);
  /** Weeks whose switch is saving, so a second tap can't race it. */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadCommitmentWeekSkips(unitId)
      .then((next) => {
        if (live) setSkipped(next);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      live = false;
    };
  }, [unitId]);

  const toggle = async (weekStart: string, runs: boolean) => {
    if (skipped === null || busy.has(weekStart)) return;
    setError(null);
    setBusy((b) => new Set(b).add(weekStart));
    try {
      const id = skipped.get(weekStart);
      if (runs && id) await removeSkip(id);
      if (!runs && !id) await addSkip({ kind: "commitmentWeek", unitId, date: weekStart });
      setSkipped(await loadCommitmentWeekSkips(unitId));
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

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      size="large"
      dismiss="done"
      title="Skip a week"
    >
      <AppText variant="caption" color={theme.muted}>
        A week switched off skips all of {name}&apos;s events and tasks that week, including
        ones you add later.
      </AppText>
      <ScrollView style={styles.scroller} contentContainerStyle={styles.list}>
        {commitmentWeeks(currentLocalDate()).map((w) => (
          <View key={w} style={styles.row}>
            <AppText color={theme.ink} style={styles.grow}>
              {weekLabel(w)}
            </AppText>
            <Switch
              value={!(skipped?.has(w) ?? false)}
              disabled={skipped === null || busy.has(w)}
              onValueChange={(on) => void toggle(w, on)}
              trackColor={{ true: accent }}
              accessibilityLabel={`Week of ${weekLabel(w)}`}
              accessibilityHint="Off skips this week"
            />
          </View>
        ))}
        {error ? (
          <AppText variant="footnote" color={theme.muted} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : null}
      </ScrollView>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  scroller: { flex: 1 },
  list: { gap: space.xs, paddingBottom: space.md },
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md },
  grow: { flex: 1 },
});
