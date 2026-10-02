/**
 * How the Today screen arranges a loaded day: which rows go in which
 * section, in what order, and what each section totals. Pure — no React,
 * no database — so the arrangement is testable on its own.
 *
 * **The checklist is the shape of a day** (ADR-0024 §3, as amended
 * 2026-08-17). The three parts of the day always render, in order,
 * whether or not anything sits in them; an empty one reads *Free*, or
 * *All done* once its tasks are ticked off. A day whose morning is
 * missing from the page does not read as a day, and "free until this
 * afternoon" is the single most useful thing the screen can say.
 *
 * `anytime` holds everything deliberately left unplaced. It is not a
 * fourth time of day, so it appears only when it has something in it.
 * `otherDays`, `doneWeek` and `completed` behave the same way and sit
 * last.
 */
import { ROLLOVER_HOUR } from "@glide/scoring";

import type { DayLayout } from "../../db/settings";
import type { DayData, TodayTask } from "../../db/today";
import {
  ANYTIME_LABEL,
  carriedPart,
  compareForDay,
  emptyPeriodNote,
  isPast,
  partNow,
  PART_OF_DAY_LABEL,
  PART_OF_DAY_ORDER,
  pinnedElsewhere,
  type PartOfDay,
} from "../plan/planning";

export type SectionKey =
  | "morning"
  | "afternoon"
  | "evening"
  | "anytime"
  | "otherDays"
  | "doneWeek"
  | "completed";

export interface DaySection {
  key: SectionKey;
  label: string;
  tasks: TodayTask[];
  pts: number;
  /** Set only where the rows are not all loaded yet. */
  count?: number;
  /** Null means the section hides when it empties — the rule for
   *  everything that is not one of the three periods. */
  emptyNote: string | null;
}

/** The parts of the day that form one drag surface; the rest of the
 *  page is history or another day's business. */
export const ARRANGEABLE: readonly SectionKey[] = ["morning", "afternoon", "evening", "anytime"];

/**
 * Minutes into today. Past midnight and before the 3am rollover it is
 * still today, so the count runs on past 1440 rather than wrapping to
 * a morning that has not started.
 */
export function minuteOfToday(now: Date = new Date()): number {
  const minute = now.getHours() * 60 + now.getMinutes();
  return now.getHours() < ROLLOVER_HOUR ? minute + 24 * 60 : minute;
}

/** Done today, or done ahead on an earlier day (ADR-0032 §4). */
export function isDone(t: TodayTask): boolean {
  return t.completedToday || t.doneAheadOn !== null;
}

export interface ArrangedDay {
  /** Every row the day holds, finished or not. */
  allTasks: TodayTask[];
  /** Unfinished rows, whether for today or planned for another day. */
  openTasks: TodayTask[];
  /** Unfinished rows that belong to today. */
  todayTasks: TodayTask[];
  /** Where a row sits on the checklist (see `shownPart`). */
  shownPart: (t: TodayTask) => PartOfDay | null;
  /** The checklist's ordering within a section. */
  byPlan: (a: TodayTask, b: TodayTask) => number;
  /** The draggable parts of the day, empty periods included. */
  arrangeable: DaySection[];
  /** Planned for other days, done this week, completed. */
  tailSections: DaySection[];
  /** The rows the hours grid draws: today's work, done or not. */
  gridTasks: TodayTask[];
  /** Whether the hours view is worth offering. */
  showsGrid: boolean;
}

/**
 * Arrange `day` for the screen.
 *
 * @param ahead One-offs planned for later days, once "Planned for other
 *   days" has been opened and loaded them; null until then.
 * @param nowMinute `minuteOfToday()` on today, null on any other day.
 */
