/**
 * Windows — the stretches of a day work is placed into (ADR-0033 §1).
 *
 * One structure, two derivations:
 *
 * - **With commitments**, windows are the *gaps between them*. A gap
 *   shorter than `MIN_WINDOW_MINUTES` is **buffer**, not free time:
 *   fifteen minutes between two lectures across campus is not time you
 *   have, and a grid that offers it is lying to the person reading it.
 * - **Without commitments**, windows are morning / afternoon / evening
 *   — `part_of_day`, which the checklist already sections by. A weekend
 *   needs no special case; it is today's app.
 *
 * Pure and free of React Native, like everything in this package.
 */

/** A gap shorter than this is buffer rather than a window. */
export const MIN_WINDOW_MINUTES = 30;

/**
 * Where the part-of-day windows fall, for a day with no commitments.
 *
 * **Display-only, and never written back to a task.** The moment this
 * becomes a write path a task has acquired a clock time it did not
 * choose, which is the sharpest invariant risk in this whole design.
 */
export const PART_OF_DAY_BOUNDS = {
  morning: { start: 5 * 60, end: 12 * 60 },
  afternoon: { start: 12 * 60, end: 17 * 60 },
  evening: { start: 17 * 60, end: 23 * 60 },
} as const;

export type PartOfDay = keyof typeof PART_OF_DAY_BOUNDS;

/** A timed block on a day — a lecture, a shift, a sat exam. */
export interface Block {
  taskId: string;
  startMinute: number;
  endMinute: number;
}

export interface Window {
  /** Minutes from local midnight. */
  start: number;
  end: number;
  /**
   * The block this window follows, when one does. That is the **cue**
   * (ADR-0030 §3) — "after the 11am lecture" survives the lecture
   * moving to 2pm, where a clock time would silently become wrong.
   */
  afterTaskId: string | null;
  /** Set only on a day with no commitments. */
  partOfDay: PartOfDay | null;
}

export const windowLength = (w: Window): number => w.end - w.start;

/** Merge overlapping or touching blocks, so a gap is a real gap. */
function merge(blocks: readonly Block[]): { start: number; end: number; taskId: string }[] {
  const sorted = [...blocks]
    .filter((b) => b.endMinute > b.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute);
  const out: { start: number; end: number; taskId: string }[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && b.startMinute <= last.end) {
      // The later-ending block becomes the cue, since it is what you
      // are actually waiting for.
      if (b.endMinute > last.end) {
        last.end = b.endMinute;
        last.taskId = b.taskId;
      }
    } else {
      out.push({ start: b.startMinute, end: b.endMinute, taskId: b.taskId });
    }
  }
  return out;
}

/**
 * The day's windows.
 *
 * With no blocks this is the three parts of day, in order — which is
 * also what makes a day with nothing planned draw those rather than an
 * empty ruler (ADR-0033 §4).
 */
export function windowsFor(
  blocks: readonly Block[],
  minMinutes: number = MIN_WINDOW_MINUTES,
): Window[] {
  // Merge first, then ask whether anything survived. Testing `blocks`
  // instead would give a day holding only a zero-length block **no
  // windows at all** — nothing to plan into, on a day that is in fact
  // completely free.
  const merged = merge(blocks);
  if (merged.length === 0) {
    return (Object.keys(PART_OF_DAY_BOUNDS) as PartOfDay[]).map((p) => ({
      start: PART_OF_DAY_BOUNDS[p].start,
      end: PART_OF_DAY_BOUNDS[p].end,
      afterTaskId: null,
      partOfDay: p,
    }));
  }

  const windows: Window[] = [];

  // Before the first block — open-ended at the start of the day.
  const first = merged[0];
  if (first && first.start >= minMinutes) {
    windows.push({ start: 0, end: first.start, afterTaskId: null, partOfDay: null });
  }

  for (let i = 0; i < merged.length; i++) {
    const here = merged[i];
    const next = merged[i + 1];
    if (!here) continue;
    const end = next ? next.start : 24 * 60;
    if (end - here.end >= minMinutes) {
      windows.push({
        start: here.end,
        end,
        afterTaskId: here.taskId,
        partOfDay: null,
      });
    }
  }

  return windows;
}

/**
 * The span the grid draws: the day's **windows**, not just its blocks
 * (ADR-0033 §4).
 *
 * Deriving it from blocks alone would show a single 9am lecture as one
 * hour on a tall screen. Including the windows means the free afternoon
 * after it is drawn too, which is the part you can actually use.
 */
export function gridExtent(
  blocks: readonly Block[],
  windows: readonly Window[],
): { start: number; end: number } {
  const points = [
    ...blocks.flatMap((b) => [b.startMinute, b.endMinute]),
    ...windows.flatMap((w) => [w.start, w.end]),
  ];
  if (points.length === 0) {
    return {
      start: PART_OF_DAY_BOUNDS.morning.start,
      end: PART_OF_DAY_BOUNDS.evening.end,
    };
  }
  return { start: Math.min(...points), end: Math.max(...points) };
}

/** `540` → `"09:00"`. Display only. */
export function formatMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
