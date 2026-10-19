/**
 * The four kinds of goal (ADR-0042): things the app can count, so every
 * goal shows real progress without typing anything in.
 *
 * | Kind | Counts | As |
 * |---|---|---|
 * | Times done | the tasks you chose, events included | ticks |
 * | Time spent | the tasks you chose, or every task in the unit | each tick's size in hours, or "Took about…" |
 * | Points earned | the whole unit, always | a running total of points |
 * | Streak | exactly one every-day task | days in a row (`computeStreak`) |
 *
 * **Events can count** toward times done and time spent (Henry,
 * 2026-10-17), never toward a streak. A target is always your own
 * number: nothing here knows, suggests or shows how many sessions were
 * scheduled, so a goal on a lecture can't become attended out of
 * scheduled (ADR-0038 §5).
 *
 * **Goals never grade a day** (ADR-0042 §4): nothing here feeds the
 * score, and `goalProgress` reads only what was already earned.
 * **Progress is a running total with no pace line** (§3): there is no
 * "where you should be by now", because that would show being behind
 * without saying so (ADR-0008). Points earned is a running total, never
 * a percentage of the points on offer, which would measure how much of
 * the plan was done (AGENTS.md).
 *
 * Pure, like everything in this package. The data layer (Phase 5)
 * stores goals, their links and their entries.
 */
import { addDays } from "./days";
import { sizeMinutes } from "./fill";
import { computeStreak, habitRungsReached, type Streak } from "./streak";
import type { TaskSize } from "./windows";

export type GoalKind = "timesDone" | "timeSpent" | "pointsEarned" | "streak";

/** What a goal counts. Each kind asks only the question it needs
 *  (Henry, 2026-10-13): a points goal asks nothing about tasks, and a
 *  streak asks for one. */
export type GoalMeasure =
  | {
      readonly kind: "timesDone";
      /** The tasks whose ticks count. At least one. */
      readonly taskIds: ReadonlySet<string>;
      /** How many times. */
      readonly target: number;
    }
  | {
      readonly kind: "timeSpent";
      /** The tasks you chose, or every task in the goal's unit or
       *  commitment, including tasks added later. */
      readonly counts: { readonly taskIds: ReadonlySet<string> } | "wholeUnit";
      /** How many hours. */
      readonly target: number;
    }
  | {
      readonly kind: "pointsEarned";
      /** How many points, as a running total. */
      readonly target: number;
    }
  | {
      readonly kind: "streak";
      /** The one every-day task. A streak has no target and nothing to
       *  complete; 7, 30 and 66 days are celebrated (§2). */
      readonly taskId: string;
    };

export interface GoalDefinition {
  readonly measure: GoalMeasure;
  /** The goal's unit or commitment, with a commitment's sub-commitments:
   *  what "every task in the unit" and "points earned" read. A goal on a
   *  commitment counts only that commitment's work, and never makes a
   *  scoring link into a life unit (ADR-0035 §3, EC-41). */
  readonly unitIds: ReadonlySet<string>;
}

/** A tick, as a goal sees it when it's made. */
export interface GoalTick {
  readonly taskId: string;
  readonly localDate: string;
  /**
   * The points the tick earned in each unit it **scores** in (ADR-0019:
   * a task can serve several, each paying its own share), keyed by unit.
   * A unit it only tags as a note isn't here at all: a note touches a
   * unit without earning anything there (ADR-0035 §3), so it never
   * counts toward that unit's goals. A unit it scores in with nothing
   * paid yet is here with 0.
   */
  readonly pointsByUnit: ReadonlyMap<string, number>;
  readonly size: TaskSize | null;
  /** An event's own length, in minutes: what time spent counts for it,
   *  rather than a size. */
  readonly durationMinutes?: number | null;
  /** "Took about…", in minutes, if set (`clampTookAbout`). */
  readonly tookMinutes?: number | null;
  /** How much of the task this tick did (ADR-0014): a half-done Big
   *  task is an hour, not two. Omitted, it's a whole tick. "Took
   *  about…" is already the real time, so it isn't scaled. */
  readonly fraction?: number;
}

