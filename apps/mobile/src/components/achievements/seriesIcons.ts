/**
 * Each series' icon, drawn in the middle of its shield (`ShieldBadge`).
 */
import type { SeriesId } from "@glide/scoring";

import type { BadgeIcon } from "./ShieldBadge";

export const SERIES_ICON: Record<SeriesId, BadgeIcon> = {
  taskCompletions: "checkmark-done",
  unitCompletions: "checkmark-done",
  areaCompletions: "checkmark-done",
  unitHours: "time",
  commitmentHours: "time",
  everyDayStreak: "flame",
  weeklyTargetTotal: "calendar",
  weeklyTargetRun: "repeat",
  wholeUnitTotal: "grid",
  wholeUnitRun: "albums",
  attended: "people",
  goodDays: "star-half",
  greatDays: "star",
  greatDayRun: "sparkles",
  activities: "create",
  flaggedDays: "bookmark",
  totalCompletions: "rocket",
  activeDays: "footsteps",
  activeDayRun: "flash",
  fullWeeks: "calendar-number",
  earlyBird: "sunny",
  nightOwl: "moon",
  weekendTicks: "bicycle",
  mostInOneDay: "trophy",
  mostUnitsWeek: "apps",
  varietyWeeks: "color-palette",
  totalHours: "hourglass",
  areaHours: "time",
  eventsAttended: "ticket",
  quickWins: "speedometer",
  bigTasks: "barbell",
  oneOffs: "checkbox",
  partialSteps: "trending-up",
  tasksSetUp: "construct",
  journalEntries: "book",
  photos: "camera",
  specialDays: "gift",
  activityDays: "compass",
  perfectDays: "diamond",
  days70: "ribbon",
};
