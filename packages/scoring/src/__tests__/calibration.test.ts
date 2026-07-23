import { describe, expect, it } from "vitest";
import { computeDivergence, meetsColdStartGate } from "../calibration";

describe("meetsColdStartGate — ADR-0008 §2", () => {
  it("fails below 8 points even if weeks span wide enough", () => {
    const samples = Array.from({ length: 7 }, (_, i) => ({
      weekStart: `2026-0${1 + i}-01`,
    }));
    expect(meetsColdStartGate(samples)).toBe(false);
  });

  it("fails below 6 distinct weeks even with 8+ points", () => {
    const samples = Array.from({ length: 10 }, () => ({ weekStart: "2026-07-06" }));
    expect(meetsColdStartGate(samples)).toBe(false);
  });

  it("passes at exactly 8 points and 6 distinct weeks", () => {
    const weeks = [
      "2026-06-01",
      "2026-06-08",
      "2026-06-15",
      "2026-06-22",
      "2026-06-29",
      "2026-07-06",
      "2026-06-01",
      "2026-06-08",
    ];
    const samples = weeks.map((weekStart) => ({ weekStart }));
    expect(samples.length).toBe(8);
    expect(meetsColdStartGate(samples)).toBe(true);
  });
});

describe("computeDivergence — ADR-0008 §5", () => {
  it("returns null when no weeks overlap", () => {
    expect(
      computeDivergence([{ weekStart: "2026-07-06", grade: 80 }], [{ weekStart: "2026-06-01", score: 8 }]),
    ).toBeNull();
  });

  it("only pairs weeks present in both inputs", () => {
    const stats = computeDivergence(
      [
        { weekStart: "2026-07-06", grade: 80 },
        { weekStart: "2026-07-13", grade: 60 },
      ],
      [{ weekStart: "2026-07-06", score: 8 }],
    );
    expect(stats?.weekCount).toBe(1);
  });

  it("grades running higher than felt contentment: positive divergence, direction 'higher'", () => {
    const stats = computeDivergence(
      [
        { weekStart: "2026-07-06", grade: 90 },
        { weekStart: "2026-07-13", grade: 85 },
      ],
      [
        { weekStart: "2026-07-06", score: 5 }, // 90 - 50 = 40
        { weekStart: "2026-07-13", score: 5 }, // 85 - 50 = 35
      ],
    );
    expect(stats?.meanDivergence).toBeCloseTo(37.5, 5);
    expect(stats?.direction).toBe("higher");
  });

  it("grades running lower than felt contentment: negative divergence, direction 'lower'", () => {
    const stats = computeDivergence(
      [{ weekStart: "2026-07-06", grade: 40 }],
      [{ weekStart: "2026-07-06", score: 8 }], // 40 - 80 = -40
    );
    expect(stats?.meanDivergence).toBeCloseTo(-40, 5);
    expect(stats?.direction).toBe("lower");
  });

  it("small gaps within the threshold are 'aligned'", () => {
    const stats = computeDivergence(
      [{ weekStart: "2026-07-06", grade: 82 }],
      [{ weekStart: "2026-07-06", score: 8 }], // 82 - 80 = 2
    );
    expect(stats?.direction).toBe("aligned");
  });

  it("perfectly concordant weeks (grade and contentment always move together) give rankAgreement 1", () => {
    const stats = computeDivergence(
      [
        { weekStart: "2026-06-01", grade: 40 },
        { weekStart: "2026-06-08", grade: 60 },
        { weekStart: "2026-06-15", grade: 80 },
      ],
      [
        { weekStart: "2026-06-01", score: 3 },
        { weekStart: "2026-06-08", score: 5 },
        { weekStart: "2026-06-15", score: 7 },
      ],
    );
    expect(stats?.rankAgreement).toBe(1);
  });

  it("perfectly discordant weeks give rankAgreement -1", () => {
    const stats = computeDivergence(
      [
        { weekStart: "2026-06-01", grade: 40 },
        { weekStart: "2026-06-08", grade: 60 },
        { weekStart: "2026-06-15", grade: 80 },
      ],
      [
        { weekStart: "2026-06-01", score: 9 },
        { weekStart: "2026-06-08", score: 6 },
        { weekStart: "2026-06-15", score: 3 },
      ],
    );
    expect(stats?.rankAgreement).toBe(-1);
  });

  it("ties in either grade or contentment are excluded from the rank count, not counted as discordant", () => {
    const stats = computeDivergence(
      [
        { weekStart: "2026-06-01", grade: 50 },
        { weekStart: "2026-06-08", grade: 50 }, // tied grade
      ],
      [
        { weekStart: "2026-06-01", score: 5 },
        { weekStart: "2026-06-08", score: 8 },
      ],
    );
    expect(stats?.rankAgreement).toBe(0);
  });
});
