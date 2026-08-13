/**
 * The log's two silent-failure surfaces: trimming, where a dropped
 * entry looks identical to no entry, and the report text, which is
 * what a tester actually sends. Neither announces a mistake.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_PER_KIND,
  formatReport,
  isProblem,
  trimLog,
  type FeedbackEntry,
  type LogEntry,
  type ProblemEntry,
} from "../logFormat";

const CONTEXT = { build: "1.0.0 (3)", device: "ios 18.5 · iPhone 13" };

function problem(at: string, over: Partial<ProblemEntry> = {}): ProblemEntry {
  return {
    at,
    kind: "render",
    name: "TypeError",
    message: "undefined is not a function",
    frames: ["at TaskRow (TaskRow.tsx:88:12)"],
    build: CONTEXT.build,
    device: CONTEXT.device,
    ...over,
  };
}

function feedback(at: string, over: Partial<FeedbackEntry> = {}): FeedbackEntry {
  return {
    at,
    kind: "feedback",
    topic: "suggestion",
    via: "mail",
    build: CONTEXT.build,
    device: CONTEXT.device,
    ...over,
  };
}

/** `2026-07-29T10:00:00.000Z` for n = 0, ascending by minute. */
const at = (n: number) =>
  new Date(Date.UTC(2026, 6, 29, 10, n)).toISOString();

describe("trimLog", () => {
  it("orders newest first regardless of input order", () => {
    const trimmed = trimLog([problem(at(1)), feedback(at(3)), problem(at(2))]);
    expect(trimmed.map((e) => e.at)).toEqual([at(3), at(2), at(1)]);
  });

  it("caps each kind independently, so neither starves the other", () => {
    // The bug this guards: eleven notes evicting every crash.
    const entries: LogEntry[] = [
      ...Array.from({ length: 15 }, (_, i) => feedback(at(100 + i))),
      problem(at(0)),
      problem(at(1)),
    ];

    const trimmed = trimLog(entries);
    expect(trimmed.filter(isProblem)).toHaveLength(2);
    expect(trimmed.filter((e) => !isProblem(e))).toHaveLength(MAX_PER_KIND);
  });

  it("drops the oldest of a kind, not the newest", () => {
    const entries = Array.from({ length: MAX_PER_KIND + 3 }, (_, i) =>
      problem(at(i)),
    );
    const trimmed = trimLog(entries);

    expect(trimmed).toHaveLength(MAX_PER_KIND);
    // Newest survives, oldest three are gone.
    expect(trimmed[0]?.at).toBe(at(MAX_PER_KIND + 2));
    expect(trimmed.map((e) => e.at)).not.toContain(at(0));
  });

  it("leaves a short log alone", () => {
    const entries = [problem(at(2)), feedback(at(1))];
    expect(trimLog(entries)).toEqual(entries);
  });

  it("does not mutate its input", () => {
    const entries = [problem(at(1)), problem(at(5))];
    const before = entries.map((e) => e.at);
    trimLog(entries);
    expect(entries.map((e) => e.at)).toEqual(before);
  });
});

describe("formatReport", () => {
  it("says so plainly when there is nothing", () => {
    expect(formatReport([], CONTEXT)).toBe(
      "Life Strategy problem report · 1.0.0 (3) · ios 18.5 · iPhone 13\n\nNothing recorded.",
    );
  });

  it("renders a problem with its route, message and frames", () => {
    const report = formatReport(
      [problem(at(0), { route: "/goals/<id>" })],
      CONTEXT,
    );
    expect(report).toContain("· render · /goals/<id>");
    expect(report).toContain("TypeError: undefined is not a function");
    expect(report).toContain("at TaskRow (TaskRow.tsx:88:12)");
  });

  it("renders feedback as one line and never carries a message field", () => {
    const report = formatReport([feedback(at(0))], CONTEXT);
    expect(report).toContain("feedback sent (suggestion, mail)");
    // The entry type has no text field at all — this asserts the
    // promise in Settings › Privacy holds at the payload level.
    expect(report).not.toMatch(/undefined|\[object/);
  });

  it("flags an entry recorded on a different build", () => {
    const report = formatReport(
      [problem(at(0), { build: "1.0.0 (2)", device: "ios 17.0 · iPhone 11" })],
      CONTEXT,
    );
    expect(report).toContain("recorded on 1.0.0 (2) · ios 17.0 · iPhone 11");
  });

  it("stays quiet about the build when it matches the header", () => {
    expect(formatReport([problem(at(0))], CONTEXT)).not.toContain("recorded on");
    expect(formatReport([feedback(at(0))], CONTEXT)).not.toContain("\n   on ");
  });

  it("numbers entries in the order given", () => {
    const report = formatReport(
      [problem(at(2)), feedback(at(1)), problem(at(0))],
      CONTEXT,
    );
    expect(report).toContain("1. " + at(2));
    expect(report).toContain("2. " + at(1));
    expect(report).toContain("3. " + at(0));
  });
});
