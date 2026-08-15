/**
 * Settings (ADR-0010 §6): exactly two controls for the daily nudge — a
 * toggle and a time picker. Future deferred reminders each get their
 * own toggle here later; never a single master switch.
 */
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Application from "expo-application";
import * as Linking from "expo-linking";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, useColorScheme, View } from "react-native";

import { EraseDataModal } from "../../components/settings/EraseDataModal";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, hueWash } from "../../components/ui/Backdrop";
import { Group, GroupDivider } from "../../components/ui/Group";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import {
  loadNotificationSettings,
  markNotificationPermissionAsked,
  setNotificationEnabled,
  setNotificationTime,
  type NotificationSettings,
} from "../../db/settings";
import { resetOnboarding } from "../../db/onboarding";
import { eraseAllData } from "../../db/reset";
import {
  currentLocalDate,
  loadDay,
  recomputeAllGrades,
  type RecomputeResult,
} from "../../db/today";
import {
  cancelAllNudges,
  getPermissionStatus,
  requestPermission,
  syncDailyNudge,
} from "../../notifications/dailyNudge";
import { getTheme } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";

/**
 * Version and build, for bug reports from testers ("what does the
 * bottom of Settings say?"). Under EAS remote versioning the build
 * number is the only thing that moves between TestFlight builds, so it
 * has to be shown alongside the version. Inside Expo Go these report
 * Expo Go's own version — only ever misleading on the dev machine.
 */
