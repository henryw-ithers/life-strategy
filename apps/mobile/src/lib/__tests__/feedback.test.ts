/**
 * The composer's job is to produce an email a phone can actually open
 * and a developer can actually read. Both halves fail silently when
 * they fail, so both are pinned here.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_FEEDBACK_LENGTH,
  composeFeedback,
  hasFeedback,
  mailtoUrl,
} from "../feedback";

const context = { build: "1.0.0 (3)", device: "ios 18.5 · iPhone 13" };

describe("composeFeedback", () => {
  it("tags the subject by kind and stamps the build", () => {
    expect(
      composeFeedback({ kind: "suggestion", text: "more colours", ...context })
        .subject,
    ).toBe("Glide feedback (idea) — 1.0.0 (3)");
    expect(
      composeFeedback({ kind: "wrong", text: "broken", ...context }).subject,
    ).toBe("Glide feedback (not working) — 1.0.0 (3)");
  });

  it("passes the user's words through untouched", () => {
    // Deliberately awkward: punctuation, an apostrophe, a line break,
    // and a word the problem log's redactor would have eaten.
    const text =
      "The diagnostic's 5 minutes felt long.\nMaybe let me stop halfway?";
    const { body } = composeFeedback({ kind: "confusing", text, ...context });

    expect(body.startsWith(text)).toBe(true);
  });

  it("trims surrounding whitespace but keeps the shape inside", () => {
    const { body } = composeFeedback({
      kind: "suggestion",
      text: "\n\n  one\n\n  two  \n\n",
      ...context,
    });
    expect(body.startsWith("one\n\n  two")).toBe(true);
  });

  it("appends the context as a signature, below a rule", () => {
    const { body } = composeFeedback({
      kind: "suggestion",
      text: "hi",
      ...context,
    });
    expect(body).toBe("hi\n\n—\nGlide 1.0.0 (3)\nios 18.5 · iPhone 13");
  });

  it("caps the message so the mailto URL stays openable", () => {
    const { body } = composeFeedback({
      kind: "suggestion",
      text: "x".repeat(MAX_FEEDBACK_LENGTH + 500),
      ...context,
    });
    expect(body.split("\n")[0]).toHaveLength(MAX_FEEDBACK_LENGTH);
  });
});

describe("mailtoUrl", () => {
  it("encodes the characters that would otherwise truncate the draft", () => {
    const url = mailtoUrl(
      "you@example.com",
      composeFeedback({
        kind: "suggestion",
        text: "tasks & goals #2 need a + button",
        ...context,
      }),
    );

    expect(url.startsWith("mailto:you@example.com?subject=")).toBe(true);
    // Raw &, # and + past the first separator would each cut the body
    // short or change its meaning.
    expect(url).toContain("%26");
    expect(url).toContain("%23");
    expect(url).toContain("%2B");
    expect(url.slice(url.indexOf("body="))).not.toContain("&");
  });

  it("survives a round trip, newlines included", () => {
    const composed = composeFeedback({
      kind: "confusing",
      text: "line one\nline two",
      ...context,
    });
    const url = mailtoUrl("you@example.com", composed);
    const body = decodeURIComponent(url.split("body=")[1]);

    expect(body).toBe(composed.body);
  });

  it("keeps subject and body as separate parameters", () => {
    const url = mailtoUrl(
      "you@example.com",
      composeFeedback({ kind: "wrong", text: "nope", ...context }),
    );
    expect(url.match(/[?&]subject=/g)).toHaveLength(1);
    expect(url.match(/[?&]body=/g)).toHaveLength(1);
  });
});

describe("hasFeedback", () => {
  it("treats whitespace as nothing to send", () => {
    expect(hasFeedback("")).toBe(false);
    expect(hasFeedback("   \n\t ")).toBe(false);
    expect(hasFeedback("  a  ")).toBe(true);
  });
});
