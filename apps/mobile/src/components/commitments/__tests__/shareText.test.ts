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
  it("says the automatic share at its largest this week", () => {
    expect(automaticText(week)).toBe("about 44% on Wednesdays");
    expect(shareRowText(week, null)).toBe("auto (about 44% on Wednesdays)");
  });

  it("shows a share you set with the automatic one beside it", () => {
    expect(shareRowText(week, 60)).toBe("60% · auto about 44% on Wednesdays");
  });

  it("says when the week ahead has no work for it", () => {
    expect(automaticText([])).toBeNull();
    expect(shareRowText([], null)).toBe("auto · no work in the week ahead");
    expect(shareRowText([], 60)).toBe("60%");
  });
});
