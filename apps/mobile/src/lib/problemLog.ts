/**
 * The on-device problem log (ADR-0013).
 *
 * Glide sends nothing anywhere, so the only way a tester's crash
 * reaches a developer is that the tester chooses to send it. This is
 * the record that makes choosing possible: what broke, on which build,
 * on which screen.
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
 * Redaction lives next door in `./redact` — pure, importless, and
 * tested, because it is the half of this file whose failure mode is a
 * journal entry ending up in a bug report.
 */
import * as Application from "expo-application";
import * as Device from "expo-device";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { redact, redactRoute, redactStack } from "./redact";

/** Newest first. Ten is enough to see a pattern and small enough that
 *  storage never becomes a question. */
const MAX_ENTRIES = 10;

const DIR_NAME = "diagnostics";
const FILE_NAME = "problems.json";

/** Which capture point caught it — the first thing you want to know,
 *  because it says how much of the app was already running. */
export type ProblemKind =
  /** The database/font gate failed; no screen ever rendered. */
  | "startup"
  /** A route threw during render and the boundary caught it. */
  | "render"
  /** Anything React never sees: async rejections, timers, native
   *  callbacks. May or may not have been fatal to the process. */
  | "fatal";

export interface ProblemEntry {
  /** ISO 8601, device local clock. */
  at: string;
  kind: ProblemKind;
  /** Error constructor name, e.g. `TypeError`. */
  name: string;
  /** Redacted and truncated — see `redact`. */
  message: string;
  /** Top frames, redacted. Empty when the error carried no stack. */
  frames: string[];
  /** The route the user was on, redacted. Absent for `startup`. */
  route?: string;
  /** `1.0.0 (14)` — the label testers are asked to read back. */
  build: string;
  /** `ios 18.5 · iPhone14,2` */
  device: string;
}

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

/** Matches the line at the bottom of Settings, on purpose — a report
 *  and a tester's verbal answer should be the same string. */
function buildLabel(): string {
  const version = Application.nativeApplicationVersion ?? "?";
  const build = Application.nativeBuildVersion;
  return build ? `${version} (${build})` : version;
}

/** `modelName` ("iPhone 13"), never `deviceName` — that one is
 *  whatever the owner called their phone, which is a name and often
 *  theirs. */
function deviceLabel(): string {
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
 */
export function readProblems(): ProblemEntry[] {
  try {
    const file = logFile();
    if (!file.exists) return [];
    const parsed: unknown = JSON.parse(file.textSync());
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ProblemEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as ProblemEntry).at === "string" &&
        typeof (entry as ProblemEntry).message === "string",
    );
  } catch {
    return [];
  }
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

    const next = [entry, ...readProblems()].slice(0, MAX_ENTRIES);

    const dir = new Directory(Paths.document, DIR_NAME);
    if (!dir.exists) dir.create({ intermediates: true });

    // Replace rather than overwrite in place, matching
    // `src/backup/backupFile.ts`. Once the cap is reached the new JSON
    // can be shorter than the old, and trailing bytes from a previous
    // write would make the file unparseable — which fails silently,
    // because `readProblems` treats damage as "no entries."
    const file = logFile();
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(next));
  } catch {
    // Swallowed on purpose (ADR-0013 decision 2). Losing a log entry
    // is a small problem; a crash handler that throws is a large one.
  }
}

/** Delete the log. Called by the Clear control and by
 *  `eraseAllData` — erase all data means all data. */
export function clearProblems(): void {
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
 * Plain text, not JSON: it is going into a message to a person.
 */
export function formatReport(entries: ProblemEntry[]): string {
  const header = `Glide problem report · ${buildLabel()} · ${deviceLabel()}`;
  if (entries.length === 0) {
    return `${header}\n\nNothing recorded.`;
  }

  const blocks = entries.map((entry, index) => {
    const lines = [
      `${index + 1}. ${entry.at} · ${entry.kind}${entry.route ? ` · ${entry.route}` : ""}`,
      `   ${entry.name}: ${entry.message}`,
      ...entry.frames.map((frame) => `     ${frame}`),
    ];
    // A report can span builds — a tester may be on a newer one than
    // the crash happened on — so an entry that disagrees with the
    // header says so rather than being silently misread.
    if (entry.build !== buildLabel()) {
      lines.splice(1, 0, `   recorded on ${entry.build} · ${entry.device}`);
    }
    return lines.join("\n");
  });

  return `${header}\n\n${blocks.join("\n\n")}`;
}
