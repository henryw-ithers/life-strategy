/**
 * Saving a window from the window sheet, wherever it was opened (Home,
 * Plan, the weekly pass): one path, so they can't drift apart.
 *
 * - **On an event:** trimmed around it (EC-53). A window never replaces
 *   an event: windows never change what's due (ADR-0039 §12; Henry,
 *   2026-10-26).
 * - **Every week:** written into the weekly hours from that day on
 *   (`withWindowOnWeekday`), rather than as a day edit.
 */
import { addedWindowPieces, isoWeekday, type TimeRange } from "@glide/scoring";

import { addDayEdit, loadHoursVersions, saveHoursFrom } from "../../db/hours";
import { draftFrom, withWindowOnWeekday } from "./hoursDraft";

/**
 * Add a window to a day, or change one's times. Resolves to a problem
 * to show in the sheet, or null once saved.
 */
export async function saveDayWindow(input: {
  date: string;
  /** The window being changed; absent when adding one. */
  from?: TimeRange;
  range: TimeRange;
  /** Every week on this weekday, from this day on. Adding only: a
   *  change keeps to its day. */
  weekly: boolean;
  /** The day's events, for trimming when kept. */
  events: readonly TimeRange[];
}): Promise<string | null> {
  const { date, from, range, weekly, events } = input;
  // A window over an event is trimmed around it, and can come to
  // nothing (EC-53): say so and save nothing.
  if (addedWindowPieces(range, events).length === 0) {
    return "That time is taken up by an event, so there's no window left.";
  }
  try {
    if (weekly && !from) {
      const version = draftFrom(await loadHoursVersions(), date);
      const schedules = withWindowOnWeekday(version.schedules, isoWeekday(date), null, range);
      await saveHoursFrom(date, schedules, version.gaps);
    } else {
      await addDayEdit(date, from ? { kind: "change", from, to: range } : { kind: "add", range });
    }
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
}
