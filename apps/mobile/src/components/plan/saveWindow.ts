/**
 * Saving a window from the window sheet, wherever it was opened (Home,
 * Plan, the weekly pass): one path, so they can't drift apart.
 *
 * - **On an event:** asks first, as a new event does (Henry,
 *   2026-10-26). Replace skips that event on the day (or archives a
 *   one-time one) and the window keeps its whole time; Keep both trims
 *   the window around it (EC-53).
 * - **Every week:** written into the weekly hours from that day on
 *   (`withWindowOnWeekday`), rather than as a day edit.
 */
import { addedWindowPieces, isoWeekday, type TimeRange } from "@glide/scoring";

import { clashesOn } from "../../db/eventClash";
import { addDayEdit, loadHoursVersions, saveHoursFrom } from "../../db/hours";
import { loadLiveEvents, replaceEvents } from "../../db/seriesWrites";
import { draftFrom, withWindowOnWeekday } from "./hoursDraft";
import { askReplace } from "./saveEvent";

/**
 * Add a window to a day, or change one's times. Resolves to a problem
 * to show in the sheet, "" when cancelled at the replace question (the
 * sheet stays, saying nothing), or null once saved.
 */
export async function saveDayWindow(input: {
  date: string;
  /** The window being changed; absent when adding one. */
  from?: TimeRange;
  range: TimeRange;
  /** Every week on this weekday, from this day on. */
  weekly: boolean;
  /** The day's events, for trimming when kept. */
  events: readonly TimeRange[];
}): Promise<string | null> {
  const { date, from, range, weekly, events } = input;
  const clashes = clashesOn(date, range, await loadLiveEvents());
  const choice = await askReplace(clashes, "window");
  if (choice === null) return "";
  const replacing = choice === "replace";
  // Kept, a window over an event is trimmed around it, and can come to
  // nothing (EC-53): say so and save nothing.
  if (!replacing && addedWindowPieces(range, events).length === 0) {
    return "That time is taken up by an event, so there's no window left.";
  }
  try {
    if (replacing) await replaceEvents(clashes);
    if (weekly) {
      const version = draftFrom(await loadHoursVersions(), date);
      const schedules = withWindowOnWeekday(version.schedules, isoWeekday(date), from ?? null, range);
      await saveHoursFrom(date, schedules, version.gaps);
    } else {
      await addDayEdit(date, from ? { kind: "change", from, to: range } : { kind: "add", range });
    }
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
}
