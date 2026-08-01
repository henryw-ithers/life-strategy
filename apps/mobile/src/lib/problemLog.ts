/**
 * The on-device problem log (ADR-0013).
 *
 * Glide sends nothing anywhere, so the only way a tester's crash
 * reaches a developer is that the tester chooses to send it. This is
 * the record that makes choosing possible: what broke, on which build,
 * on which screen.
 *
 * It also records **that** feedback was sent, never its text — see
 * `FeedbackEntry`. Two kinds of entry in one file because they are read
 * together: a crash and a message written four minutes later are the
 * same event from two sides, and a log that separated them would hide
 * the most useful thing in it.
 *
 * **A file, not a table** (ADR-0013 decision 2). The database failing
 * to open is one of the failures worth recording, and a log living
 * inside it is unreadable in exactly that case. A file also needs no
 * migration, which keeps a debugging aid out of release.md's
 * expire-the-previous-builds rule.
 *
 * Everything here is best-effort and swallows its own failures. A
 * diagnostics log that can crash the app is worse than no log at all.
 *
 * Redaction lives next door in `./redact`, and the log's shape,
 * trimming, and report text in `./logFormat` — both pure, importless,
 * and tested. What is left here is the part that can only run on a
 * phone: the filesystem, the build and device labels, the route.
 */
import * as Application from "expo-application";
import * as Device from "expo-device";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import type { FeedbackKind } from "./feedback";
import {
  formatReport as formatReportText,
  isProblem,
  trimLog,
  type FeedbackEntry,
  type LogEntry,
  type ProblemEntry,
  type ProblemKind,
} from "./logFormat";
import { redact, redactRoute, redactStack } from "./redact";

/* Re-exported so callers have one import for the log, rather than
 * having to know which half of it they are reaching for. */
export { isProblem };
export type { FeedbackEntry, LogEntry, ProblemEntry, ProblemKind };

const DIR_NAME = "diagnostics";
const FILE_NAME = "problems.json";

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

/** Matches the line at the bottom of Settings, on purpose — a report
 *  and a tester's verbal answer should be the same string. Exported so
 *  the feedback screen stamps the identical label; two spellings of the
 *  same build is a triage trap. */
export function buildLabel(): string {
  const version = Application.nativeApplicationVersion ?? "?";
  const build = Application.nativeBuildVersion;
  return build ? `${version} (${build})` : version;
}

/** `modelName` ("iPhone 13"), never `deviceName` — that one is
 *  whatever the owner called their phone, which is a name and often
 *  theirs. */
export function deviceLabel(): string {
  const os = `${Platform.OS} ${Device.osVersion ?? "?"}`;
  return Device.modelName ? `${os} · ${Device.modelName}` : os;
}

/**
 * The current route, kept here rather than read from the router.
 *
 * The global handler is not a component and cannot call
 * `usePathname()`, so the root layout pushes the value in as it
 * changes (see `RouteWitness` in `src/app/_layout.tsx`). Route paths
 * carry resolved ids — `/goals/<uuid>` — so this goes through the
 * redactor like everything else.
 */
let currentRoute: string | null = null;

export function noteRoute(route: string): void {
  currentRoute = redactRoute(route);
}

/* ------------------------------------------------------------------ *
 * Storage
 * ------------------------------------------------------------------ */

function logFile(): File {
  return new File(new Directory(Paths.document, DIR_NAME), FILE_NAME);
}

/**
 * Read the log. Returns an empty list for every failure — a missing
 * file, a partial write from a process that died mid-crash, a shape
 * from an older build — because there is no useful way to react to a
 * damaged diagnostics file other than to carry on without it.
 *
 * The per-entry filter is the same idea one level down: a log written
 * by an older build has entries this one doesn't understand, and
 * dropping those individually beats discarding the whole file.
 */
export function readLog(): LogEntry[] {
  try {
    const file = logFile();
    if (!file.exists) return [];
    const parsed: unknown = JSON.parse(file.textSync());
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is LogEntry => {
      if (typeof entry !== "object" || entry === null) return false;
      const candidate = entry as LogEntry;
      if (typeof candidate.at !== "string") return false;
      return candidate.kind === "feedback"
        ? typeof (candidate as FeedbackEntry).topic === "string"
        : typeof (candidate as ProblemEntry).message === "string";
    });
  } catch {
    return [];
  }
}

/**
 * Write the log, replacing the file rather than overwriting in place —
 * matching `src/backup/backupFile.ts`. Once a cap is reached the new
 * JSON can be shorter than the old, and trailing bytes from a previous
 * write would make the file unparseable, which fails *silently*:
 * `readLog` treats damage as "no entries."
 */
function writeLog(entries: LogEntry[]): void {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });

  const file = logFile();
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(entries));
}

/**
 * Record one problem, synchronously.
 *
 * Sync is the point: `ErrorUtils`' fatal handler runs on a JS thread
 * that is about to stop, and an `await` there is a log entry that
 * never lands. `expo-file-system`'s `write` is synchronous, so the
 * whole path — read, prepend, trim, write — completes before the
 * handler returns.
 */
export function recordProblem(error: unknown, kind: ProblemKind): void {
  try {
    const thrown =
      error instanceof Error ? error : new Error(String(error));

    const entry: ProblemEntry = {
      at: new Date().toISOString(),
      kind,
      name: thrown.name || "Error",
      message: redact(thrown.message || "(no message)"),
      frames: redactStack(thrown.stack),
      ...(kind !== "startup" && currentRoute ? { route: currentRoute } : {}),
      build: buildLabel(),
      device: deviceLabel(),
    };

    writeLog(trimLog([entry, ...readLog()]));
  } catch {
    // Swallowed on purpose (ADR-0013 decision 2). Losing a log entry
    // is a small problem; a crash handler that throws is a large one.
  }
}

/**
 * Note that feedback left the app. Records the event and the topic,
 * never the message — see `FeedbackEntry`.
 *
 * Called after the hand-off resolves, so what it really records is
 * "the mail app opened with this," not "this was sent." The log screen
 * says as much, because the difference is the whole reason a piece of
 * feedback can fail to arrive.
 */
export function recordFeedbackSent(
  topic: FeedbackKind,
  via: "mail" | "share",
): void {
  try {
    const entry: FeedbackEntry = {
      at: new Date().toISOString(),
      kind: "feedback",
      topic,
      via,
      build: buildLabel(),
      device: deviceLabel(),
    };

    writeLog(trimLog([entry, ...readLog()]));
  } catch {
    // Same reasoning as `recordProblem`: this is bookkeeping, and it
    // must never be the reason a send appears to fail.
  }
}

/** Delete the log. Called by the Clear control and by
 *  `eraseAllData` — erase all data means all data. */
export function clearLog(): void {
  try {
    const file = logFile();
    if (file.exists) file.delete();
  } catch {
    // Same reasoning as above; a log that refuses to go is not worth
    // failing a reset over.
  }
}

/* ------------------------------------------------------------------ *
 * The report
 * ------------------------------------------------------------------ */

/**
 * The exact text the share sheet sends — and the exact text the screen
 * shows first (ADR-0013 decision 5). One function, so the preview
 * cannot drift from the payload; that identity is the whole reason the
 * preview is worth anything.
 *
 * The formatting itself lives in `./logFormat`, which knows nothing
 * about this device. All this adds is the two labels only a phone can
 * answer for.
 */
export function formatReport(entries: LogEntry[]): string {
  return formatReportText(entries, {
    build: buildLabel(),
    device: deviceLabel(),
  });
}