/**
 * What a counted tick keeps (ADR-0042 §1). Saved when the tick is made,
 * so unlinking a task, archiving it (EC-36) or changing its size later
 * doesn't rewrite the goal's history.
 */
export interface GoalEntry {
  readonly taskId: string;
  readonly localDate: string;
  readonly minutes: number;
  readonly points: number;
}

/** "Took about…" is kept between 1 minute and 12 hours (EC-38). */
export const TOOK_ABOUT_RANGE = { min: 1, max: 12 * 60 } as const;

export function clampTookAbout(minutes: number): number {
  if (!Number.isFinite(minutes)) return TOOK_ABOUT_RANGE.min;
  return Math.min(TOOK_ABOUT_RANGE.max, Math.max(TOOK_ABOUT_RANGE.min, Math.round(minutes)));
}

/** Whether the tick scores in any of the goal's units. */
const scoresIn = (goal: GoalDefinition, tick: GoalTick) => {
  for (const unitId of tick.pointsByUnit.keys()) if (goal.unitIds.has(unitId)) return true;
  return false;
};

/**
 * Whether a tick counts toward a goal: the goal's kind decides which
 * tasks count (ADR-0042 §1).
 */
export function countsToward(goal: GoalDefinition, tick: GoalTick): boolean {
  const m = goal.measure;
  switch (m.kind) {
    case "timesDone":
      return m.taskIds.has(tick.taskId);
    case "timeSpent":
      return m.counts === "wholeUnit" ? scoresIn(goal, tick) : m.counts.taskIds.has(tick.taskId);
    case "pointsEarned":
      return scoresIn(goal, tick);
    case "streak":
      return m.taskId === tick.taskId;
  }
}

/**
 * The time a tick counts for, in minutes: "Took about…" when set, else
 * an event's own length, else the task's size (0.5, 1 or 2 hours; no
 * size is Normal), either of the last two scaled by how much was done.
 */
export function tickMinutes(
  tick: Pick<GoalTick, "size" | "durationMinutes" | "tookMinutes" | "fraction">,
): number {
  const took = tick.tookMinutes;
  if (took != null) return clampTookAbout(took);
  const duration = tick.durationMinutes;
  const whole = duration != null && duration > 0 ? duration : sizeMinutes(tick.size);
  return whole * Math.min(1, Math.max(0, tick.fraction ?? 1));
}

/**
 * The entry a tick leaves on a goal, or null if it doesn't count.
 *
 * - **Time** is `tickMinutes`.
 * - **Points** are what the tick earned in the goal's own units only,
 *   so one task scoring in two units gives each unit's goal its own
 *   share, and a note tag gives nothing.
 */
export function entryFor(goal: GoalDefinition, tick: GoalTick): GoalEntry | null {
  if (!countsToward(goal, tick)) return null;
  let points = 0;
  for (const [unitId, p] of tick.pointsByUnit) if (goal.unitIds.has(unitId)) points += Math.max(0, p);
  return {
    taskId: tick.taskId,
    localDate: tick.localDate,
    minutes: tickMinutes(tick),
    points,
  };
}

export interface GoalProgress {
  /** The running total: times, hours, points, or the current run. */
  readonly value: number;
  /** The target, or null for a streak. */
  readonly target: number | null;
  /** Reaching the target invites completion; it never completes the
   *  goal by itself (ADR-0042 §3, ADR-0007 §2). Always false for a
   *  streak, which has nothing to complete. */
  readonly reached: boolean;
}

/** What a streak goal needs besides its entries: the days skipped. */
export interface StreakContext {
  readonly today: string;
  /**
   * Days off and Away days: skipped, never a break. A cleared day is
   * not a day off, so an every-day task not done on it ends the run
   * (EC-51); "Make it a day off instead" puts it here.
   */
  readonly daysOff: readonly string[];
  /**
   * Whether the streak's task is due on a day. A streak starts on an
   * every-day task, but if that task later becomes, say, three times a
   * week, the run counts only the days it's due: the others are skipped
   * like days off (Henry, 2026-10-17). Omitted, every day is due.
   */
  readonly isDue?: (date: string) => boolean;
}

