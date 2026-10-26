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
  // The score itself, never a label on it (Henry, 2026-10-21): no day
  // is called good or great.
  goodDays: "Days at 80 or above",
  greatDays: "Days at 90 or above",
  greatDayRun: "Days in a row at 90 or above",
  activities: "Logged",
  flaggedDays: "Worth remembering",
  // Badge names, game-style (Henry, 2026-10-25). Still never a verdict
  // on a day: the score series say the score.
  totalCompletions: "Getting it done",
  activeDays: "Showing up",
  activeDayRun: "On a roll",
  fullWeeks: "Full week",
  earlyBird: "Early bird",
  nightOwl: "Night owl",
  weekendTicks: "Weekend warrior",
  mostInOneDay: "Big day",
  mostUnitsWeek: "Spread wide",
  varietyWeeks: "Well rounded",
  totalHours: "Time invested",
  areaHours: "Hours",
  eventsAttended: "Turned up",
  quickWins: "Quick wins",
  bigTasks: "Heavy lifting",
  oneOffs: "Ticked off",
  partialSteps: "Step by step",
  tasksSetUp: "Architect",
  journalEntries: "Notekeeper",
  photos: "Snapshots",
  specialDays: "Special days",
  activityDays: "Off script",
  perfectDays: "Days at 100",
  days70: "Days at 70 or above",
};

/** "100 completions", "50 hours". */
export function thresholdLabel(series: SeriesId, threshold: number): string {
  return `${threshold.toLocaleString("en")} ${seriesById(series).counts}`;
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

