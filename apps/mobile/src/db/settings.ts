/**
 * Local app settings (ADR-0010 §6): a generic key/value store,
 * device-scoped by intent — if multi-device sync ever arrives
 * (ADR-0016), these keys don't sync.
 */
import { eq } from "drizzle-orm";

import { db } from "./client";
import { appSetting } from "./schema";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSetting).where(eq(appSetting.key, key));
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const [existing] = await db.select().from(appSetting).where(eq(appSetting.key, key));
  if (existing) {
    await db.update(appSetting).set({ value }).where(eq(appSetting.key, key));
  } else {
    await db.insert(appSetting).values({ key, value });
  }
}

const KEY_NOTIFICATIONS_ENABLED = "notifications.dailyNudge.enabled";
const KEY_NOTIFICATIONS_TIME = "notifications.dailyNudge.time";
const KEY_NOTIFICATIONS_PERMISSION_ASKED = "notifications.permissionAsked";

export interface NotificationSettings {
  enabled: boolean;
  /** "HH:MM", 24-hour, local wall-clock. */
  time: string;
}

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  const [enabled, time] = await Promise.all([
    getSetting(KEY_NOTIFICATIONS_ENABLED),
    getSetting(KEY_NOTIFICATIONS_TIME),
  ]);
  return { enabled: enabled === "true", time: time ?? "09:00" };
}

export async function setNotificationEnabled(enabled: boolean): Promise<void> {
  await setSetting(KEY_NOTIFICATIONS_ENABLED, enabled ? "true" : "false");
}

export async function setNotificationTime(time: string): Promise<void> {
  await setSetting(KEY_NOTIFICATIONS_TIME, time);
}

export async function hasAskedNotificationPermission(): Promise<boolean> {
  return (await getSetting(KEY_NOTIFICATIONS_PERMISSION_ASKED)) === "true";
}

export async function markNotificationPermissionAsked(): Promise<void> {
  await setSetting(KEY_NOTIFICATIONS_PERMISSION_ASKED, "true");
}

const KEY_CALIBRATION_GAP_COEFFICIENT = "calibration.gapCoefficient";

/** `null` = no override; `deriveWeights` falls back to the built-in
 *  `GAP_COEFFICIENT` constant (ADR-0008: a calibration lever, applied
 *  only on explicit user acceptance of a suggestion). */
export async function getGapCoefficientOverride(): Promise<number | null> {
  const value = await getSetting(KEY_CALIBRATION_GAP_COEFFICIENT);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function setGapCoefficientOverride(value: number): Promise<void> {
  await setSetting(KEY_CALIBRATION_GAP_COEFFICIENT, String(value));
}
