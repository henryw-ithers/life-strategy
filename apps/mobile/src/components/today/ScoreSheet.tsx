/**
 * How the day adds up (spec §5.1), opened by tapping the number: what
 * your plan paid, what things you logged added, and anything logged
 * past the day's limit for them (ADR-0023). Plain words, the same on
 * any day: no colour for a low number, no verdict (ADR-0008, P8).
 *
 * The first time it's opened it also says how the score works
 * (ADR-0045 §1 step 6), since onboarding gives it only one line. The
 * figures are the engine's constants, so the words can't drift from
 * the scoring.
 */
import { PLANNED_BAND, REST_DAY_BASE, UNPLANNED_BAND, type DayScore } from "@glide/scoring";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { markScoreExplained, scoreExplained } from "../../db/settings";
import { recordProblem } from "../../lib/problemLog";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";

interface ScoreSheetProps {
  visible: boolean;
  score: DayScore;
  /** A rest day starts at 70 (ADR-0037). */
  restDay: boolean;
  /** "today" or a weekday, for the title. */
  dayLabel: string;
  theme: ThemeTokens;
  onClose: () => void;
}

export function ScoreSheet({ visible, score, restDay, dayLabel, theme, onClose }: ScoreSheetProps) {
  // One row rounded, the other what's left, so they add up to the day.
  const logged = Math.round(score.unplanned);
  const plan = Math.max(0, Math.round(score.earned) - logged);
  const forgone = Math.round(score.unplannedForgone);

  /** Explain on the first open only; it stays for that open. */
  const [explain, setExplain] = useState(false);
  if (!visible && explain) setExplain(false);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void scoreExplained()
      .then(async (seen) => {
        if (cancelled || seen) return;
        setExplain(true);
        await markScoreExplained();
      })
      .catch((e: unknown) => recordProblem(e instanceof Error ? e : new Error(String(e)), "load"));
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <NativeSheet visible={visible} onClose={onClose} dismiss="done" title={`How ${dayLabel} adds up`}>
      {explain ? (
        <View style={styles.explain}>
          <AppText color={theme.ink}>
            Each day is scored out of 100 for how much of its plan you do.
            Do all of it and you reach {PLANNED_BAND}. The last{" "}
            {UNPLANNED_BAND} comes from things you log that you didn&apos;t
            plan.
          </AppText>
          <AppText color={theme.ink}>
            On a day with commitment work, each commitment takes its share
            of the day first, and the rest is scored the same way.
          </AppText>
          <AppText color={theme.ink}>
            A day that asks nothing starts at {REST_DAY_BASE}. Work done
            early counts on the day you do it.
          </AppText>
        </View>
      ) : null}
      <View style={styles.rows}>
        <Line label={restDay ? "A rest day, and what you did early" : "Your plan"} value={plan} theme={theme} />
        <Line label="Things you logged" value={logged} theme={theme} />
        {forgone > 0 ? (
          <AppText variant="caption" color={theme.muted}>
            {forgone} more logged past the day&apos;s limit for logged things. Your plan is what pays.
          </AppText>
        ) : null}
      </View>
      <AppText variant="footnote" color={theme.muted}>
        Grades are guidelines, not judgments.
      </AppText>
    </NativeSheet>
  );
}

function Line({ label, value, theme }: { label: string; value: number; theme: ThemeTokens }) {
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label}, ${value}`}>
      <AppText color={theme.ink} style={styles.grow}>
        {label}
      </AppText>
      <AppText variant="label" color={theme.ink} tabular>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.sm },
  explain: { gap: space.sm },
  line: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md },
  grow: { flex: 1 },
});
