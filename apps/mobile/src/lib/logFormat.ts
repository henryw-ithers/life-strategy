/**
 * The problem log's shape, trimming, and report text.
 *
 * Pure and **importless**, like `./redact` and `./feedback`, and split
 * out of `./problemLog` for the same reason both of those were: the
 * device half needs `expo-file-system` and `expo-device` and so can only
 * run on a phone, while everything that decides *what the payload says*
 * is string and array work that deserves tests.
 *
 * The report is the text a tester sends to a developer. Getting it wrong
 * fails quietly — a dropped entry or a mislabelled one is invisible
 * unless you already knew what you were looking for.
 */

/** Which capture point caught it — the first thing you want to know,
 *  because it says how much of the app was already running. */
export type ProblemKind =
  /** The database/font gate failed; no screen ever rendered. */
  | "startup"
  /** A route threw during render and the boundary caught it. */
  | "render"
  /** Anything React never sees: async rejections, timers, native
   *  callbacks. May or may not have been fatal to the process. */
  | "fatal"
  /** A screen's own data load rejected. The route rendered fine; it has
   *  nothing to show and said so. Separated from `render` because the
   *  fix is almost always in a query, not in a component. */
  | "load";

export interface ProblemEntry {
  /** ISO 8601, device local clock. */
  at: string;
  kind: ProblemKind;
  /** Error constructor name, e.g. `TypeError`. */
  name: string;
  /** Redacted and truncated — see `./redact`. */
  message: string;
  /** Top frames, redacted. Empty when the error carried no stack. */
  frames: string[];
  /** The route the user was on, redacted. Absent for `startup`. */
  route?: string;
  /** `1.0.0 (14)` — the label testers are asked to read back. */
  build: string;
  /** `ios 18.5 · iPhone 13` */
  device: string;
}

/**
 * A note that feedback was handed off — the event, not the message.
 *
 * **The text the user wrote is deliberately not stored.** The log is
 * shareable in one tap, and ADR-0013 decision 3's rule is that it
 * records what the app did rather than what the user wrote; a screen
 * whose whole selling point is "this is exactly what gets sent" cannot
 * quietly start carrying authored prose. The message already has a
 * durable home — the email — and what this log is for is the question
 * the user actually asks later, which is *did I already mention this*.
 */
export interface FeedbackEntry {
  at: string;
  kind: "feedback";
  /** Which chip they picked. Mirrors `FeedbackKind` in `./feedback`;
   *  kept as a plain string union here so this file stays importless. */
  topic: "suggestion" | "confusing" | "wrong";
  /** How it left the app, since one of these is far less reliable. */
  via: "mail" | "share";
  build: string;
  device: string;
}

export type LogEntry = ProblemEntry | FeedbackEntry;

export function isProblem(entry: LogEntry): entry is ProblemEntry {
  return entry.kind !== "feedback";
}

/**
 * Newest first, and **capped per kind rather than overall**.
 *
 * A single shared cap would let one type starve the other: send eleven
 * pieces of feedback and every crash falls out of the log, which is
 * precisely when you would want them. Ten of each is enough to see a
 * pattern and small enough that storage never becomes a question.
 */
export const MAX_PER_KIND = 10;

/** Sort newest-first, then cap each kind independently. Sorting first
 *  matters: the cap has to drop the *oldest* of a kind, which is only
 *  true of the tail once the whole list is ordered. */
export function trimLog(
  entries: LogEntry[],
  maxPerKind = MAX_PER_KIND,
): LogEntry[] {
  const ordered = [...entries].sort((a, b) => b.at.localeCompare(a.at));
  let problems = 0;
  let feedback = 0;

  return ordered.filter((entry) => {
    if (isProblem(entry)) return ++problems <= maxPerKind;
    return ++feedback <= maxPerKind;
  });
}

export interface ReportContext {
  /** The build the report is being *sent* from, not recorded on. */
  build: string;
  device: string;
}

/**
 * The exact text the share sheet sends — and the exact text the screen
 * shows first (ADR-0013 decision 5). One function, so the preview cannot
 * drift from the payload; that identity is the whole reason the preview
 * is worth anything.
 *
 * Plain text, not JSON: it is going into a message to a person.
 */
export function formatReport(
  entries: LogEntry[],
  context: ReportContext,
): string {
  const header = `Life Strategy problem report · ${context.build} · ${context.device}`;
  if (entries.length === 0) {
    return `${header}\n\nNothing recorded.`;
  }

  const blocks = entries.map((entry, index) => {
    // A report can span builds — a tester may be on a newer one than the
    // entry was recorded on — so an entry that disagrees with the header
    // says so rather than being silently misread.
    const drifted = entry.build !== context.build;

    // Feedback is one line: the message itself went by email, and this
    // is only here so a crash can be read next to "and they wrote in
    // about it four minutes later," which is often the whole story.
    if (!isProblem(entry)) {
      const label = `${index + 1}. ${entry.at} · feedback sent (${entry.topic}, ${entry.via})`;
      return drifted ? `${label}\n   on ${entry.build} · ${entry.device}` : label;
    }

    const lines = [
      `${index + 1}. ${entry.at} · ${entry.kind}${entry.route ? ` · ${entry.route}` : ""}`,
      `   ${entry.name}: ${entry.message}`,
      ...entry.frames.map((frame) => `     ${frame}`),
    ];
    if (drifted) {
      lines.splice(1, 0, `   recorded on ${entry.build} · ${entry.device}`);
    }
    return lines.join("\n");
  });

  return `${header}\n\n${blocks.join("\n\n")}`;
}
