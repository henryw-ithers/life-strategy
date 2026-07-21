/** Presentation-side date formatting shared across screens. */

/** "Monday, 20 July" from a local 'YYYY-MM-DD' — the app's spoken and
 *  displayed long-date form, also used for accessibility labels so
 *  screen readers never hear raw ISO strings. */
export function spokenDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
