/**
 * Composing a piece of tester feedback into an email.
 *
 * Pure and **importless**, like `./redact`, so it can be tested off a
 * device — and because the interesting part is entirely a string
 * problem: what the developer sees in their inbox, and whether the
 * `mailto:` a phone receives is well-formed.
 *
 * The posture is [ADR-0013](../../../../docs/adr/0013-crash-reporting-and-telemetry.md)'s,
 * unchanged: nothing is transmitted by the app. This builds a URL, the
 * user's mail app opens with it, and the user presses send. What
 * differs from the problem log is only that the payload is a sentence
 * the user wrote on purpose.
 */

/**
 * What the feedback is about. Not a severity and not a triage queue —
 * three words that tell the developer which of three very different
 * emails they are reading, chosen because they are the three things a
 * friend testing an app actually has to say.
 */
export type FeedbackKind = "suggestion" | "confusing" | "wrong";

export const FEEDBACK_KINDS: FeedbackKind[] = [
  "suggestion",
  "confusing",
  "wrong",
];

/** The chip label. */
export const KIND_LABEL: Record<FeedbackKind, string> = {
  suggestion: "An idea",
  confusing: "Confusing",
  wrong: "Not working",
};

/** The subject-line tag, so an inbox sorts by it. */
const KIND_TAG: Record<FeedbackKind, string> = {
  suggestion: "idea",
  confusing: "confusing",
  wrong: "not working",
};

/**
 * A hard ceiling on the message.
 *
 * `mailto:` is a URL, and both iOS and Android drop or truncate one
 * past a few thousand characters — silently, which is the bad kind. Two
 * thousand characters is several paragraphs, comfortably more than
 * anyone types into a phone, and it is enforced on the input itself so
 * the limit is visible while writing rather than discovered afterward.
 */
export const MAX_FEEDBACK_LENGTH = 2000;

export interface FeedbackInput {
  kind: FeedbackKind;
  /** Exactly what the user typed. Never altered — see below. */
  text: string;
  /** From `problemLog.buildLabel()`, e.g. `1.0.0 (3)`. */
  build: string;
  /** From `problemLog.deviceLabel()`, e.g. `ios 18.5 · iPhone 13`. */
  device: string;
}

export interface ComposedFeedback {
  subject: string;
  body: string;
}

/**
 * Build the email.
 *
 * **The user's text is passed through verbatim** — not trimmed of
 * anything but surrounding whitespace, not redacted, not reformatted.
 * That is the opposite of the problem log's rule, and deliberately so:
 * the log records what the app did, where a leak would be an accident,
 * while this is a message a person chose to write and send. Editing it
 * would be both presumptuous and, if it dropped the one detail that
 * mattered, useless.
 *
 * The context footer is separated by a rule so it reads as a signature
 * rather than as part of what the user said.
 */
export function composeFeedback(input: FeedbackInput): ComposedFeedback {
  const text = input.text.trim().slice(0, MAX_FEEDBACK_LENGTH);

  return {
    subject: `Life Strategy feedback (${KIND_TAG[input.kind]}) — ${input.build}`,
    body: [
      text,
      "",
      "—",
      `Life Strategy ${input.build}`,
      input.device,
    ].join("\n"),
  };
}

/**
 * A `mailto:` URL for the composed message.
 *
 * `encodeURIComponent` and not a hand-rolled escape: subject and body
 * both routinely contain `&`, `#`, and `+`, each of which changes the
 * meaning of a URL, and a mangled one opens a blank draft with the
 * message gone. Newlines survive as `%0A`, which every mail client
 * unpacks.
 */
export function mailtoUrl(
  address: string,
  composed: ComposedFeedback,
): string {
  const query = [
    `subject=${encodeURIComponent(composed.subject)}`,
    `body=${encodeURIComponent(composed.body)}`,
  ].join("&");
  return `mailto:${address}?${query}`;
}

/** Nothing to send if there is nothing but whitespace. Checked here so
 *  the button's disabled state and the send path agree. */
export function hasFeedback(text: string): boolean {
  return text.trim().length > 0;
}
