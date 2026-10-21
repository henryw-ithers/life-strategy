/**
 * How a commitment's share of the day reads on its screen (spec §5.5):
 * the automatic share at its largest this week ("about 44% on
 * Wednesdays"), and a share you set with the automatic one beside it,
 * as every override is shown (AGENTS.md).
 */
export interface ShareDay {
  readonly date: string;
  readonly automatic: number;
}

/**
 * "about 44% on Wednesdays": a typical day's automatic share, the
 * middle of the week ahead's days with work (ADR-0044 §3), never above
 * the limit the share is held to. Null with no work in the week ahead.
 */
export function automaticText(week: readonly ShareDay[], limit = 100): string | null {
  const sorted = [...week].sort((a, b) => a.automatic - b.automatic || a.date.localeCompare(b.date));
  const typical = sorted[Math.floor((sorted.length - 1) / 2)];
  if (!typical) return null;
  const weekday = new Date(`${typical.date}T12:00:00`).toLocaleDateString("en-AU", { weekday: "long" });
  return `about ${Math.min(limit, typical.automatic)}% on ${weekday}s`;
}

/** The row's value: "auto (about 44% on Wednesdays)", or "60% · auto
 *  about 44% on Wednesdays" with a share you set. */
export function shareRowText(
  week: readonly ShareDay[],
  setShare: number | null,
  limit = 100,
): string {
  const auto = automaticText(week, limit);
  if (setShare === null) return auto ? `auto (${auto})` : "auto · no work in the week ahead";
  return auto ? `${setShare}% · auto ${auto}` : `${setShare}%`;
}
