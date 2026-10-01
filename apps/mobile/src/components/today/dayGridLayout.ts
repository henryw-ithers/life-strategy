/**
 * The pixel walk behind the hour grid — the pure half.
 *
 * Free of React Native imports on purpose, so it can be tested off
 * device (root AGENTS.md, and exactly the precedent `checklistLayout`
 * set). The reason is the same one that applies there and applies more
 * here: a layout bug in a grid is **silent**. Nothing throws; a block
 * is simply drawn at the wrong hour, or at a height of zero, and the
 * screen looks plausible while lying about the shape of a day.
 *
 * Minutes are integer minutes from local midnight throughout, matching
 * the columns and the window math. Nothing here reads or writes a
 * task's part of day: `PART_OF_DAY_BOUNDS` decides where a lane label
 * sits and is never written back (ADR-0030 §2's defaults are the whole
 * of the app's opinion, and a grid that wrote times to tasks would
 * take that decision away silently).
 */

/** An hour's height at the default text size. */
export const BASE_HOUR_HEIGHT = 56;

/**
 * The shortest a block may be drawn.
 *
 * A fifteen-minute block at 56px an hour is 14px — under half the HIG
 * floor for something you can tap, and too short to hold a label. It
 * is drawn taller than it is, which is the honest trade: the grid is
 * for reading the shape of a day, and a block you cannot see or press
 * conveys less than one that slightly overstates its length.
 */
export const MIN_BLOCK_PX = 34;

export interface GridBounds {
  /** Whole hours, 0–24. The grid always draws from hour line to hour line. */
  startHour: number;
  endHour: number;
}

export interface PlacedBlock {
  taskId: string;
  top: number;
  height: number;
  /** Which lane of its overlap cluster, 0-based. */
  column: number;
  /** How many lanes the cluster needs — the divisor for its width. */
  columns: number;
}

