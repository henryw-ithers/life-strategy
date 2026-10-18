/**
 * Pins and "Do N of these" (windows-and-pins.md §2, ADR-0039 §6).
 *
 * A pin is an option you chose to prioritise in a window, held by a
 * time in its day (§2.6). It never changes what's due or what a day is
 * worth (ADR-0039 §12); a "Do N of these" choice is the one exception,
 * so only choice writes mark grades stale.
 *
 * **One live pin per task per day** (§2.7). Pinning a task on a day it
 * already has a pin moves it: a pin for that date replaces any other
 * for that date, and a repeating pin covering the date gets that date
 * as an exception. A new repeating pin takes over the days it names
 * from older repeating pins (`splitForWeekly`).
 *
 * **Old pins aren't kept** (§7): `pruneEndedPins` runs at launch.
 *
 * The screens that write pins arrive in Phases 8 and 9. Until then the
 * old part-of-day placements (`placements.ts`) and pools stay in use.
 * Transactions here use synchronous callbacks: on the app's driver an
 * async callback commits after its first statement.
 */
import { and, eq, gte, inArray, isNull, lt, max, or } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import {
  addDays,
  editWindowStart,
  isSettled,
  pinsOn,
  type PinKind,
  type PinRule,
  type Weekday,
} from "@glide/scoring";

import { currentLocalDate } from "../lib/calendar";
import { db } from "./client";
import {
  lifeUnit,
  task,
  taskCompletion,
  windowChoice,
  windowChoiceMember,
  windowPlacement,
  windowPlacementException,
} from "./schema";
import { markGradesStaleIn, writeAndMarkStale } from "./settings";
import type { Tx } from "./tasks";
import {
  choiceProblem,
  clampPlanned,
  pinProblem,
  splitForWeekly,
  toPinRule,
  weeklyCovers,
  type PinRow,
} from "./windowRules";

type SyncTx = Pick<Tx, "select" | "insert" | "update" | "delete">;

// ── Reading ─────────────────────────────────────────────────────────

/** Every stored pin as the engine's `PinRule`, for `pinsOn`. Rows the
 *  engine can't place are left out. */
export async function loadPinRules(): Promise<PinRule[]> {
  const rows = await db.select().from(windowPlacement);
  const exceptions = await db.select().from(windowPlacementException);
  const byPin = new Map<string, string[]>();
  for (const e of exceptions) {
    byPin.set(e.placementId, [...(byPin.get(e.placementId) ?? []), e.localDate]);
  }
  return rows
    .map((r) => toPinRule(r, byPin.get(r.id) ?? []))
    .filter((r): r is PinRule => r !== null);
}

