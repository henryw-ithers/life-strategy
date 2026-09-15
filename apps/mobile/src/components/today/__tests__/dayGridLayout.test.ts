/**
 * The hour grid's geometry.
 *
 * Tested here rather than on device because a grid bug is silent: a
 * block lands on the wrong hour or at zero height and the screen still
 * renders. Nothing below touches React Native.
 */
import { describe, expect, it } from "vitest";

import {
  BASE_HOUR_HEIGHT,
  MIN_BLOCK_PX,
  formatLength,
  formatSpan,
  clipWindows,
  gridBounds,
  gridHeight,
  hourHeight,
  hourRows,
  placeBlocks,
  yOf,
} from "../dayGridLayout";

const at = (taskId: string, startMinute: number, endMinute: number) => ({
  taskId,
  startMinute,
  endMinute,
});

const DAY = { start: 7 * 60, end: 23 * 60 };

describe("hourHeight", () => {
  it("is the base at the default text size", () => {
    expect(hourHeight(1)).toBe(BASE_HOUR_HEIGHT);
  });

  it("grows with Dynamic Type, so the labels keep their room", () => {
    expect(hourHeight(1.5)).toBeGreaterThan(hourHeight(1));
  });

  it("stops growing at double, and never shrinks below the base", () => {
    expect(hourHeight(3)).toBe(hourHeight(2));
    expect(hourHeight(0.5)).toBe(BASE_HOUR_HEIGHT);
  });

  it("survives a garbage scale rather than producing NaN pixels", () => {
    expect(hourHeight(Number.NaN)).toBe(BASE_HOUR_HEIGHT);
  });
});

describe("gridBounds", () => {
  it("snaps outward to whole hours", () => {
    // 06:50–08:10 draws from 6 to 9, so both ends have a labelled line.
    expect(gridBounds([{ start: 410, end: 490 }], DAY)).toEqual({
      startHour: 6,
      endHour: 9,
    });
  });

  it("widens to contain an early block rather than clipping it", () => {
    const b = gridBounds([{ start: 6 * 60, end: 7 * 60 }], DAY);
    expect(b.startHour).toBe(6);
  });

  it("falls back when there is nothing to contain", () => {
    expect(gridBounds([], DAY)).toEqual({ startHour: 7, endHour: 23 });
  });

  it("never collapses to zero height, which would render as nothing", () => {
    const b = gridBounds([{ start: 540, end: 540 }], DAY);
    expect(b.endHour).toBeGreaterThan(b.startHour);
  });

  it("stays inside the day at both ends", () => {
    const b = gridBounds([{ start: -60, end: 25 * 60 }], DAY);
    expect(b.startHour).toBeGreaterThanOrEqual(0);
    expect(b.endHour).toBeLessThanOrEqual(24);
  });
});

describe("hourRows", () => {
  it("labels both ends of the span", () => {
    expect(hourRows({ startHour: 9, endHour: 12 })).toEqual([9, 10, 11, 12]);
  });
});

describe("yOf and gridHeight", () => {
  const bounds = { startHour: 8, endHour: 12 };

  it("puts the first hour at the top", () => {
    expect(yOf(8 * 60, bounds, 60)).toBe(0);
  });

  it("scales linearly through the span", () => {
    expect(yOf(9 * 60, bounds, 60)).toBe(60);
    expect(yOf(9 * 60 + 30, bounds, 60)).toBe(90);
  });

  it("ends exactly at the grid's own height", () => {
    expect(yOf(12 * 60, bounds, 60)).toBe(gridHeight(bounds, 60));
  });
});

