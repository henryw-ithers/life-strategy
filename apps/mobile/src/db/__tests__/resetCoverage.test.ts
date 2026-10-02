/**
 * `eraseAllData` must name every table, and the list must stay ordered.
 *
 * This guard exists because the bug it catches is **silent**:
 * `TABLES_IN_DELETE_ORDER` fell three tables behind between 2026-08 and
 * 2026-09-11 (`goal_progress`, `task_completion_tag`,
 * `planned_occurrence`), so a "wipe" left their rows in place and
 * nothing failed. A table added without a line in that list does not
 * throw — it just survives a reset.
 *
 * Both files are read as **text** rather than imported: `reset.ts`
 * pulls in `./client`, which is React Native, and the app's vitest
 * runner only handles modules free of those imports (ADR-0013).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

const DB_DIR = path.join(__dirname, "..");

const read = (file: string) =>
  fs.readFileSync(path.join(DB_DIR, file), "utf8");

/** Table names as `schema.ts` declares them. */
function schemaTables(): string[] {
  return [...read("schema.ts").matchAll(/sqliteTable\(\s*"([^"]+)"/g)].map(
    (m) => m[1] as string,
  );
}

/** The delete list, in order, ignoring comments. */
function deleteOrder(): string[] {
  const body = read("reset.ts").match(
    /TABLES_IN_DELETE_ORDER = \[([\s\S]*?)\] as const;/,
  );
  if (!body) throw new Error("TABLES_IN_DELETE_ORDER not found in reset.ts");
  return [...(body[1] as string).matchAll(/"([^"]+)"/g)].map(
    (m) => m[1] as string,
  );
}

describe("eraseAllData covers the schema", () => {
  it("names every table in schema.ts", () => {
    const missing = schemaTables().filter((t) => !deleteOrder().includes(t));
    expect(missing).toEqual([]);
  });

  it("names nothing that is not a table", () => {
    const tables = schemaTables();
    const extra = deleteOrder().filter((t) => !tables.includes(t));
    expect(extra).toEqual([]);
  });

  it("lists each table exactly once", () => {
    const order = deleteOrder();
    expect(new Set(order).size).toBe(order.length);
  });
});

describe("children are deleted before their parents", () => {
  /**
   * Pairs a `references(() => x.y)` back to the table it points at, by
   * walking `schema.ts` block by block. Self-references are skipped —
   * `life_unit.parent_unit_id` is handled inside the delete loop rather
   * than by list order, since one table cannot precede itself.
   */
  function dependencies(): { child: string; parent: string }[] {
    const src = read("schema.ts");
    // Each declaration runs until the next one begins, which avoids
    // having to match TypeScript's nesting with a regex.
    const starts = [
      ...src.matchAll(/export const (\w+) = sqliteTable\(\s*\n?\s*"([^"]+)"/g),
    ];
    const tableOf = new Map(starts.map((m) => [m[1] as string, m[2] as string]));
    const out: { child: string; parent: string }[] = [];
    starts.forEach((m, i) => {
      const child = m[2] as string;
      const body = src.slice(
        m.index ?? 0,
        i + 1 < starts.length ? starts[i + 1]?.index : undefined,
      );
      for (const ref of body.matchAll(/=>\s*(\w+)\.id\b/g)) {
        const parent = tableOf.get(ref[1] as string);
        if (parent && parent !== child) out.push({ child, parent });
      }
    });
    return out;
  }

  it("finds the dependencies it is meant to check", () => {
    // A guard on the guard: if the regex stops matching, the test above
    // would pass vacuously and prove nothing.
    const deps = dependencies();
    expect(deps.length).toBeGreaterThan(10);
    expect(deps).toContainEqual({ child: "goal_progress", parent: "goal" });
    expect(deps).toContainEqual({
      child: "task_completion_tag",
      parent: "task_completion",
    });
    expect(deps).toContainEqual({ child: "planned_occurrence", parent: "task" });
  });

  /**
   * `task.goal_id` and `goal.autocount_task_id` (ADR-0015 §2) point at
   * each other, so **no ordering of the list can satisfy both.** The
   * cycle is broken in the loop instead, by nulling the optional side
   * before anything is deleted. Exempted here, and asserted below.
   */
  const CYCLE = [{ child: "goal", parent: "task" }];

  it("orders every child ahead of every table it references", () => {
    const order = deleteOrder();
    const at = (t: string) => order.indexOf(t);
    const wrong = dependencies().filter(
      ({ child, parent }) =>
        at(child) !== -1 &&
        at(parent) !== -1 &&
        at(child) > at(parent) &&
        !CYCLE.some((c) => c.child === child && c.parent === parent),
    );
    expect(wrong).toEqual([]);
  });

  it("breaks the one cycle it cannot order around", () => {
    expect(read("reset.ts")).toContain(
      "UPDATE goal SET autocount_task_id = NULL",
    );
  });
});

describe("the self-referencing table is handled in the loop", () => {
  it("clears sub-commitments before the bulk life_unit delete", () => {
    // `life_unit.parent_unit_id` (ADR-0035) means one DELETE can trip
    // the constraint mid-statement with foreign keys on. List order
    // cannot express "before itself", so the loop does it.
    expect(read("reset.ts")).toContain(
      "DELETE FROM life_unit WHERE parent_unit_id IS NOT NULL",
    );
  });
});
