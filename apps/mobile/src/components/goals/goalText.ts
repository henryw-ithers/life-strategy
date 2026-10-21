/**
 * How a goal reads (spec §5.6, ADR-0042): a running total like "18 / 30
 * times", never a pace line or a share of what was on offer. A streak
 * shows only its current run, and only from 7 days, so a run that ends
 * is never noticed; the 7, 30 and 66-day marks are celebrated when
 * reached. Pure, so it's tested off-device.
 */
import type { GoalKind } from "@glide/scoring";

export interface GoalShown {
  readonly kind: GoalKind;
  readonly status: string;
  /** Times, hours or points; a streak's run, or null under 7 days. */
  readonly value: number | null;
  readonly target: number | null;
  readonly reached: boolean;
}

/** One decimal for hours, whole numbers otherwise. */
const amount = (kind: GoalKind, n: number): string =>
  kind === "timeSpent" ? String(Math.round(n * 10) / 10) : String(Math.round(n));

const UNIT: Record<Exclude<GoalKind, "streak">, string> = {
  timesDone: "times",
  timeSpent: "hours",
  pointsEarned: "points",
};

/** "18 / 30 times", "12 days in a row", or null (a streak under 7). */
export function progressText(g: GoalShown): string | null {
  if (g.kind === "streak") {
    return g.value === null ? null : `${g.value} ${g.value === 1 ? "day" : "days"} in a row`;
  }
  const value = amount(g.kind, g.value ?? 0);
  return g.target === null ? `${value} ${UNIT[g.kind]}` : `${value} / ${amount(g.kind, g.target)} ${UNIT[g.kind]}`;
}

/** The marks a streak has reached: 7, 30, 66 days. Celebration only. */
export function streakMarks(run: number | null): number[] {
  return run === null ? [] : [7, 30, 66].filter((m) => run >= m);
}

/** A goal's state in words, or null while it's simply active. Never
 *  "behind" or "missed": reaching a target invites finishing it. */
export function statusText(g: GoalShown): string | null {
  if (g.status === "paused") return "Paused";
  if (g.status === "completed") return "Finished";
  if (g.status === "abandoned") return "Set aside";
  if (g.reached) return "Target reached. Finish it when you're ready.";
  return null;
}

/** The goal kinds in the sheet, in the spec's order, with what each counts. */
export const KIND_LABEL: Record<GoalKind, { name: string; counts: string }> = {
  timesDone: { name: "Times done", counts: "Ticks of tasks you choose" },
  timeSpent: { name: "Time spent", counts: "Each tick's size, or the time you enter" },
  pointsEarned: { name: "Points earned", counts: "Everything here, as a running total" },
  streak: { name: "Streak", counts: "Days in a row of one every-day task" },
};
