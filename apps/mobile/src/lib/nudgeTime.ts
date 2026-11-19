/**
 * When the daily reminder fires. Pure, so it is tested off-device; the
 * scheduling itself is in notifications/dailyNudge.ts.
 *
 * The reminder belongs to a planning day (ADR-0049), not a calendar
 * date: with the day starting at 3am, a 1am reminder for Monday fires on
 * Tuesday's calendar date, and at 00:30 on Tuesday it is still Monday.
 */

/** The instant `time` ("HH:MM") falls at within planning day `date`. */
export function reminderAt(date: string, time: string, dayStartHour: number): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, min] = time.split(":").map(Number);
  const hour = h ?? 9;
  const minute = min ?? 0;
  // A time before the day starts is the small hours at that day's end.
  const nextMorning = hour * 60 + minute < dayStartHour * 60 ? 1 : 0;
  return new Date(y, m - 1, d + nextMorning, hour, minute, 0, 0);
}

/** Today's reminder if it's still ahead and today isn't handled; else
 *  the next planning day's. `today` is the planning day. */
export function nextReminder(
  today: string,
  time: string,
  handled: boolean,
  dayStartHour: number,
  now: Date = new Date(),
): Date {
  const todays = reminderAt(today, time, dayStartHour);
  if (!handled && todays.getTime() > now.getTime()) return todays;
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const next = new Date(y, m - 1, d + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return reminderAt(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`, time, dayStartHour);
}
