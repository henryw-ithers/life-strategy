/**
 * How an achievement reads (ADR-0047). Pure, so the data layer's month
 * review and the screens say it the same way.
 *
 * The copy guide's rules for runs hold here: a rank is something that
 * happened, said plainly; nothing says a run ended, and nothing puts a
 * past best beside a shorter run (§5).
 */
import { seriesById, type Rank, type SeriesId } from "@glide/scoring";

export const RANK_LABEL: Record<Rank, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

/** What a series is called, for the whole-app ones and section rows. */
export const SERIES_LABEL: Record<SeriesId, string> = {
  taskCompletions: "Completions",
  unitCompletions: "Completions",
  areaCompletions: "Completions",
  unitHours: "Hours",
  commitmentHours: "Hours",
  everyDayStreak: "Every day",
  weeklyTargetTotal: "Weeks on target",
  weeklyTargetRun: "Weeks in a row",
  wholeUnitTotal: "Whole weeks",
  wholeUnitRun: "Whole weeks in a row",
  attended: "Attended",
  goodDays: "Good days",
  greatDays: "Great days",
  greatDayRun: "Great days in a row",
  activities: "Logged",
  flaggedDays: "Worth remembering",
};

/** "100 completions", "50 hours". */
export function thresholdLabel(series: SeriesId, threshold: number): string {
  return `${threshold.toLocaleString("en")} ${seriesById(series).counts}`;
}

/** "Gold: 100 completions". */
export function rankLine(series: SeriesId, rank: Rank, threshold: number): string {
  return `${RANK_LABEL[rank]}: ${thresholdLabel(series, threshold)}`;
}

/** One earned rank as the log and the celebration name it: "Gold ·
 *  Morning run · 100 completions", or without a subject for the
 *  whole-app series. */
export function achievementTitle(a: {
  series: SeriesId;
  rank: Rank;
  threshold: number;
  subjectName: string;
}): string {
  const parts = [RANK_LABEL[a.rank], a.subjectName, thresholdLabel(a.series, a.threshold)];
  return parts.filter((p) => p !== "").join(" · ");
}

/** "12 Oct 2026": when a rank was earned. */
export function earnedDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * What's next and how far along: "Gold: 100 completions · 62 / 100".
 * For a run, its run now against the next rank. Null once Diamond is
 * earned, or for a subject that's gone.
 */
export function nextLine(a: {
  series: SeriesId;
  next: { rank: Rank; threshold: number } | null;
  progress: number | null;
}): string | null {
  if (a.next === null || a.progress === null) return null;
  const done = Math.min(a.progress, a.next.threshold);
  return `${rankLine(a.series, a.next.rank, a.next.threshold)} · ${done.toLocaleString("en")} / ${a.next.threshold.toLocaleString("en")}`;
}

/** The ranks earned, each with its day: "Bronze 3 Sep 2026 · Silver
 *  12 Oct 2026". */
export function earnedLine(earned: readonly { rank: Rank; earnedOn: string }[]): string | null {
  if (earned.length === 0) return null;
  return earned.map((e) => `${RANK_LABEL[e.rank]} ${earnedDate(e.earnedOn)}`).join(" · ");
}
