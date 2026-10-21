/**
 * Onboarding's "Your first week" step (ADR-0045 §1 step 6): the
 * suggested week, as Plan shows it, with the one line that explains
 * the score. Pins made here are real pins; suggestions are worked out
 * live, as everywhere (ADR-0039 §5). Nothing here changes a score.
 *
 * The week strip and day view are Plan's own, so this can't drift from
 * the tab it previews.
 */
import { addDays } from "@glide/scoring";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { loadDayPlan, loadWeek, type DayPlan, type WeekDay } from "../../db/dayPlan";
import { useUndoDelete } from "../../hooks/useUndoDelete";
import { currentLocalDate } from "../../lib/calendar";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { weekLabel } from "../plan/dayView";
import { PlanDayView } from "../plan/PlanDayView";
import { PlanWeekStrip } from "../plan/PlanWeekStrip";
import { AppText } from "../ui/AppText";
import { LoadFailure, useScreenLoad } from "../ui/ScreenLoad";
import { UndoBar } from "../ui/UndoBar";
import { OnboardingPage } from "./OnboardingPage";

export function FirstWeekStep({
  theme,
  onNext,
}: {
  theme: ThemeTokens;
  /** Next and Skip are the same here: the week is already live. */
  onNext: () => void;
}) {
  const today = currentLocalDate();
  const [selected, setSelected] = useState(today);
  const [loaded, setLoaded] = useState<DayPlan | null>(null);
  const [week, setWeek] = useState<WeekDay[] | null>(null);

  /** Only the latest load may land (as on Plan). */
  const loadTurn = useRef(0);
  const load = useCallback(async () => {
    const turn = ++loadTurn.current;
    const [nextDay, nextWeek] = await Promise.all([loadDayPlan(selected), loadWeek(selected)]);
    if (turn !== loadTurn.current) return;
    setLoaded(nextDay);
    setWeek(nextWeek);
  }, [selected]);
  const { error, retry, save } = useScreenLoad(load);
  const undo = useUndoDelete(save);

  const day = loaded !== null && loaded.day.date === selected ? loaded : null;

  return (
    <OnboardingPage
      theme={theme}
      step="week"
      action="Next"
      onPress={onNext}
      top
      overlay={<UndoBar undo={undo} theme={theme} />}
    >
      <AppText variant="display" color={theme.ink}>
        Your first week
      </AppText>
      <AppText color={theme.ink} style={styles.lead}>
        This is a suggestion. Pin what you want to keep. The rest updates
        as you go.
      </AppText>
      <AppText color={theme.muted} style={styles.lead}>
        You’ll get a score out of 100 for how much of each day’s plan you
        do.
      </AppText>

      {week ? (
        <PlanWeekStrip
          days={week}
          label={weekLabel(selected)}
          selected={selected}
          today={today}
          onSelect={setSelected}
          onPrevWeek={() => setSelected(addDays(selected, -7))}
          onNextWeek={() => setSelected(addDays(selected, 7))}
          theme={theme}
        />
      ) : null}

      {error ? (
        <LoadFailure error={error} onRetry={retry} theme={theme} />
      ) : day === null ? (
        <ActivityIndicator color={theme.muted} style={styles.loading} />
      ) : (
        <PlanDayView day={day} today={today} save={save} reload={retry} undo={undo} theme={theme} />
      )}
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  lead: { maxWidth: 340 },
  loading: { marginTop: space.xl },
});