interface Span {
  taskId: string;
  startMinute: number;
  endMinute: number;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/**
 * How tall an hour is for this reader.
 *
 * Grows with Dynamic Type rather than staying fixed, because the hour
 * labels grow whether the grid likes it or not: at 200% a fixed
 * 56-pixel hour puts a 28-pixel label in it and the rail becomes an
 * illegible stack of overlapping numbers. Capped at 2, which is where
 * the accessibility sizes stop mattering to layout and start making
 * the grid a mile long.
 */
export function hourHeight(fontScale: number): number {
  const scale = Number.isFinite(fontScale) ? clamp(fontScale, 1, 2) : 1;
  return Math.round(BASE_HOUR_HEIGHT * scale);
}

/**
 * The whole hours the grid spans, widened to contain everything given.
 *
 * Snapping outward matters: a day whose first block starts at 06:50
 * draws from 6, not from a 6:50 line with no label. An empty range
 * falls back to the caller's default rather than collapsing to zero —
 * a grid with no height renders as nothing at all, which reads as a
 * broken screen rather than an empty day.
 */
export function gridBounds(
  spans: readonly { start: number; end: number }[],
  fallback: { start: number; end: number },
): GridBounds {
  const points = spans.flatMap((s) => [s.start, s.end]);
  const start = points.length > 0 ? Math.min(...points) : fallback.start;
  const end = points.length > 0 ? Math.max(...points) : fallback.end;
  const startHour = clamp(Math.floor(Math.min(start, end) / 60), 0, 23);
  const endHour = clamp(Math.ceil(Math.max(start, end) / 60), startHour + 1, 24);
  return { startHour, endHour };
}

/** Every hour line the rail labels, inclusive of both ends. */
export function hourRows(bounds: GridBounds): number[] {
  const out: number[] = [];
  for (let h = bounds.startHour; h <= bounds.endHour; h++) out.push(h);
  return out;
}

/** The grid's full height: one row per hour of span. */
export function gridHeight(bounds: GridBounds, hourPx: number): number {
  return (bounds.endHour - bounds.startHour) * hourPx;
}

/** Where a minute falls, in pixels from the top of the grid. */
export function yOf(minute: number, bounds: GridBounds, hourPx: number): number {
  return ((minute - bounds.startHour * 60) / 60) * hourPx;
}

/**
 * Lay out a day's blocks: position, height, and which lane each takes.
 *
 * Overlapping blocks share the width of their cluster rather than
 * being drawn on top of one another. A cluster is a run of blocks
 * connected by overlap — not merely pairwise overlapping, since a
 * three-deep chain where the first and last do not touch still has to
 * be three lanes wide or two of them would collide.
 */
export function placeBlocks(
  spans: readonly Span[],
  bounds: GridBounds,
  hourPx: number,
): PlacedBlock[] {
  const sorted = [...spans]
    .filter((s) => s.endMinute > s.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

  const placed: PlacedBlock[] = [];
  /** The cluster being built: its members' indices in `placed`. */
  let cluster: number[] = [];
  /** The last minute anything in the cluster runs to. */
  let clusterEnd = -1;
  /** When each lane in the cluster next comes free. */
  let laneEnds: number[] = [];

  const closeCluster = () => {
    const width = laneEnds.length;
    for (const i of cluster) {
      const block = placed[i];
      if (block) block.columns = width;
    }
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };

  for (const s of sorted) {
    if (cluster.length > 0 && s.startMinute >= clusterEnd) closeCluster();

    let lane = laneEnds.findIndex((end) => end <= s.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.endMinute);
    } else {
      laneEnds[lane] = s.endMinute;
    }

    const top = yOf(s.startMinute, bounds, hourPx);
    const height = Math.max(
      MIN_BLOCK_PX,
      yOf(s.endMinute, bounds, hourPx) - top,
    );
    placed.push({ taskId: s.taskId, top, height, column: lane, columns: 1 });
    cluster.push(placed.length - 1);
    clusterEnd = Math.max(clusterEnd, s.endMinute);
  }
  if (cluster.length > 0) closeCluster();

  return placed;
}

/**
 * Trim a day's windows to what the grid actually draws.
 *
 * The windows themselves come from `windowsFor` in the scoring package
 * — one definition of "a window" shared by the thing that draws them
 * and the thing that prices work inside them, rather than a second
 * copy here that could drift from it. What is left to do is display:
 * that last window runs to midnight and the first can start at 00:00,
 * and the grid draws neither.
 *
 * A window trimmed below `minMinutes` is dropped rather than drawn
 * short, for the reason `MIN_WINDOW_MINUTES` exists at all: a
 * twenty-minute sliver labelled "Free" is a lie about what you can do
 * with it.
 */
export function clipWindows<T extends { start: number; end: number }>(
  windows: readonly T[],
  bounds: GridBounds,
  minMinutes: number,
): T[] {
  const lo = bounds.startHour * 60;
  const hi = bounds.endHour * 60;
  return windows
    .map((w) => ({
      ...w,
      start: Math.max(w.start, lo),
      end: Math.min(w.end, hi),
    }))
    .filter((w) => w.end - w.start >= minMinutes);
}

/** `"9:00 – 10:30"`, for a block's caption and its spoken label. */
export function formatSpan(
  startMinute: number,
  endMinute: number,
  format: (m: number) => string,
): string {
  return `${format(startMinute)} – ${format(endMinute)}`;
}

/** `"2h 15m"`, `"45m"` — a length, never a countdown. */
export function formatLength(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

/**
 * A day's windows with their pool options, **carried forward** once a
 * window has ended (ADR-0033 §2).
 *
 * The unfinished options of every window that has closed move to the
 * first window still open — or, once every window has closed, to the
 * last one, since there is nowhere later in the day to put them. Options
 * already done stay where they were done. Display only: the pools
 * themselves are not rewritten, so nothing records the miss.
 *
 * `nowMinute` is null on any day but today. It may run past 1440 after
 * midnight and before the rollover, when it is still today's evening.
 */
export function carryPools<W extends { start: number; end: number }>(
  windows: readonly W[],
  ownOf: (w: W) => readonly string[],
  isOpen: (taskId: string) => boolean,
  nowMinute: number | null,
): { window: W; own: string[]; carried: string[] }[] {
  const out = windows.map((w) => ({ window: w, own: [...ownOf(w)], carried: [] as string[] }));
  if (nowMinute === null || out.length === 0) return out;

  const target =
    out.find((x) => x.window.end > nowMinute) ?? out[out.length - 1]!;
  for (const x of out) {
    if (x === target || x.window.end > nowMinute) continue;
    const moving = x.own.filter(isOpen);
    x.own = x.own.filter((id) => !isOpen(id));
    for (const id of moving) {
      if (!target.own.includes(id) && !target.carried.includes(id)) {
        target.carried.push(id);
      }
    }
  }
  return out;
}
