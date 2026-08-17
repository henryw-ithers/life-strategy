#!/usr/bin/env node
/**
 * Content build: `docs/content/*.md` → `apps/mobile/src/content/*.ts`.
 *
 * The markdown is the source of truth and the TypeScript is generated,
 * so copy edits are a prose change rather than a code change. The
 * generated files are **committed** deliberately: Metro has no build
 * step to hang this off, and a bundler that had to shell out to a
 * parser would be a worse trade than a file in git.
 *
 *   node scripts/content/build.mjs           write the generated files
 *   node scripts/content/build.mjs --check   fail if they are stale
 *
 * `--check` is what stops the two halves drifting. Without it the
 * generated file silently wins the next time anyone edits it directly,
 * which is the failure mode every codegen setup dies of.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOCS = join(ROOT, "docs", "content");
const OUT = join(ROOT, "apps", "mobile", "src", "content");

const CHECK = process.argv.includes("--check");
const problems = [];
const warnings = [];

const fail = (msg) => problems.push(msg);
const warn = (msg) => warnings.push(msg);

// ── Markdown parsing ────────────────────────────────────────────────

/**
 * Splits a doc into `## id — Name` sections, ignoring everything above
 * the first one so each file can carry its own instructions without a
 * marker. `---` separators are conventional, not load-bearing.
 */
function sections(md, file) {
  const out = [];
  let current = null;
  for (const raw of md.split(/\r?\n/)) {
    const h2 = /^##\s+(\S+)\s*[—–-]\s*(.+?)\s*$/.exec(raw);
    if (h2) {
      current = { id: h2[1], name: h2[2], lines: [], file };
      out.push(current);
      continue;
    }
    if (/^##\s/.test(raw)) {
      // A heading that didn't match the id — name shape. Almost always
      // a typo in the separator; say so rather than silently skipping.
      const label = raw.replace(/^##\s+/, "").trim();
      if (current !== null || out.length > 0) {
        fail(`${file}: heading "${label}" is not "## <unit-id> — <Name>"`);
      }
      current = null;
      continue;
    }
    if (current) current.lines.push(raw);
  }
  return out;
}

/** Paragraphs and `- ` bullets, in order, with blanks collapsed. */
function blocks(lines) {
  const paras = [];
  const bullets = [];
  let buf = [];
  const flush = () => {
    const text = buf.join(" ").trim();
    if (text) paras.push(text);
    buf = [];
  };
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }
    if (t.startsWith("- ")) {
      flush();
      bullets.push(t.slice(2).trim());
      continue;
    }
    if (t.startsWith(">")) continue; // editorial asides in the doc
    buf.push(t);
  }
  flush();
  return { paras, bullets };
}

// ── Sources ─────────────────────────────────────────────────────────

function readDoc(name) {
  return readFileSync(join(DOCS, name), "utf8");
}

function parseUnits() {
  const secs = sections(readDoc("units.md"), "units.md");
  const info = {};
  for (const s of secs) {
    const { paras, bullets } = blocks(s.lines);
    if (paras.length === 0) fail(`units.md: ${s.id} has no description`);
    if (paras.length > 1) {
      warn(`units.md: ${s.id} has ${paras.length} paragraphs; only the first is used`);
    }
    if (bullets.length === 0) fail(`units.md: ${s.id} has no guidelines`);
    info[s.id] = { description: paras[0] ?? "", guidelines: bullets };
  }
  return info;
}

function parseKeywords() {
  const secs = sections(readDoc("keywords.md"), "keywords.md");
  const map = {};
  for (const s of secs) {
    const { paras } = blocks(s.lines);
    const words = paras
      .join(", ")
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    if (words.length === 0) fail(`keywords.md: ${s.id} has no keywords`);
    const dupes = words.filter((w, i) => words.indexOf(w) !== i);
    if (dupes.length) warn(`keywords.md: ${s.id} repeats ${[...new Set(dupes)].join(", ")}`);
    map[s.id] = [...new Set(words)];
  }
  return map;
}

