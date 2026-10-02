/**
 * What a day asks of you, and how much of it you did (ADR-0029 §1).
 *
 * This is the whole of the day's arithmetic. A day's planned score is a
 * **fraction**: the weight of what you got through over the weight of
 * what the day expected. Both sides are measured in the task weights
 * `taskWeights` produces, so the scale cancels and only the relative
 * standing of one task against another survives into the number.
 *
 * **What the day expects, exactly.** Henry, 2026-08-26: *"by daily I
 * actually mean anything planned for that day… assume that weekly or
 * less frequent tasks are evenly divided amongst the days of the week.
 * So if you have seven one-time anytime-during-the-week tasks you're
 * expected to do one of those a day."* Two rules follow, and they apply
 * to different tasks:
 *
 * - **Anchored work is expected in full on its day.** An every-day task
 *   is due every day. A task pinned to Monday, Wednesday and Friday is
 *   due — completely, not fractionally — on each of those days, and not
 *   at all on a Tuesday. This is the reading that replaced an earlier
 *   draft in which a 3×/week task contributed 3/7 of itself to all
 *   seven days; Henry's verdict on that was that it "makes no sense,"
 *   and he is right: a scheduled task is either on today's list or it
 *   is not.
 * - **Flexible work is pooled and divided evenly.** A task with no
 *   weekday pin is not due on any particular day, so the runs it still
 *   owes this week join one pool, and the day expects that pool spread
 *   over the days left in the week. Seven unpinned weekly tasks means
 *   the pool expects one a day — his example, exactly — and *any* one
 *   of them fills the slot.
 *
 * **Everything is measured against what is still owed this week**,
 * which is what makes doing Friday's run on Tuesday harmless (ADR-0029
 * §3). Tuesday counts the run; Friday then owes nothing and stops
 * expecting it. Nothing anywhere compares a completion's date against
 * the day it was pinned to, so there is no adherence statistic here
 * and no way to derive one — ADR-0024 §2's actual promise, kept even
 * though this module reads the pins its invariant said the grade never
 * would.
 *
 * **Today's own completions never move today's expectation.** `owed` is
 * counted from the days *before* this one, the same rule
 * `deriveChecklist` uses for banding, so the denominator cannot shift
 * under the user while they are working through the list.
 */
import { addDays, fortnightStart, weekStart } from "./days";
import { pinnedOn } from "./schedule";

export interface LoadTask {
  taskId: string;
  /** One run's share of the portfolio's 100 (`taskWeights`). */
  weight: number;
  /** 7 = every day, 1–6 = times a week, 0 = once a fortnight. */
  timesPerWeek: number;
  /** ISO weekday pins, Monday 1 … Sunday 7. Empty when flexible. */
  pinnedWeekdays: readonly number[];
  /** Which half of the fortnight a fortnightly task belongs to. */
  fortnightOffset?: number;
  /** A one-off: one run, then archived. Always flexible. */
  oneOff?: boolean;
}

export interface LoadCompletion {
  taskId: string;
  localDate: string;
  /**
   * How much of the task this completion was for (ADR-0014): 0.25–1,
   * and 1 when omitted, which is every completion written before part
   * credit existed.
   */
  fraction?: number;
}

/**
 * Runs a task has already done in this window, before today.
 *
 * A recurring task counts **rows**: a part-done day is a day you showed
 * up, and it counts toward the week's runs (Henry, 2026-09-30: "some
 * days showing up is what counts"). A one-off counts **progress** — the
 * sum of its fractions — because it is one piece of work, and a quarter
 * of it done on Tuesday leaves three quarters owed on Wednesday rather
 * than settling it (ADR-0014 §2).
 */
export function runsBefore(task: LoadTask, rows: readonly LoadCompletion[]): number {
  if (!task.oneOff) return rows.length;
  return Math.min(1, rows.reduce((a, r) => a + (r.fraction ?? 1), 0));
}

export interface DayLoad {
  /** Weight the day asked for: anchored work plus the flexible share. */
  expected: number;
  /** Weight completed today, counting only runs within the weekly goal. */
  earned: number;
  /** Weight completed today beyond the weekly goal — an extra run. */
  extra: number;
  /** The anchored half of `expected`, by task. Drives the checklist. */
  anchored: Map<string, number>;
  /** The day's share of the flexible pool. */
  flexible: number;
}

/** How many days of the week remain, counting `date` itself. Weeks open
 *  on Sunday (`weekStart`), so this runs 7 on Sunday down to 1 on
 *  Saturday — the divisor that spreads flexible work evenly. */
export function daysLeftInWeek(date: string): number {
  const ws = weekStart(date);
  let index = 0;
  for (let d = ws; d < date; d = addDays(d, 1)) index++;
  return 7 - index;
}

/** Runs a task owes in the window `date` falls in: its frequency, or one
 *  for a fortnightly task and for a one-off. */
