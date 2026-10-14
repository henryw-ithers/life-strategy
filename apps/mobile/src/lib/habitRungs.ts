/**
 * How a habit rung is written into the log, and how to read it back
 * (ADR-0030 §5).
 *
 * A rung's achievement stores its title as text, "30 days of Running",
 * so the log keeps the name it was earned under. Deciding whether a
 * rung is already recorded must read the day count, never the whole
 * title: goals can be renamed (ADR-0043 §5), and matching on the title
 * would record every rung again under the new name.
 */

export function habitRungTitle(days: number, goalTitle: string): string {
  return `${days} days of ${goalTitle}`;
}

/** The rung a recorded title stands for, or null if it isn't one. */
export function rungDaysOf(titleSnapshot: string): number | null {
  const match = /^(\d+) days of /.exec(titleSnapshot);
  return match ? Number(match[1]) : null;
}
