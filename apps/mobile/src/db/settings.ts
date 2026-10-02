/**
 * Local app settings (ADR-0010 §6): a generic key/value store,
 * device-scoped by intent — if multi-device sync ever arrives
 * (ADR-0016), these keys don't sync.
 */
import { eq } from "drizzle-orm";

import { MAX_COMMITMENTS, normalizeBand } from "@glide/scoring";

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

const KEY_COMMITMENT_BAND = "commitment.band";

/**
 * How much of a **scheduled** day belongs to commitments (ADR-0032 §2).
 *
 * One number for the whole app, so it lives here rather than on a
 * table — there is no row it belongs to. The per-commitment *shares*
 * do have a row and live on `life_unit.commitment_share`.
 *
 * `null` means the user has not set one, which is not the same as
 * zero: with no band set, `loadDay` passes no `CommitmentDay` and every
 * day is the ordinary two-band day (planned 90, unplanned 10). That is what keeps the
 * feature invisible until it is used.
 *
 * > **Known limitation.** `app_setting` is device-scoped by intent —
 * > its header notes these keys would not sync if ADR-0016 ever lands.
 * > A scoring input that does not sync would be a real problem then,
 * > and the fix at that point is to move this to a synced row rather
 * > than to special-case the key. Recorded here so it is found.
 */
export async function loadCommitmentBand(): Promise<number | null> {
  const value = await getSetting(KEY_COMMITMENT_BAND);
  if (value === null || value === "") return null;
  const parsed = Number(value);
  // Normalised against the highest cap, three commitments' 80. The cap
  // for however many there are today is applied where the band is used
  // (`commitmentBandOn`), so archiving one never rewrites the setting.
  return Number.isFinite(parsed) ? normalizeBand(parsed, MAX_COMMITMENTS) : null;
}

/** Stored normalised, so a value out of range cannot reach the engine
 *  even if this is called with one (ADR-0032 §2: 10 up to 60, 70 or 80
 *  for one, two or three commitments). */
export async function setCommitmentBand(band: number): Promise<void> {
  await setSetting(KEY_COMMITMENT_BAND, String(normalizeBand(band, MAX_COMMITMENTS)));
}

/** Forget the band entirely — every day goes back to two bands. */
export async function clearCommitmentBand(): Promise<void> {
  await setSetting(KEY_COMMITMENT_BAND, "");
}

const KEY_DAY_LAYOUT = "today.layout";

/** How the day is drawn: as a checklist, or against the hours. */
export type DayLayout = "checklist" | "grid";

/**
 * Which way the day reads (ADR-0024 §3, amended for the hour grid).
 *
 * **Presentation, and only presentation.** The two views hold the same
 * tasks with the same completion state and the same points; this
 * decides which one is drawn and nothing else. It never reaches
 * `loadDay`, and no scoring path reads it.
 *
 * Defaults to `checklist`, which is the app as it has always been —
 * so somebody who never times anything never meets the grid.
 *
 * Lives in `app_setting` because `eraseAllData` already carries that
 * table without a special case.
 */
export async function loadDayLayout(): Promise<DayLayout> {
  return (await getSetting(KEY_DAY_LAYOUT)) === "grid" ? "grid" : "checklist";
}

export async function setDayLayout(layout: DayLayout): Promise<void> {
  await setSetting(KEY_DAY_LAYOUT, layout);
}
