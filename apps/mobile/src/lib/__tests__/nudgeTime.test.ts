import { describe, expect, it } from "vitest";

import { nextReminder, reminderAt } from "../nudgeTime";

const at = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

describe("reminderAt", () => {
  it("puts an evening reminder on the planning day's own date", () => {
    expect(at(reminderAt("2026-11-19", "21:00", 3))).toBe("2026-11-19 21:00");
  });

  it("puts a reminder before the day starts in the small hours after it", () => {
    expect(at(reminderAt("2026-11-19", "01:00", 3))).toBe("2026-11-20 01:00");
  });
});

describe("nextReminder", () => {
  it("fires today when today is open and the time is ahead", () => {
    const now = new Date(2026, 10, 19, 8, 0);
    expect(at(nextReminder("2026-11-19", "21:00", false, 3, now))).toBe("2026-11-19 21:00");
  });

  it("moves to the next day once today is handled", () => {
    const now = new Date(2026, 10, 19, 8, 0);
    expect(at(nextReminder("2026-11-19", "21:00", true, 3, now))).toBe("2026-11-20 21:00");
  });

  it("doesn't skip a night for someone up past midnight", () => {
    // 00:30 on the 20th is still the 19th's day; it's handled, so the
    // next reminder is the 20th's, tonight, not the 21st's.
    const now = new Date(2026, 10, 20, 0, 30);
    expect(at(nextReminder("2026-11-19", "21:00", true, 3, now))).toBe("2026-11-20 21:00");
  });

  it("moves on when today's time has passed", () => {
    const now = new Date(2026, 10, 19, 22, 0);
    expect(at(nextReminder("2026-11-19", "21:00", false, 3, now))).toBe("2026-11-20 21:00");
  });
});
