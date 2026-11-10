/**
 * Calibration (ADR-0008): the weekly check-in and, once there's enough
 * data, a plain-language read on whether grades and felt contentment
 * agree. The same question is asked in the weekly pass. Suggestions
 * were dropped: formula v8 left nothing for one to change.
 */
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import {
  loadCalibrationState,
  loadCheckinStatus,
  submitCheckin,
  type CalibrationState,
  type CheckinStatus,
} from "../db/calibration";
import { currentLocalDate } from "../lib/calendar";
import { NumberDial } from "../components/number-dial/NumberDial";
import { AppText } from "../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import { LoadFailure, useScreenLoad } from "../components/ui/ScreenLoad";
import { getTheme } from "../theme/colors";
import { space } from "../theme/tokens";

function directionLine(direction: "higher" | "lower" | "aligned"): string {
  if (direction === "higher") return "Your grades have been running higher than your weeks felt.";
  if (direction === "lower") return "Your grades have been running lower than your weeks felt.";
  return "Your grades and how your weeks felt have been lining up.";
}

export default function CalibrationScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const reduceMotion = useReducedMotion();

  const [checkin, setCheckin] = useState<CheckinStatus | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [calibration, setCalibration] = useState<CalibrationState | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const [checkinStatus, state] = await Promise.all([
      loadCheckinStatus(currentLocalDate()),
      loadCalibrationState(),
    ]);
    setCheckin(checkinStatus);
    setRating(checkinStatus.existingScore);
    setCalibration(state);
    // Setters are stable; listing them lets the React Compiler match.
  }, [setCheckin, setRating, setCalibration]);

  const { error, retry, save } = useScreenLoad(reload);

  const saveCheckin = async () => {
    if (!checkin || rating === null || saving) return;
    setSaving(true);
    // A failure is said and the screen reloads; Save comes back either way.
    await save(() => submitCheckin(checkin.weekStart, rating));
    setSaving(false);
  };

  if (error) return <LoadFailure error={error} onRetry={retry} theme={theme} />;

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.container,
          { paddingTop: space.md, paddingBottom: space.xl },
        ]}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        <AppText color={theme.muted} style={styles.lead}>
          A weekly check, and once there’s enough of it, a look at whether
          your grades and how your weeks actually felt agree.
        </AppText>

        {checkin === null || calibration === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : (
          <>
            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                {checkin.label === "this" ? "This week" : "Last week"}
              </AppText>
              <AppText variant="caption" color={theme.muted} style={styles.checkinCaption}>
                How content did it feel, 1–10? Skip it any time. Nothing here
                is tracked as missed.
              </AppText>
              <NumberDial
                label="Contentment"
                a11yName="Weekly contentment"
                value={rating}
                onChange={setRating}
                accent={theme.accent}
                theme={theme}
                reduceMotion={reduceMotion}
              />
              <Button
                label="Save"
                onPress={saveCheckin}
                disabled={rating === null || saving}
                theme={theme}
              />
            </View>

            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                Insight
              </AppText>
              {calibration.gate ? (
                calibration.divergence ? (
                  <>
                    <AppText color={theme.ink} style={styles.insightLine}>
                      {directionLine(calibration.divergence.direction)}
                    </AppText>
                    <AppText variant="caption" color={theme.muted}>
                      Based on {calibration.divergence.weekCount} comparable weeks.
                    </AppText>
                  </>
                ) : (
                  <AppText color={theme.muted} style={styles.insightLine}>
                    Not enough overlapping weeks yet to compare.
                  </AppText>
                )
              ) : (
                <AppText color={theme.muted} style={styles.insightLine}>
                  Still learning your rhythm. Check in most weeks, and this
                  fills in after a couple of months.
                </AppText>
              )}

            </View>

          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: space.screen },
  lead: { marginTop: space.xs, marginBottom: space.xl },
  section: {
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  checkinCaption: { marginBottom: space.xs },
  insightLine: { marginTop: space.xs },
});
