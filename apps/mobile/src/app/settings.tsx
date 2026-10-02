/**
 * Settings (ADR-0010 §6): exactly two controls for the daily nudge — a
 * toggle and a time picker. Future deferred reminders each get their
 * own toggle here later; never a single master switch.
 *
 * **Reordered and renamed 2026-08-19.** The screen had six groups and
 * four of them had no heading at all, so the first thing a reader met
 * was four anonymous rows. It opened on *Send feedback* and *Problem
 * log* — deliberately, for the length of the TestFlight round, but the
 * effect was an app whose settings front door is a bug reporter. And
 * the privacy statement, the strongest thing this app can say about
 * itself, was four paragraphs of prose wedged between a switch and a
 * destructive button, where a scanning eye stops dead.
 *
 * Now every group is named and the order follows what someone came here
 * to do: tune the plan, tune the reminder, look after the data, find
 * help, start over. Destructive last, which is both the platform
 * convention and the only safe place for it.
 *
 * **Consequence moved from rows to footnotes.** A row should read as a
 * name; the sentence explaining what it costs sits under the group
 * (`Group`'s `footnote`). That keeps the list scannable and still says
 * the thing before the tap.
 */
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Application from "expo-application";
import * as Linking from "expo-linking";
import { router, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, useColorScheme, View } from "react-native";

import { EraseDataModal } from "../components/settings/EraseDataModal";
import { AppText } from "../components/ui/AppText";
import { LoadFailure, useScreenLoad } from "../components/ui/ScreenLoad";
import { Backdrop, hueWash } from "../components/ui/Backdrop";
import { Group, GroupDivider } from "../components/ui/Group";
import { SettingsRow } from "../components/ui/SettingsRow";
import { ScreenHeader } from "../components/ui/ScreenHeader";
import {
  loadNotificationSettings,
  markNotificationPermissionAsked,
  setNotificationEnabled,
  setNotificationTime,
  type NotificationSettings,
} from "../db/settings";
import { resetOnboarding } from "../db/onboarding";
import { eraseAllData } from "../db/reset";
import { currentLocalDate } from "../lib/calendar";
import { loadDay } from "../db/today";
import {
  cancelAllNudges,
  getPermissionStatus,
  requestPermission,
  syncDailyNudge,
} from "../notifications/dailyNudge";
import { getTheme } from "../theme/colors";
import { radius, space } from "../theme/tokens";

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

  const { error, retry } = useScreenLoad(reload);

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
      <ScreenHeader
        title="Settings"
        theme={theme}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/log" as Href))}
      />
      <ScrollView style={styles.body} contentContainerStyle={styles.container}>
        {/* Tuning the plan itself comes first: it is the only thing here
            that changes what the app shows you tomorrow. */}
        <Group theme={theme} title="Your plan" footnote="Calibration checks whether the daily grade matches how the week actually felt." flush>
          <SettingsRow
            label="Calibration"
            onPress={() => router.push("/calibration" as Href)}
            theme={theme}
          />
        </Group>

        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : settings === null ? (
          <ActivityIndicator color={theme.muted} style={styles.loading} />
        ) : (
          <Group
            theme={theme}
            title="Reminders"
            footnote="One nudge, only when today’s list still needs you. It never says what’s on it."
          >
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

            {settings.enabled ? (
              <View style={styles.timeRow}>
                <AppText color={theme.ink} style={styles.grow}>
                  Time
                </AppText>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Reminder time, ${settings.time}`}
                  style={({ pressed }) => [
                    styles.timeChip,
                    { borderColor: theme.hairline, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <AppText color={theme.ink} tabular>
                    {settings.time}
                  </AppText>
                </Pressable>
              </View>
            ) : null}

            {deniedAtOs ? (
              <Pressable
                onPress={() => void Linking.openSettings()}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.deniedBox,
                  { borderColor: theme.hairline, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <AppText color={theme.ink}>
                  Notifications are off at the system level.
                </AppText>
                <AppText variant="label" color={theme.accent}>
                  Open system settings
                </AppText>
              </Pressable>
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

        {/* The privacy statement is a row here and a screen of its own
            (ADR-0011 decision 4). Its summary stays on the surface,
            because "stays on this phone" is the reason to trust the
            rest of this list. */}
        <Group
          theme={theme}
          title="Your data"
          footnote="Everything stays on this phone. No account, no server, nothing uploaded."
          flush
        >
          <SettingsRow
            label="Backup and restore"
            onPress={() => router.push("/backup" as Href)}
            theme={theme}
          />
          <GroupDivider theme={theme} />
          <SettingsRow
            label="Where your data lives"
            onPress={() => router.push("/privacy" as Href)}
            theme={theme}
          />
        </Group>

        <Group theme={theme} title="Help" flush>
          <SettingsRow
            label="Send feedback"
            onPress={() => router.push("/feedback" as Href)}
            theme={theme}
          />
          <GroupDivider theme={theme} />
          <SettingsRow
            label="Problem log"
            onPress={() => router.push("/problem" as Href)}
            theme={theme}
          />
        </Group>

        {/* ADR-0008: exactly one neutral mention, framed as availability,
            reading identically for a user who is thriving and one who is
            not. Not a row, because a row invites a tap it does not have. */}
        <Group theme={theme} title="Support">
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

        {/* Last, and in this order: the harmless one above the one that
            destroys everything. Their names sound interchangeable, which
            is exactly why the destructive one is Ink-red and carries the
            only second line left in the list. */}
        <Group theme={theme} title="Start over" flush>
          <SettingsRow
            label="Replay the introduction"
            detail="Walks through the welcome screens again. Nothing you’ve entered changes."
            hint="Replays the welcome screens; your data is not changed"
            onPress={() => {
              void resetOnboarding().then(() => router.replace("/onboarding"));
            }}
            theme={theme}
          />
          <GroupDivider theme={theme} />
          <SettingsRow
            label="Reset everything"
            detail="Deletes every rating, task, grade, and journal entry on this phone."
            hint="Deletes everything on this device and starts over"
            destructive
            onPress={() => setEraseOpen(true)}
            theme={theme}
          />
        </Group>

        {buildLabel ? (
          <AppText
            variant="footnote"
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
  container: { paddingHorizontal: space.screen, paddingTop: space.sm, paddingBottom: space.xxxl },
  loading: { marginTop: space.xxl },
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