function exceptionsOf(tx: SyncTx, ids: readonly string[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  if (ids.length === 0) return out;
  const rows = tx
    .select()
    .from(windowPlacementException)
    .where(inArray(windowPlacementException.placementId, [...ids]))
    .all();
  for (const r of rows) out.set(r.placementId, (out.get(r.placementId) ?? new Set()).add(r.localDate));
  return out;
}

function pinsOfTask(tx: SyncTx, taskId: string): PinRow[] {
  return tx.select().from(windowPlacement).where(eq(windowPlacement.taskId, taskId)).all();
}

function except(tx: SyncTx, placementId: string, localDate: string): void {
  tx.insert(windowPlacementException)
    .values({ placementId, localDate })
    .onConflictDoNothing()
    .run();
}

/**
 * Take a task off `date`: its pins for that date go, repeating pins
 * covering it skip it, and a pin until done carried in from an earlier
 * day stops carrying. Without that last step a moved task would have
 * two live pins, and the carried one would come back the next day.
 */
function clearDay(tx: SyncTx, taskId: string, date: string): void {
  const rows = pinsOfTask(tx, taskId);
  const once = rows
    .filter(
      (r) =>
        r.repeat === "once" &&
        r.localDate !== null &&
        (r.localDate === date || (r.localDate < date && r.kind === "untilDone")),
    )
    .map((r) => r.id);
  deletePins(tx, once);

  const weekly = rows.filter((r) => r.repeat === "weekly");
  const skipped = exceptionsOf(tx, weekly.map((r) => r.id));
  const [done] = tx
    .select({ last: max(taskCompletion.localDate) })
    .from(taskCompletion)
    .where(and(eq(taskCompletion.taskId, taskId), lt(taskCompletion.localDate, date)))
    .all();
  const lastDone = done?.last ?? "";
  for (const r of weekly) {
    const except_ = skipped.get(r.id) ?? new Set<string>();
    if (weeklyCovers(r, date) && !except_.has(date)) except(tx, r.id, date);
    if (r.kind !== "untilDone") continue;
    // The days it carries from: applied in the last week, not done since.
    for (let i = 1; i <= 7; i++) {
      const d = addDays(date, -i);
      if (d <= lastDone || (r.fromDate !== null && d < r.fromDate)) break;
      if (weeklyCovers(r, d) && !except_.has(d)) except(tx, r.id, d);
    }
  }
}

function deletePins(tx: SyncTx, ids: readonly string[]): void {
  if (ids.length === 0) return;
  tx.delete(windowPlacementException)
    .where(inArray(windowPlacementException.placementId, [...ids]))
    .run();
  tx.delete(windowPlacement).where(inArray(windowPlacement.id, [...ids])).run();
}

// ── Pinning ─────────────────────────────────────────────────────────

/**
 * Pin a task into the window holding `anchor` on `date` only ("Just
 * this day"). Any other pin the task has that day steps aside. `extra`
 * marks a pin made after the week's runs were done: an extra run on
 * purpose (§2.8). Returns the pin's id.
 */
export async function pinForDay(
  taskId: string,
  date: string,
  anchor: number,
  kind: PinKind,
  { extra = false, order = 0 }: { extra?: boolean; order?: number } = {},
): Promise<string> {
  const problem = pinProblem(anchor, { repeat: "once", date, extra }, currentLocalDate());
  if (problem !== null) throw new Error(problem);
  const id = Crypto.randomUUID();
  db.transaction((tx) => {
    clearDay(tx, taskId, date);
    tx.insert(windowPlacement)
      .values({
        id,
        taskId,
        kind,
        anchorMinute: anchor,
        repeat: "once",
        localDate: date,
        extra,
        sortOrder: order,
      })
      .run();
  });
  return id;
}

/**
 * Pin a task into the window holding `anchor` on `weekdays` every week
 * from `from` (§2.5), until `until` or until removed. On those days it
 * replaces the task's older repeating pins and its pins for single
 * dates. Returns the pin's id.
 */
export async function pinWeekly(
  taskId: string,
  weekdays: readonly Weekday[],
  from: string,
  anchor: number,
  kind: PinKind,
  { until = null, order = 0 }: { until?: string | null; order?: number } = {},
): Promise<string> {
  const problem = pinProblem(anchor, { repeat: "weekly", weekdays, from, until }, currentLocalDate());
  if (problem !== null) throw new Error(problem);
  const id = Crypto.randomUUID();
  const days = [...new Set(weekdays)].sort((a, b) => a - b);
  db.transaction((tx) => {
    const rows = pinsOfTask(tx, taskId);
    const split = splitForWeekly(rows, days, from, until);
    const exceptions = exceptionsOf(tx, split.carry.map((c) => c.source.id));
    for (const e of split.end) {
      tx.update(windowPlacement).set({ untilDate: e.until }).where(eq(windowPlacement.id, e.id)).run();
    }
    for (const c of split.carry) {
      const copy = Crypto.randomUUID();
      const { source } = c;
      tx.insert(windowPlacement)
        .values({
          id: copy,
          taskId,
          kind: source.kind,
          anchorMinute: source.anchorMinute,
          repeat: "weekly",
          weekdays: c.weekdays.join(","),
          fromDate: c.fromDate,
          untilDate: c.untilDate,
          sortOrder: source.sortOrder,
        })
        .run();
      for (const d of exceptions.get(source.id) ?? []) {
        if (d >= c.fromDate && (c.untilDate === null || d <= c.untilDate)) except(tx, copy, d);
      }
    }
    deletePins(tx, split.remove);
    // The task's pins for single dates on the days this one names.
    const named = new Set(days);
    const once = rows.filter(
      (r) =>
        r.repeat === "once" &&
        r.localDate !== null &&
        r.localDate >= from &&
        (until === null || r.localDate <= until) &&
        weeklyCovers({ repeat: "weekly", weekdays: [...named].join(","), fromDate: from, untilDate: until }, r.localDate),
    );
    deletePins(tx, once.map((r) => r.id));
    tx.insert(windowPlacement)
      .values({
        id,
        taskId,
        kind,
        anchorMinute: anchor,
        repeat: "weekly",
        weekdays: days.join(","),
        fromDate: from,
        untilDate: until,
        sortOrder: order,
      })
      .run();
  });
  return id;
}

/** Unpin a task on one day ("Just this day"), leaving any repeating
 *  pin in place for the other days. */
export async function unpinForDay(taskId: string, date: string): Promise<void> {
  db.transaction((tx) => clearDay(tx, taskId, date));
}

/** Change a pin's kind (the pin icon's tap cycle, `nextPinState`). For
 *  a repeating pin this is "This and following" from its first day. */
export async function setPinKind(id: string, kind: PinKind): Promise<void> {
  const result = db.update(windowPlacement).set({ kind }).where(eq(windowPlacement.id, id)).run();
  if (result.changes === 0) throw new Error(`No such pin: ${id}`);
}

/** Set pins' order inside their window, lower first. */
export async function setPinOrder(orderedIds: readonly string[]): Promise<void> {
  db.transaction((tx) => {
    orderedIds.forEach((id, i) => {
      tx.update(windowPlacement).set({ sortOrder: i }).where(eq(windowPlacement.id, id)).run();
    });
  });
}

/** Remove a pin entirely, every day it applies. */
export async function removePin(id: string): Promise<void> {
  db.transaction((tx) => deletePins(tx, [id]));
}

/** End a repeating pin before `date` ("This and following"); one that
 *  hasn't started by then is removed. */
export async function endPinFrom(id: string, date: string): Promise<void> {
  db.transaction((tx) => {
    const [row] = tx.select().from(windowPlacement).where(eq(windowPlacement.id, id)).all();
    if (!row) throw new Error(`No such pin: ${id}`);
    if (row.repeat === "once" || (row.fromDate !== null && row.fromDate >= date)) {
      deletePins(tx, [id]);
      return;
    }
    tx.update(windowPlacement)
      .set({ untilDate: addDays(date, -1) })
      .where(eq(windowPlacement.id, id))
      .run();
    tx.delete(windowPlacementException)
      .where(
        and(
          eq(windowPlacementException.placementId, id),
          gte(windowPlacementException.localDate, date),
        ),
      )
      .run();
  });
}

/**
 * Forget every pin and choice membership of these tasks (§2.11): an
 * archived or deleted task, or one whose unit moved to Not now. Runs
 * inside the caller's transaction. A choice left with fewer than two
 * tasks isn't a choice any more and goes too. Returns whether a choice
 * changed, which can change a score, so the caller marks grades stale.
 */
export function forgetPinsOf(tx: SyncTx, taskIds: readonly string[]): boolean {
  if (taskIds.length === 0) return false;
  const pins = tx
    .select({ id: windowPlacement.id })
    .from(windowPlacement)
    .where(inArray(windowPlacement.taskId, [...taskIds]))
    .all();
  deletePins(tx, pins.map((p) => p.id));

  const touched = tx
    .select({ choiceId: windowChoiceMember.choiceId })
    .from(windowChoiceMember)
    .where(inArray(windowChoiceMember.taskId, [...taskIds]))
    .all()
    .map((r) => r.choiceId);
  if (touched.length === 0) return false;
  tx.delete(windowChoiceMember).where(inArray(windowChoiceMember.taskId, [...taskIds])).run();
  for (const choiceId of new Set(touched)) settleChoice(tx, choiceId);
  return true;
}

/** Pins of these tasks go (archive, delete, Not now). */
export async function removePinsForTasks(taskIds: readonly string[]): Promise<void> {
  db.transaction((tx) => {
    if (forgetPinsOf(tx, taskIds)) markGradesStaleIn(tx);
  });
}

// ── Old pins aren't kept (§7) ───────────────────────────────────────

/**
 * Delete pins whose days are over, so no record of which pins were kept
 * survives (windows-and-pins.md §7, ADR-0029 §3).
 *
 * - A pin for one date before today goes, unless it's a pin until done
 *   still carrying an open task into today (`pinsOn`'s carry rule: a
 *   one-off until it's done, a repeating task until its week ends).
 * - A repeating pin whose last day has passed goes on the same terms.
 * - Choices go once their days have settled. A day in the edit window
 *   can still be scored again, and its choice is part of its score.
 *
 * Runs at launch, on the first day load after the day rolls over
 * (`pruneEndedPinsToday`), and before a backup is written. Returns how
 * many pins it deleted.
 */
export async function pruneEndedPins(today = currentLocalDate()): Promise<number> {
  const ended = await db
    .select()
    .from(windowPlacement)
    .where(
      or(
        and(eq(windowPlacement.repeat, "once"), lt(windowPlacement.localDate, today)),
        and(eq(windowPlacement.repeat, "weekly"), lt(windowPlacement.untilDate, today)),
      ),
    );
  const oldChoices = await db
    .select({ id: windowChoice.id })
    .from(windowChoice)
    .where(lt(windowChoice.localDate, editWindowStart(today)));
  if (ended.length === 0 && oldChoices.length === 0) return 0;

  const carrying = await stillCarrying(ended, today);
  const gone = ended.filter((r) => !carrying.has(r.id)).map((r) => r.id);
  db.transaction((tx) => {
    deletePins(tx, gone);
    const ids = oldChoices.map((c) => c.id);
    if (ids.length > 0) {
      tx.delete(windowChoiceMember).where(inArray(windowChoiceMember.choiceId, ids)).run();
      tx.delete(windowChoice).where(inArray(windowChoice.id, ids)).run();
    }
  });
  return gone.length;
}

let prunedFor: string | null = null;

/** `pruneEndedPins`, at most once per day: the day screen calls this on
 *  every load, and the app can stay open across a rollover for days. */
export async function pruneEndedPinsToday(today = currentLocalDate()): Promise<void> {
  if (prunedFor === today) return;
  await pruneEndedPins(today);
  prunedFor = today;
}

/** Which of these ended pins until done still carry an open task into
 *  today, by the same rule the day uses (`pinsOn`). */
async function stillCarrying(rows: readonly PinRow[], today: string): Promise<Set<string>> {
  const untilDone = rows.filter((r) => r.kind === "untilDone");
  if (untilDone.length === 0) return new Set();
  const taskIds = [...new Set(untilDone.map((r) => r.taskId))];
  const tasks = await db
    .select({ id: task.id, oneOffSize: task.oneOffSize, unitArchived: lifeUnit.archivedAt })
    .from(task)
    .innerJoin(lifeUnit, eq(lifeUnit.id, task.unitId))
    .where(and(inArray(task.id, taskIds), eq(task.active, true), isNull(task.archivedAt)));
  const completions = await db
    .select({
      taskId: taskCompletion.taskId,
      localDate: taskCompletion.localDate,
      fraction: taskCompletion.fraction,
    })
    .from(taskCompletion)
    .where(and(inArray(taskCompletion.taskId, taskIds), lt(taskCompletion.localDate, today)));

  const lastDone = new Map<string, string>();
  const fractions = new Map<string, number[]>();
  for (const c of completions) {
    if ((lastDone.get(c.taskId) ?? "") < c.localDate) lastDone.set(c.taskId, c.localDate);
    fractions.set(c.taskId, [...(fractions.get(c.taskId) ?? []), c.fraction]);
  }
  const oneOffs = new Set(tasks.filter((t) => t.oneOffSize != null).map((t) => t.id));
  const open = new Set(
    tasks
      .filter((t) => t.unitArchived === null)
      .filter((t) => !oneOffs.has(t.id) || !isSettled(fractions.get(t.id) ?? []))
      .map((t) => t.id),
  );

  const rules = untilDone
    .map((r) => toPinRule(r))
    .filter((r): r is PinRule => r !== null);
  // Exceptions only matter to a repeating rule's last applied day.
  const exceptions = await db
    .select()
    .from(windowPlacementException)
    .where(inArray(windowPlacementException.placementId, rules.map((r) => r.id)));
  const withExceptions = rules.map((rule) =>
    rule.when.repeat === "weekly"
      ? {
          ...rule,
          when: {
            ...rule.when,
            exceptDates: new Set(
              exceptions.filter((e) => e.placementId === rule.id).map((e) => e.localDate),
            ),
          },
        }
      : rule,
  );
  // Each rule on its own, so one task's carried pin doesn't hide another
  // of its own that is also still carrying.
  const out = new Set<string>();
  for (const rule of withExceptions) {
    const [pin] = pinsOn([rule], today, { open, lastDone, oneOffs });
    if (pin?.carried) out.add(rule.id);
  }
  return out;
}

// ── "Do N of these" (§2.13) ─────────────────────────────────────────

export interface WindowChoice {
  id: string;
  localDate: string;
  anchorMinute: number;
  plannedCount: number;
  taskIds: string[];
}

/** A date's choices, with their tasks in order. */
export async function loadChoices(localDate: string): Promise<WindowChoice[]> {
  const rows = await db.select().from(windowChoice).where(eq(windowChoice.localDate, localDate));
  if (rows.length === 0) return [];
  const members = await db
    .select()
    .from(windowChoiceMember)
    .where(inArray(windowChoiceMember.choiceId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    id: r.id,
    localDate: r.localDate,
    anchorMinute: r.anchorMinute,
    plannedCount: r.plannedCount,
    taskIds: members
      .filter((m) => m.choiceId === r.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => m.taskId),
  }));
}

