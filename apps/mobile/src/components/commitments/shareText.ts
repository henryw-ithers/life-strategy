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

/** "about 44% on Wednesdays", from the day with the largest share; null
 *  with no work in the week ahead. */
export function automaticText(week: readonly ShareDay[]): string | null {
  const top = [...week].sort((a, b) => b.automatic - a.automatic || a.date.localeCompare(b.date))[0];
  if (!top) return null;
  const weekday = new Date(`${top.date}T12:00:00`).toLocaleDateString("en-AU", { weekday: "long" });
  return `about ${top.automatic}% on ${weekday}s`;
}

/** The row's value: "auto (about 44% on Wednesdays)", or "60% · auto
 *  about 44% on Wednesdays" with a share you set. */
export function shareRowText(week: readonly ShareDay[], setShare: number | null): string {
  const auto = automaticText(week);
  if (setShare === null) return auto ? `auto (${auto})` : "auto · no work in the week ahead";
  return auto ? `${setShare}% · auto ${auto}` : `${setShare}%`;
}
