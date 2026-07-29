/**
 * Redaction for the problem log (ADR-0013 decision 3).
 *
 * Its own module, with **no imports at all**, for two reasons: it is
 * the part of ADR-0013 whose failure mode is a journal entry ending up
 * in a bug report, and a file that touches neither the filesystem nor
 * React Native can be tested as plain functions (`__tests__/`) instead
 * of on a device.
 *
 * The strategy is deliberately layered rather than clever. The
 * structural rule does most of the work — `recordProblem` only ever
 * reads `error.message`, `error.stack`, and the route, never
 * surrounding state or rows — and this file is the second line: it
 * removes what user content *looks* like, then truncates, because the
 * tail of a long message is where anything unanticipated would sit.
 */

const MAX_MESSAGE = 300;
const MAX_FRAME = 200;
const MAX_ROUTE = 120;
const MAX_FRAMES = 12;

/**
 * Everything after a `params:` marker is dropped.
 *
 * This is the rule that matters most. `expo-sqlite` and Drizzle put
 * bound values behind that word, so a failed insert is the one
 * realistic path by which something the user typed could reach a stack
 * trace. Dropping the rest of the string is crude on purpose: what
 * follows is a list of unknown length holding unknown values, and
 * there is nothing in it worth the risk of parsing.
 */
const PARAMS_MARKER = /params:.*/is;

const PATTERNS: [RegExp, string][] = [
  // Task, goal, snapshot, and photo ids. Useless in a report anyway —
  // nobody can look one up without the device.
  [
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "<id>",
  ],
  // Photos are copied into app storage under their own names, and an
  // image-picker result can still carry the original one.
  [/\b(?:file|content|ph|assets-library):\/\/\S*/gi, "<uri>"],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "<email>"],
];

/** Strip anything shaped like user content, collapse whitespace, then
 *  truncate. */
export function redact(text: string, limit = MAX_MESSAGE): string {
  let out = text.replace(PARAMS_MARKER, "params: <redacted>");
  for (const [pattern, replacement] of PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\s+/g, " ").trim();
  return out.length > limit ? `${out.slice(0, limit)}…` : out;
}

/** Route paths carry resolved ids — `/goals/<uuid>` — so they go
 *  through the same redactor as everything else. */
export function redactRoute(route: string): string {
  return redact(route, MAX_ROUTE);
}

/**
 * The directory part of a frame's path, up to the file name.
 *
 * The leading slash is optional because both shapes occur: an absolute
 * `/Users/<name>/…/TaskRow.tsx` in a dev stack and a bundle-relative
 * `node_modules/react-native/index.js`. Requiring it left the first
 * segment of a relative path glued to the file name. Segments exclude
 * brackets so the match cannot run past the `(` a frame opens with.
 */
const DIR_PREFIX = /\/?(?:[^/\s()[\]]+\/)+(?=[^/\s]+\.[cm]?[jt]sx?\b)/g;

/**
 * Turn a stack string into the frames worth keeping.
 *
 * Line 0 repeats `name: message`, which is already stored separately.
 * The directory prefix in front of a frame's file name is this
 * machine's layout — noise in a report, and a home directory is a name.
 */
export function redactStack(stack: string | undefined): string[] {
  if (!stack) return [];
  return stack
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_FRAMES)
    .map((line) => redact(line.replace(DIR_PREFIX, ""), MAX_FRAME));
}
