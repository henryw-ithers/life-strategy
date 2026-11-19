/**
 * The daily checklist nudge (ADR-0010 §2, the only notification v1
 * ships). Exactly one local notification is ever scheduled — cancel
 * everything, then reschedule for today or tomorrow depending on
 * whether today is already handled. Called after every event that
 * could change that: app open, task completion, rest-day declaration,
 * and settings changes.
 */
import { router, type Href } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { randomNotificationLine } from "../content/notificationCopy";
import { dayStartHour } from "../lib/calendar";
import { nextReminder } from "../lib/nudgeTime";
import type { DayData } from "../db/today";
import {
  loadNotificationSettings,
  markNotificationPermissionAsked,
  setNotificationEnabled,
} from "../db/settings";

/** A tapped reminder opens Today, wherever the app was. iOS only:
 *  `expo-notifications` throws on web (see below). */
export function useNudgeOpensToday(): void {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (response?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.navigate("/" as Href);
    }
  }, [response]);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Scheduling a local notification is an OS facility with no web
 * equivalent, and `expo-notifications` throws there rather than doing
 * nothing — which took out the Today tab in the browser preview, since
 * that screen re-syncs the nudge on every open.
 *
 * Web is a development preview surface for this app, not a target
 * (ADR-0010 ships the nudge on device), so the schedule and cancel
 * calls are skipped rather than shimmed against a Notification API
 * that would behave nothing like the real one.
 */
const canSchedule = Platform.OS !== "web";

export interface PermissionState {
  granted: boolean;
  /** false once the OS has denied — the app can no longer prompt; the
   *  settings screen should deep-link to the system settings instead. */
  canAskAgain: boolean;
}

export async function getPermissionStatus(): Promise<PermissionState> {
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  return { granted, canAskAgain };
}

export async function requestPermission(): Promise<PermissionState> {
  const { granted, canAskAgain } = await Notifications.requestPermissionsAsync();
  return { granted, canAskAgain };
}

/**
 * The in-app yes (ADR-0010 §4): ask the OS, turn the nudge on if it
 * agrees, and remember that we asked. Resolves whether it was granted.
 */
export async function askForNudge(): Promise<boolean> {
  const { granted } = await requestPermission();
  if (granted) await setNotificationEnabled(true);
  await markNotificationPermissionAsked();
  return granted;
}

/** The in-app no, final until Settings (ADR-0010 §4). */
export async function declineNudge(): Promise<void> {
  await markNotificationPermissionAsked();
}

/** All of today's actionable tasks are done, or today is declared a
 *  rest/special day. `doneThisWeek` tasks already met their goal on an
 *  earlier day and don't need today's action, so they don't block this. */
export function isDayHandled(day: DayData): boolean {
  if (day.kind !== "normal") return true;
  return [...day.due, ...day.week].every((t) => t.completedToday);
}

/**
 * Drops any scheduled nudge without scheduling a replacement. Used by
 * the data erase: a scheduled notification lives in the OS, not in the
 * database, so wiping the data would otherwise leave a reminder to
 * finish a checklist that no longer exists.
 */
export async function cancelAllNudges(): Promise<void> {
  if (!canSchedule) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Re-derives the single scheduled nudge from scratch: cancels
 * whatever's currently scheduled, then — if the reminder is enabled
 * and permitted — schedules exactly one upcoming occurrence.
 */
export function syncDailyNudge(day: DayData): Promise<void> {
  // One at a time: two syncs started close together (a focus reload and
  // a tick) would each cancel, then each schedule, leaving two.
  const run = syncing.then(() => syncNow(day));
  syncing = run.catch(() => undefined);
  return run;
}

let syncing: Promise<void> = Promise.resolve();

async function syncNow(day: DayData): Promise<void> {
  if (!canSchedule) return;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const settings = await loadNotificationSettings();
  if (!settings.enabled) return;

  const { granted } = await getPermissionStatus();
  if (!granted) return;

  // From the planning day, not the calendar date (ADR-0049).
  const date = nextReminder(day.today, settings.time, isDayHandled(day), dayStartHour());
  await Notifications.scheduleNotificationAsync({
    content: { body: randomNotificationLine() },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}
