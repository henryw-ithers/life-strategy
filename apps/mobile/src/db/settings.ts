/**
 * Local app settings (ADR-0010 §6): a generic key/value store,
 * device-scoped by intent — if multi-device sync ever arrives
 * (ADR-0016), these keys don't sync.
 */
import { eq } from "drizzle-orm";

import { FEEDBACK_KINDS, type FeedbackKind } from "../lib/feedback";
import { db } from "./client";
import { appSetting } from "./schema";
import type { Tx } from "./tasks";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSetting).where(eq(appSetting.key, key));
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  setSettingIn(db, key, value);
}

/** `setSetting` inside a transaction (see `Tx`). */
export function setSettingIn(executor: Tx | typeof db, key: string, value: string): void {
  const [existing] = executor.select().from(appSetting).where(eq(appSetting.key, key)).all();
  if (existing) {
    executor.update(appSetting).set({ value }).where(eq(appSetting.key, key)).run();
  } else {
    executor.insert(appSetting).values({ key, value }).run();
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

const EVENTS_ONCE_KEY = "events_default_once";

/**
 * Whether a new event starts as one-time rather than weekly: for shifts
 * that change week to week (ADR-0040 §6). Onboarding's shift-work
 * template turns it on (ADR-0045); Settings → Your days has the switch.
 */
export async function eventsDefaultOnce(): Promise<boolean> {
  return (await getSetting(EVENTS_ONCE_KEY)) === "1";
}

export async function setEventsDefaultOnce(on: boolean): Promise<void> {
  await setSetting(EVENTS_ONCE_KEY, on ? "1" : "0");
}

const SCORE_EXPLAINED_KEY = "score.explained";

/**
 * Whether the score breakdown has explained the score yet. Its first
 * open does (ADR-0045 §1 step 6), since onboarding says only one line
 * about it; marked once it's actually shown.
 */
export async function scoreExplained(): Promise<boolean> {
  return (await getSetting(SCORE_EXPLAINED_KEY)) === "1";
}

export async function markScoreExplained(): Promise<void> {
  await setSetting(SCORE_EXPLAINED_KEY, "1");
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

// `commitment.band`, the old hand-set commitment band (ADR-0032 §2), is
// retired: since formula v11 the band is each day's commitment share
// (ADR-0044, `loadCommitmentDay`). A stored value is left in place and
// read by nothing.

const KEY_GRADES_STALE = "grades.stale";

/**
 * Note that the plan changed under the stored day grades, so they no
 * longer match what the days would score now. `refreshStaleGrades` (in
 * db/dayGrades.ts) re-scores them on the next read. Stored, not held in
 * memory, so a change made just before the app is closed still lands.
 */
export async function markGradesStale(): Promise<void> {
  markGradesStaleIn(db);
}

/** `markGradesStale` inside a transaction, which has to be synchronous
 *  (see `Tx`). An upsert, so a pricing pass can mark inside its own. */
export function markGradesStaleIn(executor: Tx | typeof db): void {
  executor
    .insert(appSetting)
    .values({ key: KEY_GRADES_STALE, value: "1" })
    .onConflictDoUpdate({ target: appSetting.key, set: { value: "1" } })
    .run();
}

/**
 * Run a plan change and mark grades stale in one transaction, so a
 * crash between the two can never save the change without the mark.
 * `write` must be synchronous (see `Tx`). Returns what it returns.
 */
export function writeAndMarkStale<T>(write: (tx: Tx) => T): T {
  return db.transaction((tx) => {
    const result = write(tx);
    markGradesStaleIn(tx);
    return result;
  });
}

/** Whether grades are marked stale. */
export async function gradesAreStale(): Promise<boolean> {
  return (await getSetting(KEY_GRADES_STALE)) === "1";
}

/** Whether grades were marked stale, clearing the mark if so. */
export async function takeGradesStale(): Promise<boolean> {
  if (!(await gradesAreStale())) return false;
  await setSetting(KEY_GRADES_STALE, "0");
  return true;
}