function weeklyGoal(task: LoadTask): number {
  if (task.oneOff) return 1;
  return task.timesPerWeek === 0 ? 1 : task.timesPerWeek;
}

/**
 * Whether an **anchored** task belongs to this date: every-day tasks
 * always, pinned tasks on the weekdays they name, and a fortnightly
 * pinned task only in its own half of the fortnight.
 *
 * A flexible task is never "due here" — it is due *some day* this week,
 * which is the pool's business rather than this function's.
 */
export function isAnchoredOn(task: LoadTask, date: string): boolean {
  if (task.oneOff) return false;
  if (task.timesPerWeek === 7) return true;
  return pinnedOn(task.pinnedWeekdays, task.timesPerWeek, task.fortnightOffset, date);
}

/** A task with pins, none of which is today. Expected on its own days,
 *  not on this one — and if its day has passed, it lapses silently
 *  (ADR-0024 §2), never reappearing as a debt on a later date. */
export function isPinnedElsewhere(task: LoadTask, date: string): boolean {
  if (task.oneOff || task.timesPerWeek === 7) return false;
  return task.pinnedWeekdays.length > 0 && !isAnchoredOn(task, date);
}

/**
 * The day this week a run done on `date` was planned for, or null.
 *
 * For a task pinned to other days: the **next** pinned day still to
 * come this week — the run is early — or, if every pinned day has
 * passed, the **latest** one — the run is late. Either way it is paid
 * what that day would have paid (ADR-0037 §3), so a run is worth the
 * same whichever day of its week it is done on. Null for a task that is
 * not pinned elsewhere, and for a fortnightly task whose pinned days
 * all fall in the other week.
 */
export function plannedDateFor(task: LoadTask, date: string): string | null {
  if (!isPinnedElsewhere(task, date)) return null;
  const start = weekStart(date);
  let latestPast: string | null = null;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (d === date || !isAnchoredOn(task, d)) continue;
    if (d > date) return d;
    latestPast = d;
  }
  return latestPast;
}

/**
 * What an **average** day of this plan expects: every recurring task's
 * weekly demand (a fortnightly task's half-run included), over seven.
 *
 * Only a rest day reads this (ADR-0037 §3). A rest day expects nothing,
 * so the day's own load cannot price work done on it — `90 × w ÷ 0` —
 * and early work is priced against the day it would ordinarily have
 * been instead. One-offs are left out, as `taskWeights` leaves them out
 * of the recurring allocation: an errand on the list must not move what
 * everything else is worth.
 */
export function averageDayExpected(tasks: readonly LoadTask[]): number {
  const weekly = tasks
    .filter((t) => !t.oneOff)
    .reduce((a, t) => a + t.weight * (t.timesPerWeek === 0 ? 0.5 : t.timesPerWeek), 0);
  return weekly / 7;
}

/**
 * The day's expected and completed load.
 *
 * `completions` must cover at least the fortnight containing `date`, so
 * both the weekly and the fortnightly counting windows are inside it.
 */
export function computeDayLoad(
  tasks: readonly LoadTask[],
  completions: readonly LoadCompletion[],
  date: string,
): DayLoad {
  const ws = weekStart(date);
  const fs = fortnightStart(date);
  const remaining = daysLeftInWeek(date);

  const anchored = new Map<string, number>();
  let flexibleDemand = 0;
  let earned = 0;
  let extra = 0;

  for (const task of tasks) {
    const windowStart = task.timesPerWeek === 0 && !task.oneOff ? fs : ws;
    const inWindow = completions.filter(
      (c) =>
        c.taskId === task.taskId &&
        c.localDate >= windowStart &&
        c.localDate <= date,
    );
    const today = inWindow.find((c) => c.localDate === date);
    const doneToday = today !== undefined;
    const doneBefore = runsBefore(
      task,
      inWindow.filter((c) => c.localDate !== date),
    );
    const goal = weeklyGoal(task);
    const owed = Math.max(0, goal - doneBefore);

    // A completion counts toward the day's earned weight while the week
    // still owed the run; past that it is an extra run, which sits
    // outside the band entirely (ADR-0023 §2). A part-done run counts
    // its fraction of the task's weight (ADR-0014), and a one-off can
    // pay at most what is still owed of it.
    if (today) {
      const f = today.fraction ?? 1;
      if (owed > 0) earned += task.weight * (task.oneOff ? Math.min(f, owed) : f);
      else extra += task.weight * f;
    }

    if (owed === 0) continue;
    if (isAnchoredOn(task, date)) {
      anchored.set(task.taskId, task.weight);
    } else if (!isPinnedElsewhere(task, date)) {
      // Flexible: every run it still owes joins the pool.
      flexibleDemand += task.weight * owed;
    }
  }

  const flexible = remaining > 0 ? flexibleDemand / remaining : 0;
  const anchoredTotal = [...anchored.values()].reduce((a, b) => a + b, 0);

  return {
    expected: anchoredTotal + flexible,
    earned,
    extra,
    anchored,
    flexible,
  };
}
