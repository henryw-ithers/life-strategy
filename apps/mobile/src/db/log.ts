/**
 * Reading the life log back.
 *
 * **The third of the product's three horizons, and the one that had no
 * code at all.** PRODUCT.md describes the app as daily execution,
 * monthly reflection, and "the long-term record [that] reads as a log
 * of a life, with journals, photos, and flagged memories alongside
 * grades". Design principle 5 goes further: over time, memories should
 * *outrank* metrics in what the app resurfaces.
 *
 * Every row this needs was already being written. None of it was ever
 * read: `journal_entry` and `photo` were queried only for the single
 * day they belong to, and `achievement` was insert-only — earned, and
 * then invisible forever. This module is the query side that was
 * missing.
 *
 * **Months, not an infinite scroll of days.** A life log browsed one
 * day at a time is a database viewer. Months are the unit a person
 * actually remembers in ("that was August"), they match the monthly
 * review's own period, and they give the list a shape that stays
 * legible after a year of use.
 *
 * **Only days that hold something appear.** A log is a record of what
 * happened, not a calendar with gaps in it — rendering every empty day
 * would bury four real memories under twenty-six blanks, and reading a
 * wall of nothing as failure is exactly the presentation ADR-0004
 * avoided for the calendar tint.
 */
import { localDateOf, monthStart, type PeriodGrade } from "@glide/scoring";
import { desc, inArray } from "drizzle-orm";

import { db } from "./client";
import { loadMonthGrade } from "./grades";
import { achievement, dayGrade, journalEntry, photo } from "./schema";

/** What a day contributed to the record. A day can carry several. */
export interface LogEntry {
  localDate: string;
  /** Journal text, newest first within the day. */
  notes: string[];
  /** File URIs; the screen resolves and handles missing files. */
  photos: { id: string; uri: string; caption: string | null }[];
  /** Titles of goals and habit rungs reached that day. */
  achievements: string[];
  /** A day the user marked worth keeping (`day_grade.flagged`). */
  flagged: boolean;
  /** A special day's own name, when it has one. */
  title: string | null;
  /** Null when the day was never graded. */
  score: number | null;
}

export interface LogMonth {
  /** `YYYY-MM`, the key months are grouped and titled by. */
  month: string;
  entries: LogEntry[];
  /** Counts for the month's summary line, so the screen does not
   *  recount what this already walked. */
  totals: { notes: number; photos: number; achievements: number };
}

/**
 * The whole log, newest month first and newest day first inside each.
 *
 * Read in full rather than paged: the rows are small, they are bounded
 * by how long the person has used the app, and paging a record of a
 * life by scroll offset would make "jump to last March" impossible.
 * When a real log outgrows this, the fix is a month index, not a cursor.
 */
export async function loadLog(): Promise<LogMonth[]> {
  const [notes, photos, achievements, graded] = await Promise.all([
    db.select().from(journalEntry).orderBy(desc(journalEntry.localDate)),
    db.select().from(photo).orderBy(desc(photo.localDate)),
    db.select().from(achievement).orderBy(desc(achievement.achievedAt)),
    db
      .select()
      .from(dayGrade)
      .where(inArray(dayGrade.kind, ["special", "normal", "rest"]))
      .orderBy(desc(dayGrade.localDate)),
  ]);

  const byDate = new Map<string, LogEntry>();
  const entryFor = (localDate: string): LogEntry => {
    const existing = byDate.get(localDate);
    if (existing) return existing;
    const fresh: LogEntry = {
      localDate,
      notes: [],
      photos: [],
      achievements: [],
      flagged: false,
      title: null,
      score: null,
    };
    byDate.set(localDate, fresh);
    return fresh;
  };

  for (const n of notes) entryFor(n.localDate).notes.push(n.body);
  for (const p of photos) {
    entryFor(p.localDate).photos.push({
      id: p.id,
      uri: p.fileUri,
      caption: p.caption,
    });
  }
  // `achieved_at` is a timestamp, not a local date: the log is keyed by
  // the day the user was living, so it goes through the same conversion
  // the rest of the app uses (ADR-0002 — `local_date` exists to stop
  // exactly this drifting a day west of Greenwich).
  for (const a of achievements) {
    entryFor(localDateOf(new Date(a.achievedAt))).achievements.push(
      a.titleSnapshot,
    );
  }

  // Grades only *decorate* a day that already earned its place. A day
  // with a score and nothing else is a number, not a memory.
  for (const g of graded) {
    const held = byDate.get(g.localDate);
    const worthKeeping = g.flagged || g.title !== null;
    if (!held && !worthKeeping) continue;
    const entry = entryFor(g.localDate);
    entry.flagged = g.flagged;
    entry.title = g.title;
    entry.score =
      g.pointsPossible > 0
        ? Math.round((g.pointsEarned / g.pointsPossible) * 100)
        : null;
  }

  const months = new Map<string, LogEntry[]>();
  for (const entry of [...byDate.values()].sort((a, b) =>
    b.localDate.localeCompare(a.localDate),
  )) {
    const key = entry.localDate.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), entry]);
  }

  return [...months.entries()].map(([month, entries]) => ({
    month,
    entries,
    totals: {
      notes: entries.reduce((a, e) => a + e.notes.length, 0),
      photos: entries.reduce((a, e) => a + e.photos.length, 0),
      achievements: entries.reduce((a, e) => a + e.achievements.length, 0),
    },
  }));
}

/**
 * The month you are standing in, for the checkpoint on Portfolio.
 *
 * **A checkpoint, not a ceremony.** ADR-0002 §5 specified the monthly
 * review as a five-stage ritual — diagnostic, then new weights beside
 * old, then settling every goal, then adjusting tasks, then the month's
 * grade. That is a lot of machinery to walk through twelve times a
 * year, and it front-loads bookkeeping onto a moment that is supposed
 * to be reflective. What this returns instead is the small set of facts
 * a person needs in order to *decide* whether anything needs changing:
 * how the month scored, how much of it is behind that number, and what
 * the month actually held. The adjustments stay where they already
 * live — re-rank on this screen, settle a goal on its own screen — so
 * the checkpoint stays a place you look rather than a queue you clear.
 *
 * This is also the first caller `loadMonthGrade` has ever had. The
 * function was written, tested and then referenced by nothing, which is
 * how the monthly half of the product stayed invisible.
 */
export interface MonthCheckpoint {
  /** `YYYY-MM`. */
  month: string;
  grade: PeriodGrade;
  totals: { notes: number; photos: number; achievements: number };
  /** Days in this month that put something in the log. */
  daysRecorded: number;
}

export async function loadMonthCheckpoint(
  date: string,
): Promise<MonthCheckpoint> {
  const month = monthStart(date).slice(0, 7);
  const [grade, months] = await Promise.all([loadMonthGrade(date), loadLog()]);
  const held = months.find((m) => m.month === month);
  return {
    month,
    grade,
    totals: held?.totals ?? { notes: 0, photos: 0, achievements: 0 },
    daysRecorded: held?.entries.length ?? 0,
  };
}