/** Each task's commitment (its root unit), or null for a life task. */
function commitmentsOf(tx: SyncTx, taskIds: readonly string[]): Map<string, string | null> {
  const rows = tx
    .select({
      taskId: task.id,
      unitId: lifeUnit.id,
      parentUnitId: lifeUnit.parentUnitId,
      isCustom: lifeUnit.isCustom,
      share: lifeUnit.commitmentShare,
    })
    .from(task)
    .innerJoin(lifeUnit, eq(lifeUnit.id, task.unitId))
    .where(inArray(task.id, [...taskIds]))
    .all();
  return new Map(
    rows.map((r) => [
      r.taskId,
      r.parentUnitId ?? (r.isCustom && r.share !== null ? r.unitId : null),
    ]),
  );
}

/** Tasks in other choices in the same window: same date, same time. */
function inOtherChoices(
  tx: SyncTx,
  localDate: string,
  anchorMinute: number,
  exceptId: string | null,
): Set<string> {
  const rows = tx
    .select({ id: windowChoice.id })
    .from(windowChoice)
    .where(and(eq(windowChoice.localDate, localDate), eq(windowChoice.anchorMinute, anchorMinute)))
    .all()
    .filter((r) => r.id !== exceptId);
  if (rows.length === 0) return new Set();
  return new Set(
    tx
      .select({ taskId: windowChoiceMember.taskId })
      .from(windowChoiceMember)
      .where(inArray(windowChoiceMember.choiceId, rows.map((r) => r.id)))
      .all()
      .map((r) => r.taskId),
  );
}