function parseNotifications() {
  const md = readDoc("notifications.md");
  const after = md.split(/^##\s+Lines\s*$/m)[1];
  if (!after) {
    fail("notifications.md: no '## Lines' section");
    return [];
  }
  const lines = after
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
  if (lines.length === 0) fail("notifications.md: no lines under '## Lines'");
  // ADR-0010 §3 is a structural guarantee, not a style note: there must
  // be no code path that can put a task name or a tally on a lock
  // screen. A template placeholder would create one.
  for (const l of lines) {
    if (/\{|\}|\$\{|%s/.test(l)) {
      fail(`notifications.md: "${l}" looks like a template — ADR-0010 §3 forbids variables in nudge copy`);
    }
  }
  return lines;
}

const PROFILES = new Set(["gap-closing", "maintenance", "light"]);
const METRIC_KINDS = new Set(["cumulative", "target"]);
/** ADR-0025 §5: the library never proposes a task for these. */
const COMMUNAL = new Set(["significant-other", "family", "friendship"]);

/** `#### id · Title` blocks with `key: value` lines, then a description. */
function entries(lines, unitId, kind) {
  const out = [];
  let current = null;
  for (const raw of lines) {
    const h4 = /^####\s+(\S+)\s*[·|]\s*(.+?)\s*$/.exec(raw);
    if (h4) {
      current = { id: h4[1], title: h4[2], fields: {}, body: [] };
      out.push(current);
      continue;
    }
    if (!current) continue;
    const t = raw.trim();
    const field = /^([a-z]+):\s*(.*)$/.exec(t);
    // Field lines only count before the description starts; after that
    // a colon is just punctuation in a sentence.
    if (field && current.body.length === 0 && PARSEABLE_FIELDS.has(field[1])) {
      current.fields[field[1]] = field[2].trim();
      continue;
    }
    if (t) current.body.push(t);
  }
  return out.map((e) => finishEntry(e, unitId, kind));
}

const PARSEABLE_FIELDS = new Set([
  "profiles",
  "frequency",
  "goal",
  "milestones",
  "metric",
]);

function finishEntry(e, unitId, kind) {
  const where = `library.md: ${unitId}/${e.id}`;
  const list = (v) =>
    (v ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const profiles = list(e.fields.profiles);
  if (profiles.length === 0) fail(`${where}: missing "profiles:"`);
  for (const p of profiles) {
    if (!PROFILES.has(p)) fail(`${where}: unknown profile "${p}"`);
  }

  const base = {
    id: e.id,
    title: e.title,
    description: e.body.join(" ").trim() || null,
    profiles,
  };

  if (kind === "goal") {
    const goal = { ...base, milestones: list(e.fields.milestones), metric: null };
    if (e.fields.metric) {
      const [mk, unit, target] = list(e.fields.metric);
      if (!METRIC_KINDS.has(mk)) {
        fail(`${where}: metric kind must be cumulative or target, got "${mk}"`);
      } else if (!unit) {
        fail(`${where}: metric needs a unit label, e.g. "cumulative, books, 24"`);
      } else {
        const n = target === undefined ? null : Number(target);
        if (target !== undefined && !Number.isFinite(n)) {
          fail(`${where}: metric target "${target}" is not a number`);
        }
        goal.metric = { kind: mk, unit, suggestedTarget: Number.isFinite(n) ? n : null };
      }
    }
    return goal;
  }

  const freq = Number(e.fields.frequency);
  if (!Number.isInteger(freq) || freq < 0 || freq > 7) {
    fail(`${where}: "frequency:" must be an integer 0–7, got "${e.fields.frequency ?? ""}"`);
  }
  return {
    ...base,
    timesPerWeek: Number.isInteger(freq) ? freq : 7,
    goalId: e.fields.goal || null,
  };
}

function parseLibrary() {
  const secs = sections(readDoc("library.md"), "library.md");
  const lib = {};
  for (const s of secs) {
    const goalLines = [];
    const taskLines = [];
    let bucket = null;
    for (const raw of s.lines) {
      const h3 = /^###\s+(.+?)\s*$/.exec(raw);
      if (h3) {
        const label = h3[1].toLowerCase();
        bucket = label.startsWith("goal") ? goalLines : label.startsWith("task") ? taskLines : null;
        if (!bucket) fail(`library.md: ${s.id} has an unknown section "${h3[1]}"`);
        continue;
      }
      if (bucket) bucket.push(raw);
    }

    const goals = entries(goalLines, s.id, "goal");
    const tasks = entries(taskLines, s.id, "task").map((t, i) => ({
      ...t,
      defaultRank: i + 1,
    }));

    if (COMMUNAL.has(s.id) && tasks.length > 0) {
      fail(
        `library.md: ${s.id} is a communal unit and must not carry tasks (ADR-0025 §5) — ` +
          `it is served by tagging, not by a checklist`,
      );
    }

    const goalIds = new Set(goals.map((g) => g.id));
    for (const t of tasks) {
      if (t.goalId && !goalIds.has(t.goalId)) {
        fail(`library.md: ${s.id}/${t.id} points at goal "${t.goalId}", which is not in this unit`);
      }
    }
    for (const [label, set] of [["goal", goals], ["task", tasks]]) {
      const ids = set.map((x) => x.id);
      const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
      if (dupes.length) fail(`library.md: ${s.id} has duplicate ${label} ids: ${[...new Set(dupes)].join(", ")}`);
    }

    lib[s.id] = { goals, tasks };
  }
  return lib;
}

// ── Cross-file consistency ──────────────────────────────────────────

/**
 * `db/taxonomy.ts` owns the unit ids; this is content, so it may only
 * follow. Rather than parse TypeScript, the check is that every doc
 * agrees with `units.md`, which is the one that must be complete —
 * that catches the real failure mode, a typo'd id in one file.
 */
function crossCheck({ units, keywords, library }) {
  const known = new Set(Object.keys(units));
  if (known.size !== 18) {
    fail(`units.md defines ${known.size} units; the taxonomy has 18 (db/taxonomy.ts)`);
  }
  for (const [name, map] of [["keywords.md", keywords], ["library.md", library]]) {
    for (const id of Object.keys(map)) {
      if (!known.has(id)) fail(`${name}: "${id}" is not a unit in units.md`);
    }
  }
  for (const id of known) {
    if (!keywords[id]) warn(`keywords.md: no entry for ${id}`);
  }
}

/** ADR-0006 §4's launch bar, as a report rather than a failure. */
function reportBar(units, library) {
  const short = [];
  for (const id of Object.keys(units)) {
    const entry = library[id] ?? { goals: [], tasks: [] };
    const needTasks = COMMUNAL.has(id) ? 0 : 6;
    const missingProfiles = [...PROFILES].filter(
      (p) => ![...entry.goals, ...entry.tasks].some((x) => x.profiles.includes(p)),
    );
    if (entry.goals.length < 3 || entry.tasks.length < needTasks || missingProfiles.length) {
      short.push(
        `  ${id.padEnd(24)} goals ${entry.goals.length}/3  tasks ${entry.tasks.length}/${needTasks}` +
          (missingProfiles.length ? `  missing: ${missingProfiles.join(", ")}` : ""),
      );
    }
  }
  return short;
}

// ── Emit ────────────────────────────────────────────────────────────

const BANNER = (src) => `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: docs/content/${src}
 * Regenerate: npm run content:build
 *
 * Edits here are lost on the next build, and \`npm run content:check\`
 * fails the moment this file and its source disagree.
 */
`;

const j = (v) => JSON.stringify(v, null, 2);

function emitUnits(units) {
  return `${BANNER("units.md")}
export interface UnitInfo {
  description: string;
  guidelines: string[];
}

export const UNIT_INFO: Record<string, UnitInfo> = ${j(units)};
`;
}

function emitNotifications(lines) {
  return `${BANNER("notifications.md")}
export const NOTIFICATION_COPY: readonly string[] = ${j(lines)};

export function randomNotificationLine(): string {
  const i = Math.floor(Math.random() * NOTIFICATION_COPY.length);
  return NOTIFICATION_COPY[i] ?? NOTIFICATION_COPY[0]!;
}
`;
}

/**
 * The matcher is carried through verbatim from the hand-written file
 * this replaced. Codegen may change where the *data* lives; changing
 * behaviour on the way past would be a silent regression in tag
 * suggestions, which is the one thing nobody would notice.
 */
function emitKeywords(map) {
  return `${BANNER("keywords.md")}
const KEYWORDS: Record<string, string[]> = ${j(map)};

/** Up to 3 unit-id suggestions for an activity title, best first. */
export function suggestTags(title: string): string[] {
  const t = title.toLowerCase();
  const scored: { unitId: string; score: number }[] = [];
  for (const [unitId, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const w of words) {
      if (t.includes(w)) score += w.length; // longer matches are stronger signals
    }
    if (score > 0) scored.push({ unitId, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.unitId);
}
`;
}

function emitLibrary(lib) {
  return `${BANNER("library.md")}
/** Which situation a suggestion suits (ADR-0006 §1). */
export type Profile = "gap-closing" | "maintenance" | "light";

export interface GoalTemplate {
  id: string;
  title: string;
  description: string | null;
  profiles: Profile[];
  /** Ordered rung titles; empty when the goal has none. */
  milestones: string[];
  /** ADR-0015 §1. Null when the goal is not countable. */
  metric: {
    kind: "cumulative" | "target";
    unit: string;
    suggestedTarget: number | null;
  } | null;
}

export interface TaskTemplate {
  id: string;
  title: string;
  /** The self-contract: what counts as done. Never scored. */
  description: string | null;
  profiles: Profile[];
  /** 0 = once a fortnight, 7 = daily. */
  timesPerWeek: number;
  /** Order within the unit; proposed tasks arrive pre-ranked so
   *  onboarding needs no pairwise comparisons (ADR-0006 §2). */
  defaultRank: number;
  /** A goal in the same unit, or null for a habit on the unit itself. */
  goalId: string | null;
}

export interface UnitLibrary {
  goals: GoalTemplate[];
  tasks: TaskTemplate[];
}

/** Keyed by unit id. Communal units carry goals but never tasks
 *  (ADR-0025 §5); the build refuses to generate them. */
export const LIBRARY: Record<string, UnitLibrary> = ${j(lib)};
`;
}

// ── Run ─────────────────────────────────────────────────────────────

const units = parseUnits();
const keywords = parseKeywords();
const notifications = parseNotifications();
const library = parseLibrary();
crossCheck({ units, keywords, library });

const outputs = [
  ["units.ts", emitUnits(units)],
  ["notificationCopy.ts", emitNotifications(notifications)],
  ["tagKeywords.ts", emitKeywords(keywords)],
  ["library.ts", emitLibrary(library)],
];

if (problems.length) {
  console.error("Content build failed:\n");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("");
  process.exit(1);
}

for (const w of warnings) console.warn(`  ! ${w}`);

let stale = 0;
for (const [name, body] of outputs) {
  const path = join(OUT, name);
  let existing = null;
  try {
    existing = readFileSync(path, "utf8");
  } catch {
    /* first run */
  }
  const same = existing !== null && existing.replace(/\r\n/g, "\n") === body;
  if (same) continue;
  if (CHECK) {
    stale += 1;
    console.error(`  ✗ ${relative(ROOT, path)} is out of date`);
    continue;
  }
  writeFileSync(path, body);
  console.log(`  → ${relative(ROOT, path)}`);
}

if (CHECK) {
  if (stale) {
    console.error("\nRun `npm run content:build` and commit the result.\n");
    process.exit(1);
  }
  console.log("Content is up to date.");
} else if (outputs.length) {
  const short = reportBar(units, library);
  if (short.length) {
    console.log(`\nADR-0006 launch bar — ${short.length} of 18 units short:`);
    for (const s of short) console.log(s);
    console.log("\nSee docs/content/library-outline.md.");
  } else {
    console.log("\nADR-0006 launch bar met for all 18 units.");
  }
}
