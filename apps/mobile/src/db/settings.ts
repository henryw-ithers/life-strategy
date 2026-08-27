/**
 * Local app settings (ADR-0010 §6): a generic key/value store,
 * device-scoped by intent — if multi-device sync ever arrives
 * (ADR-0016), these keys don't sync.
 */
import { eq } from "drizzle-orm";

import { FEEDBACK_KINDS, type FeedbackKind } from "../lib/feedback";
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

const KEY_FEEDBACK_DRAFT = "feedback.draft";
const KEY_FEEDBACK_KIND = "feedback.kind";

export interface FeedbackDraft {
  kind: FeedbackKind;
  text: string;
}

/**
 * A half-written suggestion survives leaving the screen.
 *
 * Feedback gets typed in the moment something is annoying, which is
 * exactly the moment the user is likely to be interrupted — and losing
 * it silently teaches them not to bother a second time. It lives in
 * `app_setting` rather than a file so `eraseAllData` takes it along
 * without a special case.
 */
export async function loadFeedbackDraft(): Promise<FeedbackDraft> {
  const [text, kind] = await Promise.all([
    getSetting(KEY_FEEDBACK_DRAFT),
    getSetting(KEY_FEEDBACK_KIND),
  ]);
  return {
    text: text ?? "",
    kind: FEEDBACK_KINDS.includes(kind as FeedbackKind)
      ? (kind as FeedbackKind)
      : "suggestion",
  };
}

export async function saveFeedbackDraft(draft: FeedbackDraft): Promise<void> {
  await setSetting(KEY_FEEDBACK_DRAFT, draft.text);
  await setSetting(KEY_FEEDBACK_KIND, draft.kind);
}

export async function clearFeedbackDraft(): Promise<void> {
  await setSetting(KEY_FEEDBACK_DRAFT, "");
}

/**
 * `calibration.gapCoefficient` **retired 2026-08-26 (ADR-0028 §1).**
 *
 * It held ADR-0008's one calibration override: a user-accepted
 * adjustment to the strength of the satisfaction-gap boost in
 * `deriveWeights`. Formula v8 removed that term, so the setting has
 * nothing left to override and both accessors are gone.
 *
 * The stored row, if a user ever accepted a suggestion, is deliberately
 * **not deleted**. Nothing reads it, it costs one row, and the settings
 * table is the app's own record of what it was once asked to do.
 */
