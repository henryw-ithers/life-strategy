/**
 * How the day adds up (spec §5.1), opened by tapping the number: what
 * your plan paid, what things you logged added, and anything logged
 * past the day's limit for them (ADR-0023). Plain words, the same on
 * any day: no colour for a low number, no verdict (ADR-0008, P8).
 */
import type { DayScore } from "@glide/scoring";
import { StyleSheet, View } from "react-native";

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
  return (
    <NativeSheet visible={visible} onClose={onClose} dismiss="done" title={`How ${dayLabel} adds up`}>
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
  line: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md },
  grow: { flex: 1 },
});