function writeMembers(tx: SyncTx, choiceId: string, taskIds: readonly string[]): void {
  tx.delete(windowChoiceMember).where(eq(windowChoiceMember.choiceId, choiceId)).run();
  tx.insert(windowChoiceMember)
    .values(taskIds.map((taskId, i) => ({ choiceId, taskId, sortOrder: i })))
    .run();
}

/** A choice with fewer than two tasks left goes; otherwise its planned
 *  count is kept within what's left. */
function settleChoice(tx: SyncTx, choiceId: string): void {
  const left = tx
    .select({ taskId: windowChoiceMember.taskId })
    .from(windowChoiceMember)
    .where(eq(windowChoiceMember.choiceId, choiceId))
    .all();
  if (left.length < 2) {
    tx.delete(windowChoiceMember).where(eq(windowChoiceMember.choiceId, choiceId)).run();
    tx.delete(windowChoice).where(eq(windowChoice.id, choiceId)).run();
    return;
  }
  const [row] = tx.select().from(windowChoice).where(eq(windowChoice.id, choiceId)).all();
  if (row && row.plannedCount > left.length) {
    tx.update(windowChoice)
      .set({ plannedCount: left.length })
      .where(eq(windowChoice.id, choiceId))
      .run();
  }
}

/** Make "Any N of these" in the window holding `anchorMinute` on
 *  `localDate`. Returns its id. */
