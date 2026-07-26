/**
 * Settings (ADR-0010 §6): exactly two controls for the daily nudge — a
 * toggle and a time picker. Future deferred reminders each get their
 * own toggle here later; never a single master switch.
 */
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Linking from "expo-linking";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/ui/AppText";
import { Backdrop, hueWash } from "../components/ui/Backdrop";
import {
  loadNotificationSettings,
  markNotificationPermissionAsked,
  setNotificationEnabled,
  setNotificationTime,
  type NotificationSettings,
} from "../db/settings";
import { currentLocalDate, loadDay } from "../db/today";
import {
  getPermissionStatus,
  requestPermission,
  syncDailyNudge,
} from "../notifications/dailyNudge";
import { getTheme } from "../theme/colors";
import { radius, space } from "../theme/tokens";

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [deniedAtOs, setDeniedAtOs] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reload = useCallback(async () => {
    const [loaded, status] = await Promise.all([
      loadNotificationSettings(),
      getPermissionStatus(),
    ]);
    setSettings(loaded);
    setDeniedAtOs(!status.granted && !status.canAskAgain);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const resync = async () => {
    const day = await loadDay(currentLocalDate());
    await syncDailyNudge(day);
  };

  const onToggle = async (next: boolean) => {
    if (!next) {
      await setNotificationEnabled(false);
      await reload();
      await resync();
      return;
    }

    const status = await getPermissionStatus();
    if (!status.granted && !status.canAskAgain) {
      await markNotificationPermissionAsked();
      setDeniedAtOs(true);
      return;
    }
    if (!status.granted) {
      // Never asked before — the settings toggle is itself the
      // deliberate in-app "yes," so ask the OS directly. Whatever the
      // outcome, this resolves the pre-screen — it must not also pop
      // up on the Today screen afterward.
      const requested = await requestPermission();
      await markNotificationPermissionAsked();
      if (!requested.granted) {
        await reload();
        return;
      }
    }
    await setNotificationEnabled(true);
    await reload();
    await resync();
  };

  const onChangeTime = async (hour: number, minute: number) => {
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    await setNotificationTime(time);
    await reload();
    await resync();
  };

  const timeAsDate = (() => {
    const [h, m] = (settings?.time ?? "09:00").split(":").map(Number);
    const d = new Date();
    d.setHours(h ?? 9, m ?? 0, 0, 0);
    return d;
  })();

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
          Settings
        </AppText>

        <Pressable
          onPress={() => router.push("/calibration" as Href)}
          accessibilityRole="button"
          style={[styles.navRow, { borderColor: theme.hairline }]}
        >
          <AppText color={theme.ink} style={styles.grow}>
            Calibration
          </AppText>
          <AppText variant="label" color={theme.muted}>
            ›
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => router.push("/backup" as Href)}
          accessibilityRole="button"
          style={[styles.navRow, { borderColor: theme.hairline }]}
        >
          <AppText color={theme.ink} style={styles.grow}>
            Your data
          </AppText>
          <AppText variant="label" color={theme.muted}>
            ›
          </AppText>
        </Pressable>

        {settings === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : (
          <View style={[styles.section, { borderTopColor: theme.hairline }]}>
            <View style={styles.row}>
              <AppText color={theme.ink} style={styles.grow}>
                Daily reminder
              </AppText>
              <Switch
                value={settings.enabled}
                onValueChange={(v) => void onToggle(v)}
                trackColor={{ false: theme.hairline, true: theme.accent }}
                thumbColor={theme.canvas}
              />
            </View>
            <AppText variant="caption" color={theme.muted} style={styles.caption}>
              One nudge, only when today's list still needs you. Never says
              what's on it.
            </AppText>

            {deniedAtOs ? (
              <Pressable
                onPress={() => void Linking.openSettings()}
                accessibilityRole="button"
                style={[styles.deniedBox, { borderColor: theme.hairline }]}
              >
                <AppText color={theme.ink}>
                  Notifications are off at the system level.
                </AppText>
                <AppText variant="label" color={theme.accent}>
                  Open system settings ›
                </AppText>
              </Pressable>
            ) : null}

            {settings.enabled ? (
              <View style={styles.timeRow}>
                <AppText color={theme.ink} style={styles.grow}>
                  Time
                </AppText>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  accessibilityRole="button"
                  style={[styles.timeChip, { borderColor: theme.hairline }]}
                >
                  <AppText color={theme.ink} tabular>
                    {settings.time}
                  </AppText>
                </Pressable>
              </View>
            ) : null}

            {pickerOpen ? (
              <DateTimePicker
                value={timeAsDate}
                mode="time"
                display="spinner"
                onChange={(_event, date) => {
                  setPickerOpen(false);
                  if (date) void onChangeTime(date.getHours(), date.getMinutes());
                }}
              />
            ) : null}
          </View>
        )}

        <View style={[styles.section, { borderTopColor: theme.hairline }]}>
          <AppText variant="headline" color={theme.ink}>
            Support resources
          </AppText>
          <AppText color={theme.ink}>
            These are here anytime, for anyone — not because of anything in
            your data.
          </AppText>
          <AppText color={theme.ink} style={styles.resourceLine}>
            988 Suicide &amp; Crisis Lifeline — call or text 988.
          </AppText>
          <AppText color={theme.ink} style={styles.resourceLine}>
            Crisis Text Line — text HOME to 741741.
          </AppText>
          <AppText variant="caption" color={theme.muted} style={styles.resourceLine}>
            Or talk to a doctor, therapist, or someone you trust.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  container: { paddingHorizontal: space.screen },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  section: {
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
    marginTop: space.lg,
    paddingHorizontal: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
  grow: { flex: 1 },
  caption: { marginTop: -space.xs },
  resourceLine: { marginTop: -space.xs },
  deniedBox: {
    marginTop: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
    marginTop: space.sm,
  },
  timeChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
});
