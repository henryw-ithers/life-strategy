/**
 * The daily checklist nudge (ADR-0010 §2, the only notification v1
 * ships). Exactly one local notification is ever scheduled — cancel
 * everything, then reschedule for today or tomorrow depending on
 * whether today is already handled. Called after every event that
 * could change that: app open, task completion, rest-day declaration,
 * and settings changes.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { randomNotificationLine } from "../content/notificationCopy";
import type { DayData } from "../db/today";
import { loadNotificationSettings } from "../db/settings";

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

/** All of today's actionable tasks are done, or today is declared a
 *  rest/special day. `doneThisWeek` tasks already met their goal on an
 *  earlier day and don't need today's action, so they don't block this. */
export function isDayHandled(day: DayData): boolean {
  if (day.kind !== "normal") return true;
  return [...day.due, ...day.week].every((t) => t.completedToday);
}

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h ?? 9, minute: m ?? 0 };
}

/** Today at the target time if it hasn't passed and today isn't
 *  handled yet; otherwise tomorrow at the target time. */
function nextFireDate(time: string, handled: boolean): Date {
  const { hour, minute } = parseTime(time);
  const today = new Date();
  today.setHours(hour, minute, 0, 0);
  if (!handled && today.getTime() > Date.now()) return today;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
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
export async function syncDailyNudge(day: DayData): Promise<void> {
  if (!canSchedule) return;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const settings = await loadNotificationSettings();
  if (!settings.enabled) return;

  const { granted } = await getPermissionStatus();
  if (!granted) return;

  const date = nextFireDate(settings.time, isDayHandled(day));
  await Notifications.scheduleNotificationAsync({
    content: { body: randomNotificationLine() },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}