const buildLabel = [
  Application.nativeApplicationVersion,
  Application.nativeBuildVersion ? `(${Application.nativeBuildVersion})` : null,
]
  .filter(Boolean)
  .join(" ");

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputed, setRecomputed] = useState<RecomputeResult | null>(null);
  const [deniedAtOs, setDeniedAtOs] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);

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
      <ScreenHeader title="Settings" theme={theme} />
      <ScrollView style={styles.body} contentContainerStyle={styles.container}>
        {/* Feedback first, for the length of the TestFlight round. A
         *  suggestion is the most common thing a tester has to say and
         *  the easiest thing for them to give up on looking for; the
         *  problem log sits under it because that is where a sent note
         *  goes, so the pair reads as one thing. */}
        <Group theme={theme} flush>
          <Pressable
            onPress={() => router.push("/feedback" as Href)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.groupRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <AppText color={theme.ink} style={styles.grow}>
              Send feedback
            </AppText>
            <AppText variant="label" color={theme.muted}>
              ›
            </AppText>
          </Pressable>
          <GroupDivider theme={theme} />
          <Pressable
            onPress={() => router.push("/problem" as Href)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.groupRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <AppText color={theme.ink} style={styles.grow}>
              Problem log
            </AppText>
            <AppText variant="label" color={theme.muted}>
              ›
            </AppText>
          </Pressable>
        </Group>

        <Group theme={theme} flush>
          <Pressable
            onPress={() => router.push("/calibration" as Href)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.groupRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <AppText color={theme.ink} style={styles.grow}>
              Calibration
            </AppText>
            <AppText variant="label" color={theme.muted}>
              ›
            </AppText>
          </Pressable>
          <GroupDivider theme={theme} />
          <Pressable
            onPress={() => router.push("/backup" as Href)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.groupRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <AppText color={theme.ink} style={styles.grow}>
              Your data
            </AppText>
            <AppText variant="label" color={theme.muted}>
              ›
            </AppText>
          </Pressable>
          <GroupDivider theme={theme} />
          {/* Explicit by design (ADR-0004 §5): a scoring change must
              never restate history on its own, so this is the one way
              to opt in. */}
          <Pressable
            onPress={() => {
              if (recomputing) return;
              setRecomputing(true);
              setRecomputed(null);
              void recomputeAllGrades()
                .then(setRecomputed)
                .finally(() => setRecomputing(false));
            }}
            accessibilityRole="button"
            accessibilityState={{ disabled: recomputing }}
            style={({ pressed }) => [styles.groupRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={styles.grow}>
              <AppText color={theme.ink}>Recompute past grades</AppText>
              <AppText variant="caption" color={theme.muted}>
                {recomputing
                  ? "Working…"
                  : recomputed
                    ? `${recomputed.rederived} ${
                        recomputed.rederived === 1 ? "day" : "days"
                      } re-scored${
                        recomputed.skipped > 0
                          ? `, ${recomputed.skipped} left as they were`
                          : ""
                      }.`
                    : "Re-scores every past day under the current scoring, using the plan each day actually had."}
              </AppText>
            </View>
          </Pressable>
        </Group>

        {settings === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : (
          <Group theme={theme} title="Reminders">
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
          </Group>
        )}

        {/* The fuller statement onboarding's privacy screen points at
         *  (ADR-0011 decision 4). Plain facts, no reassurance voice.
         *  ADR-0013 added the crash-log paragraph: the log is the one
         *  new thing written outside the database, so leaving it
         *  unmentioned would make "sends nothing anywhere" a sentence
         *  the user has to take on trust rather than check. */}
        <Group theme={theme} title="Privacy">
          <AppText color={theme.ink}>
            Everything you enter is stored only on this device: rankings,
            tasks, grades, journal entries, photos, and contentment
            check-ins. Life Strategy has no account and no server, and
            sends nothing anywhere.
          </AppText>
          <AppText color={theme.ink} style={styles.resourceLine}>
            When something breaks, the technical details are written down
            here too: which screen, which version. The problem log shows you
            that text in full, and it only goes anywhere if you send it.
          </AppText>
          <AppText color={theme.ink} style={styles.resourceLine}>
            Send feedback hands what you typed to your own mail app, and
            you send it. The log notes that you sent something, never what
            you wrote. Neither one carries anything from inside the app with
            it.
          </AppText>
          <AppText color={theme.ink} style={styles.resourceLine}>
            Backups are encrypted with your passphrase before they leave
            the app, and go wherever you choose to put them. Without that
            passphrase, nobody can open one, including us.
          </AppText>
          <AppText variant="caption" color={theme.muted} style={styles.resourceLine}>
            Deleting Life Strategy deletes its data with it. Export a
            backup first if you want to keep it.
          </AppText>
        </Group>

        {/* The bottom of the screen, where anything that starts over
         *  belongs. Both rows carry a second line, because the whole
         *  difficulty here is that their names sound interchangeable and
         *  only one of them destroys anything. */}
        <Group theme={theme} flush>
          <Pressable
            onPress={() => {
              void resetOnboarding().then(() => router.replace("/onboarding"));
            }}
            accessibilityRole="button"
            accessibilityHint="Replays the welcome screens; your data is not changed"
            style={({ pressed }) => [styles.groupRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={styles.grow}>
              <AppText color={theme.ink}>Replay the introduction</AppText>
              <AppText variant="caption" color={theme.muted}>
                Walks through the welcome screens again. Nothing you've
                entered changes.
              </AppText>
            </View>
            <AppText variant="label" color={theme.muted}>
              ›
            </AppText>
          </Pressable>
          <GroupDivider theme={theme} />
          <Pressable
            onPress={() => setEraseOpen(true)}
            accessibilityRole="button"
            accessibilityHint="Deletes everything on this device and starts over"
            style={({ pressed }) => [styles.groupRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            {/* The one destructive action in the app, and the only
             *  place `danger` appears outside a goal being removed. */}
            <View style={styles.grow}>
              <AppText color={theme.danger}>Reset everything</AppText>
              <AppText variant="caption" color={theme.muted}>
                Deletes every rating, task, grade, and journal entry on
                this phone, and starts you over from scratch.
              </AppText>
            </View>
            <AppText variant="label" color={theme.muted}>
              ›
            </AppText>
          </Pressable>
        </Group>

        <Group theme={theme} title="Support">
          {/* No `resourceLine` on the first: the negative margin exists
              to tighten each line against the one above it, and this
              one now sits directly under the group title. */}
          <AppText color={theme.ink}>
            988 Suicide &amp; Crisis Lifeline: call or text 988.
          </AppText>
          <AppText color={theme.ink} style={styles.resourceLine}>
            Crisis Text Line: text HOME to 741741.
          </AppText>
          <AppText variant="caption" color={theme.muted} style={styles.resourceLine}>
            Or talk to a doctor, therapist, or someone you trust.
          </AppText>
        </Group>

        {buildLabel ? (
          <AppText
            variant="caption"
            color={theme.muted}
            selectable
            style={styles.build}
            tabular
          >
            Life Strategy {buildLabel}
          </AppText>
        ) : null}
      </ScrollView>

      <EraseDataModal
        visible={eraseOpen}
        onClose={() => setEraseOpen(false)}
        theme={theme}
        onConfirm={async () => {
          await eraseAllData();
          // Scheduled nudges live in the OS, not the database, so they
          // have to be cancelled explicitly — otherwise a wiped app
          // keeps reminding you about a checklist that's gone.
          await cancelAllNudges();
          await resetOnboarding();
          setEraseOpen(false);
          router.replace("/onboarding");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  /** Takes the space between the fixed header and the tab bar; the
   *  settings list scrolls inside it while both stay put. */
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingTop: space.sm, paddingBottom: space.xl },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  /** A row inside a flush Group: the group owns the fill and the side
   *  padding, so the row only owns its height and its own contents.
   *  Vertical padding rather than height alone, because the rows at the
   *  bottom carry a second explanatory line and would otherwise sit
   *  flush against their dividers. */
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.sm,
  },
  grow: { flex: 1 },
  caption: { marginTop: -space.xs },
  resourceLine: { marginTop: -space.xs },
  build: { marginTop: space.xxl, textAlign: "center" },
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