export async function createChoice(input: {
  localDate: string;
  anchorMinute: number;
  taskIds: readonly string[];
  plannedCount: number;
}): Promise<string> {
  const id = Crypto.randomUUID();
  writeAndMarkStale((tx) => {
    const problem = choiceProblem({
      taskIds: input.taskIds,
      plannedCount: input.plannedCount,
      commitmentOf: commitmentsOf(tx, input.taskIds),
      elsewhere: inOtherChoices(tx, input.localDate, input.anchorMinute, null),
    });
    if (problem !== null) throw new Error(problem);
    tx.insert(windowChoice)
      .values({
        id,
        localDate: input.localDate,
        anchorMinute: input.anchorMinute,
        plannedCount: clampPlanned(input.plannedCount, input.taskIds.length),
      })
      .run();
    writeMembers(tx, id, input.taskIds);
  });
  return id;
}

/** Change a choice's tasks or how many of them to do. */
export async function updateChoice(
  id: string,
  change: { taskIds?: readonly string[]; plannedCount?: number },
): Promise<void> {
  writeAndMarkStale((tx) => {
    const [row] = tx.select().from(windowChoice).where(eq(windowChoice.id, id)).all();
    if (!row) throw new Error(`No such choice: ${id}`);
    const taskIds =
      change.taskIds ??
      tx
        .select({ taskId: windowChoiceMember.taskId, sortOrder: windowChoiceMember.sortOrder })
        .from(windowChoiceMember)
        .where(eq(windowChoiceMember.choiceId, id))
        .all()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => m.taskId);
    const plannedCount = change.plannedCount ?? row.plannedCount;
    const problem = choiceProblem({
      taskIds,
      plannedCount,
      commitmentOf: commitmentsOf(tx, taskIds),
      elsewhere: inOtherChoices(tx, row.localDate, row.anchorMinute, id),
    });
    if (problem !== null) throw new Error(problem);
    if (change.taskIds) writeMembers(tx, id, taskIds);
    tx.update(windowChoice)
      .set({ plannedCount: clampPlanned(plannedCount, taskIds.length) })
      .where(eq(windowChoice.id, id))
      .run();
  });
}

/** Undo a choice. Its tasks stay pinned where they were. */
export async function deleteChoice(id: string): Promise<void> {
  writeAndMarkStale((tx) => {
    tx.delete(windowChoiceMember).where(eq(windowChoiceMember.choiceId, id)).run();
    tx.delete(windowChoice).where(eq(windowChoice.id, id)).run();
  });
}
