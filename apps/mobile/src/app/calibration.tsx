/**
 * Calibration (ADR-0008): a weekly check-in and, once there's enough
 * data, a plain-language read on whether grades and felt contentment
 * agree — with any suggested formula change requiring explicit
 * acceptance. Nothing here ever pushes; it only exists on a screen
 * the user navigates to themselves.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  loadCalibrationState,
  loadCheckinStatus,
  resolveSuggestion,
  submitCheckin,
  type CalibrationState,
  type CalibrationSuggestionRow,
  type CheckinStatus,
} from "../db/calibration";
import { currentLocalDate } from "../lib/calendar";
import { NumberDial } from "../components/number-dial/NumberDial";
import { AppText } from "../components/ui/AppText";
import { Backdrop, hueWash } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import { getTheme } from "../theme/colors";
import { radius, space } from "../theme/tokens";

function directionLine(direction: "higher" | "lower" | "aligned"): string {
  if (direction === "higher") return "Your grades have been running higher than your weeks felt.";
  if (direction === "lower") return "Your grades have been running lower than your weeks felt.";
  return "Your grades and how your weeks felt have been lining up.";
}

/**
 * What a stored suggestion would do — or, for every suggestion the app
 * has ever written, what it *would have* done.
 *
 * `gapCoefficient` was the only kind, and formula v8 removed the
 * constant it moved (ADR-0028 §1). A pending row from before that can
 * still be sitting here, so it is described honestly and offered only a
 * Dismiss: an Accept that silently applies nothing would be the app
 * telling the user it did something it did not.
 */
function describeChange(proposedChange: string): string | null {
  try {
    const change = JSON.parse(proposedChange) as { type: string };
    if (change.type === "gapCoefficient") {
      return "Scoring has changed since this was suggested — satisfaction no longer affects your weights, so there is nothing left for this to adjust.";
    }
    return null;
  } catch {
    return null;
  }
}

/** True when accepting the suggestion would actually change something.
 *  Nothing currently does; see `describeChange`. */
function isApplicable(proposedChange: string): boolean {
  try {
    return (JSON.parse(proposedChange) as { type: string }).type !== "gapCoefficient";
  } catch {
    return false;
  }
}

export default function CalibrationScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const saveCheckin = async () => {
    if (!checkin || rating === null || saving) return;
    setSaving(true);
    await submitCheckin(checkin.weekStart, rating);
    await reload();
    setSaving(false);
  };

  const resolve = async (id: string, status: "accepted" | "dismissed") => {
    await resolveSuggestion(id, status);
    await reload();
  };

  const pending = calibration?.suggestions.filter((s) => s.status === "proposed") ?? [];
  const resolved = calibration?.suggestions.filter((s) => s.status !== "proposed") ?? [];

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={hueWash(theme.accent)} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={styles.back}
        >
          <AppText variant="label" color={theme.muted}>
            ‹ Back
          </AppText>
        </Pressable>

        <AppText variant="display" color={theme.ink}>
          Calibration
        </AppText>
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

              {pending.map((s) => (
                <View key={s.id} style={[styles.suggestionCard, { borderColor: theme.hairline }]}>
                  <AppText color={theme.ink}>{s.insightText}</AppText>
                  {describeChange(s.proposedChange) ? (
                    <AppText variant="caption" color={theme.muted}>
                      {describeChange(s.proposedChange)}
                    </AppText>
                  ) : null}
                  <View style={styles.suggestionActions}>
                    {isApplicable(s.proposedChange) ? (
                      <Button
                        label="Accept"
                        color={theme.accent}
                        onPress={() => void resolve(s.id, "accepted")}
                        theme={theme}
                      />
                    ) : null}
                    <Button
                      label="Dismiss"
                      variant="quiet"
                      onPress={() => void resolve(s.id, "dismissed")}
                      theme={theme}
                    />
                  </View>
                </View>
              ))}
            </View>

            {resolved.length > 0 ? (
              <View style={[styles.section, { borderTopColor: theme.hairline }]}>
                <AppText variant="headline" color={theme.ink}>
                  History
                </AppText>
                {resolved.map((s: CalibrationSuggestionRow) => (
                  <View key={s.id} style={[styles.historyRow, { borderTopColor: theme.hairline }]}>
                    <AppText color={theme.ink} style={styles.grow} numberOfLines={2}>
                      {s.insightText}
                    </AppText>
                    <AppText variant="caption" color={theme.muted}>
                      {s.status}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  container: { paddingHorizontal: space.screen },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  lead: { marginTop: space.xs, marginBottom: space.xl },
  section: {
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  checkinCaption: { marginBottom: space.xs },
  insightLine: { marginTop: space.xs },
  suggestionCard: {
    marginTop: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  suggestionActions: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  grow: { flex: 1 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 40,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
