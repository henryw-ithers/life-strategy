/**
 * The app's clock and its day ranges: which local date it is (3am
 * rollover), which past days are open for editing, and how far ahead a
 * day can be planned. Pure — no database — so screens and the data
 * layer share one definition of "today".
 */
import { addDays, editWindowStart, isEditable, localDateOf } from "@glide/scoring";

/** Rollover is a fixed 3am until settings ship (`app_setting` ready). */
export function currentLocalDate(): string {
  return localDateOf(new Date());
}

export function assertEditable(date: string): void {
  if (!isEditable(date, currentLocalDate())) {
    throw new Error("That day hasn't happened yet.");
  }
}

/** The 14 selectable days: last week's Sunday through this week's
 *  Sunday. Days after `today` are visible but disabled. */
export function editWindowDays(today: string): string[] {
  const start = editWindowStart(today);
  return Array.from({ length: 14 }, (_, i) => addDays(start, i));
}

/** Whether `date` is a day the planner will open. */
export function isPlannable(date: string, today: string): boolean {
  return date > today && date <= addDays(today, 28);
}
