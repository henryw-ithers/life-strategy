import { afterEach, describe, expect, it, vi } from "vitest";

import { applyDayStart, currentLocalDate, hasRolledOver } from "../calendar";
import { ROLLOVER_HOUR } from "@glide/scoring";

afterEach(() => {
  vi.useRealTimers();
  applyDayStart(ROLLOVER_HOUR);
});

describe("hasRolledOver", () => {
  it("is false before anything has loaded", () => {
    expect(hasRolledOver(null, "2026-11-20")).toBe(false);
  });

  it("is false while the loaded day is still today", () => {
    expect(hasRolledOver("2026-11-19", "2026-11-19")).toBe(false);
  });

  it("is true once the day has changed under an open screen", () => {
    expect(hasRolledOver("2026-11-19", "2026-11-20")).toBe(true);
  });

  it("follows the day start, not midnight", () => {
    vi.useFakeTimers();
    // Monday 1am with a 3am start is still Sunday's day; 4am is Monday's.
    vi.setSystemTime(new Date(2026, 10, 16, 1, 0));
    const sunday = currentLocalDate();
    expect(sunday).toBe("2026-11-15");
    vi.setSystemTime(new Date(2026, 10, 16, 4, 0));
    expect(hasRolledOver(sunday)).toBe(true);
  });
});
