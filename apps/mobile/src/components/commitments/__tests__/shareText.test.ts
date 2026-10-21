/**
 * A commitment's share of the day in words (spec §5.5).
 */
import { describe, expect, it } from "vitest";

import { automaticText, shareRowText } from "../shareText";

const week = [
  { date: "2026-10-19", automatic: 20 },
  { date: "2026-10-21", automatic: 44 },
];

describe("shareRowText", () => {
  it("says a typical day's automatic share", () => {
    expect(automaticText(week)).toBe("about 20% on Mondays");
    const three = [...week, { date: "2026-10-23", automatic: 30 }];
    expect(automaticText(three)).toBe("about 30% on Fridays");
    expect(shareRowText(three, null)).toBe("auto (about 30% on Fridays)");
  });

  it("never says more than the share is held to", () => {
    // A Saturday game with no working hours is the whole day, held at 70.
    expect(automaticText([{ date: "2026-10-24", automatic: 100 }], 70)).toBe("about 70% on Saturdays");
  });

  it("shows a share you set with the automatic one beside it", () => {
    expect(shareRowText(week, 60)).toBe("60% · auto about 20% on Mondays");
  });

  it("says when the week ahead has no work for it", () => {
    expect(automaticText([])).toBeNull();
    expect(shareRowText([], null)).toBe("auto · no work in the week ahead");
    expect(shareRowText([], 60)).toBe("60%");
  });
});
