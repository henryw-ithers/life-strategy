/**
 * Changing when the day starts (ADR-0049).
 *
 * Times are stored as minutes from their date's midnight, and a time
 * before the day starts is stored as the next morning (1am is 1500 when
 * the day starts at 3am). So a change moves every stored time onto the
 * new day: with the day starting at 2pm, a 9am class becomes 33:00 of
 * the day before it, which is where someone on nights lives it.
 *
 * Today's starting hours are kept first, so the commitment share of a
 * day already begun doesn't move (ADR-0044 §5). Settled grades are
 * never touched, and nothing is marked stale: no score reads the day
 * start.
 */
import { eq } from "drizzle-orm";

import { applyDayStart, currentLocalDate, dayStartHour, rebaseRange, rebaseStart } from "../lib/calendar";
import { db } from "./client";
import { freezeStartingHours } from "./hours";
import { dayWindowEdit, task, windowPlacement, workDayOverride, workHours } from "./schema";
import { DAY_START_KEY, setSettingIn } from "./settings";

type Range = { start: number; end: number };

/** A JSON list of ranges, or of objects holding one under `key`,
 *  moved onto the new day. Anything unreadable is left as it was. */
function rebaseJson(json: string, hour: number, key?: string): string {
  try {
    const list: unknown = JSON.parse(json);
    if (!Array.isArray(list)) return json;
    const move = (r: unknown) =>
      r && typeof r === "object" && typeof (r as Range).start === "number" && typeof (r as Range).end === "number"
        ? rebaseRange(r as Range, hour)
        : r;
    return JSON.stringify(
      list.map((item: unknown) => {
        if (key === undefined) return move(item);
        if (!item || typeof item !== "object") return item;
        const held = (item as Record<string, unknown>)[key];
        if (key === "ranges" && Array.isArray(held)) return { ...item, ranges: held.map(move) };
        return { ...item, [key]: move(held) };
      }),
    );
  } catch {
    return json;
  }
}

/** Start the day at `hour` (0–23) from now on. */
export async function changeDayStart(hour: number): Promise<void> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("The day must start on an hour.");
  if (hour === dayStartHour()) return;
  // The hours today began with, read under the old start, before
  // anything moves.
  await freezeStartingHours(currentLocalDate());
  db.transaction((tx) => {
    for (const v of tx.select().from(workHours).all()) {
      tx.update(workHours)
        .set({ schedules: rebaseJson(v.schedules, hour, "ranges"), gaps: rebaseJson(v.gaps, hour, "range") })
        .where(eq(workHours.fromDate, v.fromDate))
        .run();
    }
    for (const o of tx.select().from(workDayOverride).all()) {
      tx.update(workDayOverride)
        .set({ ranges: rebaseJson(o.ranges, hour) })
        .where(eq(workDayOverride.localDate, o.localDate))
        .run();
    }
    for (const e of tx.select().from(dayWindowEdit).all()) {
      const from = rebaseRange({ start: e.startMinute, end: e.endMinute }, hour);
      const to =
        e.toStartMinute !== null && e.toEndMinute !== null
          ? rebaseRange({ start: e.toStartMinute, end: e.toEndMinute }, hour)
          : null;
      tx.update(dayWindowEdit)
        .set({
          startMinute: from.start,
          endMinute: from.end,
          toStartMinute: to?.start ?? null,
          toEndMinute: to?.end ?? null,
        })
        .where(eq(dayWindowEdit.id, e.id))
        .run();
    }
    for (const p of tx.select({ id: windowPlacement.id, anchor: windowPlacement.anchorMinute }).from(windowPlacement).all()) {
      tx.update(windowPlacement).set({ anchorMinute: rebaseStart(p.anchor, hour) }).where(eq(windowPlacement.id, p.id)).run();
    }
    const timed = tx.select({ id: task.id, start: task.startMinute, end: task.endMinute }).from(task).all();
    for (const t of timed) {
      if (t.start === null) continue;
      const start = rebaseStart(t.start, hour);
      tx.update(task)
        .set({ startMinute: start, endMinute: t.end === null ? null : t.end + (start - t.start) })
        .where(eq(task.id, t.id))
        .run();
    }
    setSettingIn(tx, DAY_START_KEY, String(hour));
  });
  applyDayStart(hour);
}