/**
 * A goal's progress (ADR-0042 §3): a running total of its entries, with
 * no pace line. Points across days off are simply a total, so days off
 * add nothing (EC-37).
 */
export function goalProgress(
  goal: GoalDefinition,
  entries: readonly GoalEntry[],
  streak?: StreakContext,
): GoalProgress {
  const m = goal.measure;
  switch (m.kind) {
    case "timesDone": {
      const value = entries.length;
      return { value, target: m.target, reached: value >= m.target };
    }
    case "timeSpent": {
      const value = entries.reduce((a, e) => a + e.minutes, 0) / 60;
      return { value, target: m.target, reached: value >= m.target };
    }
    case "pointsEarned": {
      const value = entries.reduce((a, e) => a + e.points, 0);
      return { value, target: m.target, reached: value >= m.target };
    }
    case "streak": {
      const run = goalStreak(entries, streak);
      return { value: run.current, target: null, reached: false };
    }
  }
}

/** A streak goal's run, by the existing streak rules (ADR-0004 §5),
 *  counting only the days its task is due. */
export function goalStreak(entries: readonly GoalEntry[], ctx?: StreakContext): Streak {
  if (!ctx) return { current: 0, longest: 0 };
  const done = entries.map((e) => e.localDate);
  const skipped = [...ctx.daysOff];
  if (ctx.isDue && done.length > 0) {
    const doneSet = new Set(done);
    const first = [...doneSet].sort()[0]!;
    for (let d = first; d <= ctx.today; d = addDays(d, 1)) {
      if (!doneSet.has(d) && !ctx.isDue(d)) skipped.push(d);
    }
  }
  return computeStreak({ done, daysOff: skipped, today: ctx.today });
}

/** Under 7 days nothing is shown, so a run that ends is never noticed
 *  (copy guide; ADR-0042 §2). */
export const STREAK_SHOWN_FROM = 7;

/**
 * The run a streak goal shows, or null. Only the current run, and only
 * from 7 days: a past best never sits beside a shorter current run, and
 * nothing is said when a run ends (ADR-0042 §2).
 */
export function streakShown(streak: Streak): number | null {
  return streak.current >= STREAK_SHOWN_FROM ? streak.current : null;
}

/** The rungs reached (7, 30, 66 days), for celebration only. */
export const streakRungs = habitRungsReached;

/** What a goal's tasks look like to the save check. */
export interface GoalTaskFacts {
  readonly taskId: string;
  readonly timesPerWeek: number;
  readonly isEvent: boolean;
}

/**
 * What's wrong with a goal before it's saved, or null (ADR-0042 §§1–2).
 * The sheet asks only its kind's question, so these are the ways an
 * answer can still be wrong.
 */
export function goalProblem(
  goal: GoalDefinition,
  tasks: ReadonlyMap<string, GoalTaskFacts>,
): string | null {
  const m = goal.measure;
  if (m.kind !== "streak" && !(Number.isFinite(m.target) && m.target > 0)) {
    return "Set a target above zero.";
  }
  switch (m.kind) {
    case "timesDone":
      return m.taskIds.size === 0 ? "Choose at least one task to count." : null;
    case "timeSpent":
      return m.counts !== "wholeUnit" && m.counts.taskIds.size === 0
        ? "Choose the tasks to count, or count every task here."
        : null;
    case "pointsEarned":
      return null;
    case "streak": {
      const task = tasks.get(m.taskId);
      if (!task) return "Choose the every-day task to keep going.";
      // A run ending on an unticked event would be derived from events
      // not attended (ADR-0038 §5).
      if (task.isEvent) return "A streak follows a task, not an event.";
      if (task.timesPerWeek !== 7) return "A streak follows an every-day task.";
      return null;
    }
  }
}