export function arrangeDay(
  day: DayData,
  ahead: TodayTask[] | null,
  nowMinute: number | null,
  layout: DayLayout,
): ArrangedDay {
  const allTasks = [...day.due, ...day.week, ...day.doneThisWeek];

  // Ordering and the other-days split both live in `planning.ts`, so the
  // checklist and the planner cannot drift into arranging the same day
  // two ways.
  const byPlan = (a: TodayTask, b: TodayTask) => compareForDay(a, b, day.date);

  // Which part of the day it is, on today only — the window unfinished
  // work carries forward into (ADR-0033 §2).
  const nowPart = nowMinute === null ? null : partNow(nowMinute);

  // A row sits in its own part of day, or — once that window has ended —
  // the one open now. A task with a clock time stays put: a 9am lecture
  // is not afternoon work because nobody ticked it.
  const shownPart = (t: TodayTask): PartOfDay | null =>
    t.startMinute !== null ? t.partOfDay : carriedPart(t.partOfDay, nowPart);

  const openTasks = [...day.due, ...day.week].filter((t) => !isDone(t));
  const isElsewhere = (t: TodayTask) => pinnedElsewhere(t, day.date);
  const todayTasks = openTasks.filter((t) => !isElsewhere(t));

  // Every open task with a later day is listed below today's work, so it
  // can be done early — soonest planned first, then your own order.
  const listedIds = new Set(allTasks.map((t) => t.id));
  const otherDayTasks = [
    ...openTasks.filter(isElsewhere),
    ...(ahead ?? []).filter((t) => !listedIds.has(t.id)),
  ].sort(
    (a, b) => (a.plannedOn ?? "￿").localeCompare(b.plannedOn ?? "￿") || byPlan(a, b),
  );

  const partSection = (part: PartOfDay | null): DaySection => {
    const tasks = todayTasks.filter((t) => shownPart(t) === part).sort(byPlan);
    return {
      key: part ?? "anytime",
      label: part ? PART_OF_DAY_LABEL[part] : ANYTIME_LABEL,
      tasks,
      pts: tasks.reduce((a, t) => a + t.pointValue, 0),
      // A window that has ended is shown only while it still holds
      // something — a timed task, which does not carry. Empty, it would
      // be a drop target in the past and a "Free" that is not.
      emptyNote:
        part === null || isPast(part, nowPart)
          ? null
          : emptyPeriodNote(allTasks.some((t) => t.partOfDay === part && t.completedToday)),
    };
  };

  const doneWeek = day.doneThisWeek.filter((t) => !t.completedToday);
  const completed = allTasks.filter(isDone);
  const candidates: DaySection[] = [
    // Explicit arrow: `map` passes an index as the second argument.
    ...PART_OF_DAY_ORDER.map((p) => partSection(p)),
    partSection(null),
    {
      // Named for what it is: planned, just not for today.
      key: "otherDays",
      label: "Planned for other days",
      tasks: otherDayTasks,
      pts: otherDayTasks.reduce((a, t) => a + t.pointValue, 0),
      // Until it is opened its one-offs are unpriced, so it says how many
      // there are rather than a points total it does not know.
      count: ahead === null ? otherDayTasks.length + day.aheadCount : otherDayTasks.length,
      emptyNote: null,
    },
    {
      key: "doneWeek",
      label: "Done this week",
      tasks: doneWeek,
      pts: doneWeek.reduce((a, t) => a + t.pointsIfCompletedNow, 0),
      emptyNote: null,
    },
    {
      key: "completed",
      label: "Completed",
      tasks: completed,
      pts: completed.reduce(
        (a, t) => a + (t.extraToday ? t.pointsIfCompletedNow : t.pointValue),
        0,
      ),
      emptyNote: null,
    },
  ];
  const sections = candidates.filter(
    (s) => s.tasks.length > 0 || (s.count !== undefined && s.count > 0) || s.emptyNote !== null,
  );

  // Completed work stays on the grid, dimmed: its job is the shape of the
  // day, and an attended 9am lecture leaving a hole would misreport it.
  const gridTasks = [...todayTasks, ...completed];

  return {
    allTasks,
    openTasks,
    todayTasks,
    shownPart,
    byPlan,
    arrangeable: sections.filter((s) => ARRANGEABLE.includes(s.key)),
    tailSections: sections
      .filter((s) => !ARRANGEABLE.includes(s.key))
      // The grid already shows today's completed work in place.
      .filter((s) => !(layout === "grid" && s.key === "completed")),
    gridTasks,
    // Nothing timed means the grid is an empty ruler — strictly less than
    // the checklist. The exception is being in it already: a toggle you
    // can enter and not leave is a trap.
    showsGrid:
      layout === "grid" || gridTasks.some((t) => t.startMinute !== null && t.endMinute !== null),
  };
}
