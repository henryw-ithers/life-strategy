/**
 * ADR-0013 decision 3 is a promise about what can appear in a report.
 * These are the cases that would break it, written as the shapes real
 * failures produce rather than as tidy fixtures.
 */
import { describe, expect, it } from "vitest";

import { redact, redactRoute, redactStack } from "../redact";

const UUID = "8f14e45f-ceea-467a-9b1a-2c3d4e5f6a7b";

describe("redact", () => {
  it("drops bound parameters, which is where user text would be", () => {
    // The realistic leak: a failed insert of a journal entry.
    const message = `Error: NOT NULL constraint failed: journal_entry.body, params: ["${UUID}","Dad's biopsy came back clear today"]`;
    const out = redact(message);

    expect(out).not.toContain("biopsy");
    expect(out).toContain("params: <redacted>");
    // The part before `params:` is the whole diagnostic value — keep it.
    expect(out).toContain("NOT NULL constraint failed: journal_entry.body");
  });

  it("drops parameters case-insensitively and across newlines", () => {
    const out = redact('failed\nParams:\n["a note the user wrote"]');
    expect(out).not.toContain("note the user wrote");
  });

  it("replaces uuids wherever they sit", () => {
    expect(redact(`no row for goal ${UUID}`)).toBe("no row for goal <id>");
    expect(redact(UUID.toUpperCase())).toBe("<id>");
  });

  it("replaces file and photo uris, which carry names", () => {
    expect(
      redact("ENOENT: file:///var/mobile/Containers/Data/photos/gran-90th.jpg"),
    ).toBe("ENOENT: <uri>");
    expect(redact("bad asset ph://1B2C3D4-5E6F")).toBe("bad asset <uri>");
    expect(redact("content://media/external/images/media/42 missing")).toBe(
      "<uri> missing",
    );
  });

  it("replaces email addresses", () => {
    expect(redact("sync failed for henry.withers+glide@example.co.uk")).toBe(
      "sync failed for <email>",
    );
  });

  it("truncates, so an unanticipated payload loses its tail", () => {
    const out = redact("x".repeat(400));
    expect(out).toHaveLength(301); // 300 + the ellipsis
    expect(out.endsWith("…")).toBe(true);
  });

  it("collapses whitespace and trims", () => {
    expect(redact("  two   lines\n\there  ")).toBe("two lines here");
  });

  it("survives an empty message", () => {
    expect(redact("")).toBe("");
  });
});

describe("redactRoute", () => {
  it("strips the id out of a route with a parameter", () => {
    expect(redactRoute(`/goals/${UUID}`)).toBe("/goals/<id>");
  });

  it("leaves a plain route alone — the route is the useful part", () => {
    expect(redactRoute("/(tabs)/portfolio")).toBe("/(tabs)/portfolio");
  });
});

describe("redactStack", () => {
  it("returns nothing for an error that carried no stack", () => {
    expect(redactStack(undefined)).toEqual([]);
  });

  it("drops the message line and keeps the frames", () => {
    const frames = redactStack(
      [
        "TypeError: undefined is not a function",
        "    at TaskRow (/Users/henry/OneDrive/Documents/GitHub/framework/apps/mobile/src/components/today/TaskRow.tsx:88:12)",
        "    at renderWithHooks (node_modules/react-native/index.js:1:1)",
      ].join("\n"),
    );

    expect(frames).toHaveLength(2);
    // The home-directory prefix is gone; the file and line are not.
    expect(frames[0]).toBe("at TaskRow (TaskRow.tsx:88:12)");
    expect(frames[0]).not.toContain("henry");
    expect(frames[1]).toBe("at renderWithHooks (index.js:1:1)");
  });

  it("keeps at most twelve frames", () => {
    const stack = [
      "Error: boom",
      ...Array.from({ length: 30 }, (_, i) => `    at frame${i} (a.js:${i}:1)`),
    ].join("\n");

    expect(redactStack(stack)).toHaveLength(12);
  });

  it("redacts inside frames too", () => {
    const frames = redactStack(
      `Error: boom\n    at load (goals.ts:1:1) for ${UUID}`,
    );
    expect(frames[0]).toContain("<id>");
  });
});