describe("placeBlocks", () => {
  const bounds = { startHour: 8, endHour: 18 };

  it("positions a block at its start and sizes it to its length", () => {
    const [b] = placeBlocks([at("a", 9 * 60, 11 * 60)], bounds, 60);
    expect(b).toMatchObject({ taskId: "a", top: 60, height: 120 });
  });

  it("keeps a short block tappable rather than drawing it 14px tall", () => {
    const [b] = placeBlocks([at("a", 9 * 60, 9 * 60 + 15)], bounds, 60);
    expect(b?.height).toBe(MIN_BLOCK_PX);
  });

  it("gives a lone block the full width", () => {
    const [b] = placeBlocks([at("a", 9 * 60, 10 * 60)], bounds, 60);
    expect(b).toMatchObject({ column: 0, columns: 1 });
  });

  it("splits two overlapping blocks into two lanes", () => {
    const placed = placeBlocks(
      [at("a", 9 * 60, 11 * 60), at("b", 10 * 60, 12 * 60)],
      bounds,
      60,
    );
    expect(placed.map((p) => p.column)).toEqual([0, 1]);
    expect(placed.every((p) => p.columns === 2)).toBe(true);
  });

  it("widens to three when three genuinely overlap", () => {
    const placed = placeBlocks(
      [
        at("a", 9 * 60, 12 * 60),
        at("b", 9 * 60 + 30, 11 * 60),
        at("c", 10 * 60, 11 * 60 + 30),
      ],
      bounds,
      60,
    );
    expect(placed.every((p) => p.columns === 3)).toBe(true);
    expect(new Set(placed.map((p) => p.column)).size).toBe(3);
  });

  it("reuses a lane inside a cluster rather than widening it", () => {
    // 9–10, 9:30–11, 10:30–12 is one connected run, but the first and
    // last do not overlap — so they share a lane and the cluster stays
    // two wide. Widening to three would make every block in a busy
    // morning needlessly narrow.
    const placed = placeBlocks(
      [
        at("a", 9 * 60, 10 * 60),
        at("b", 9 * 60 + 30, 11 * 60),
        at("c", 10 * 60 + 30, 12 * 60),
      ],
      bounds,
      60,
    );
    expect(placed.every((p) => p.columns === 2)).toBe(true);
    expect(placed.find((p) => p.taskId === "c")?.column).toBe(0);
  });

  it("starts a fresh cluster once a gap opens", () => {
    // Two overlapping in the morning, one alone in the afternoon: the
    // afternoon block must not inherit the morning's two-lane width.
    const placed = placeBlocks(
      [
        at("a", 9 * 60, 11 * 60),
        at("b", 10 * 60, 12 * 60),
        at("c", 14 * 60, 15 * 60),
      ],
      bounds,
      60,
    );
    expect(placed.find((p) => p.taskId === "c")?.columns).toBe(1);
    expect(placed.find((p) => p.taskId === "a")?.columns).toBe(2);
  });

  it("reuses a lane once it is free", () => {
    // 9–10 and 10–11 touch but do not overlap, so one lane holds both.
    const placed = placeBlocks(
      [at("a", 9 * 60, 10 * 60), at("b", 10 * 60, 11 * 60)],
      bounds,
      60,
    );
    expect(placed.every((p) => p.column === 0 && p.columns === 1)).toBe(true);
  });

  it("drops a zero-length or inverted block rather than drawing it", () => {
    expect(placeBlocks([at("a", 600, 600)], bounds, 60)).toHaveLength(0);
    expect(placeBlocks([at("a", 700, 600)], bounds, 60)).toHaveLength(0);
  });

  it("no two blocks in one lane ever overlap", () => {
    const spans = [
      at("a", 9 * 60, 11 * 60),
      at("b", 9 * 60 + 30, 10 * 60),
      at("c", 10 * 60, 12 * 60),
      at("d", 11 * 60, 11 * 60 + 30),
      at("e", 13 * 60, 14 * 60),
    ];
    const placed = placeBlocks(spans, bounds, 60);
    const byId = new Map(spans.map((s) => [s.taskId, s]));
    for (const p of placed) {
      for (const q of placed) {
        if (p === q || p.column !== q.column) continue;
        const a = byId.get(p.taskId)!;
        const b = byId.get(q.taskId)!;
        const overlaps = a.startMinute < b.endMinute && b.startMinute < a.endMinute;
        expect(overlaps).toBe(false);
      }
    }
  });
});

describe("clipWindows", () => {
  const bounds = { startHour: 8, endHour: 18 };
  const clip = (ws: { start: number; end: number }[]) =>
    clipWindows(ws, bounds, 30);

  it("trims a window that runs past the drawn day", () => {
    // `windowsFor` runs its last window to midnight; the grid stops at
    // its own last hour line.
    expect(clip([{ start: 16 * 60, end: 24 * 60 }])).toEqual([
      { start: 16 * 60, end: 18 * 60 },
    ]);
  });

  it("trims a window that starts before the drawn day", () => {
    expect(clip([{ start: 0, end: 10 * 60 }])).toEqual([
      { start: 8 * 60, end: 10 * 60 },
    ]);
  });

  it("drops a window trimmed down to a sliver", () => {
    expect(clip([{ start: 17 * 60 + 45, end: 24 * 60 }])).toEqual([]);
  });

  it("drops one that falls outside the grid entirely", () => {
    expect(clip([{ start: 0, end: 6 * 60 }])).toEqual([]);
  });

  it("leaves a window already inside the grid alone", () => {
    expect(clip([{ start: 10 * 60, end: 12 * 60 }])).toEqual([
      { start: 10 * 60, end: 12 * 60 },
    ]);
  });

  it("carries the rest of a window's fields through", () => {
    expect(
      clipWindows(
        [{ start: 0, end: 10 * 60, afterTaskId: "lecture", partOfDay: null }],
        bounds,
        30,
      ),
    ).toEqual([
      { start: 8 * 60, end: 10 * 60, afterTaskId: "lecture", partOfDay: null },
    ]);
  });
});

describe("formatting", () => {
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  it("writes a span with both ends", () => {
    expect(formatSpan(9 * 60, 10 * 60 + 30, hhmm)).toBe("09:00 – 10:30");
  });

  it("writes a length in the largest unit that fits", () => {
    expect(formatLength(45)).toBe("45m");
    expect(formatLength(120)).toBe("2h");
    expect(formatLength(135)).toBe("2h 15m");
  });

  it("never writes a negative length", () => {
    expect(formatLength(-30)).toBe("0m");
  });
});
