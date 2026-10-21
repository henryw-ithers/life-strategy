/**
 * Which units a task is filed under — the rules behind the unit picker,
 * kept free of React Native so they can be tested (ADR-0013).
 *
 * The picker used to be one rule: tap to add, tap to remove, first pick
 * is the home. Commitments add two more, and both come from ADR-0035 §3:
 *
 * - **A commitment can only be the home.** The band pays a commitment's
 *   own work, found by where it is listed; a life task that merely
 *   *also counted toward* School would have nowhere to be paid from.
 *   So picking a commitment moves it to the front, rather than
 *   appending it somewhere it cannot mean anything.
 * - **A task belongs to one commitment.** Picking a second replaces the
 *   first instead of stacking — two commitments cannot both be first.
 *
 * Everything else picked alongside a commitment is a *note* (see
 * `membershipsFor`): it records the task touches that part of your
 * life, and earns nothing there.
 */
import { suggestTags } from "../../content/tagKeywords";
import type { PlanData } from "../../db/tasks";

export interface PickableUnit {
  id: string;
  name: string;
  areaId: string;
  /** ADR-0027 §4: still editorial, no longer structural. A communal
   *  unit takes tasks like any other; picking one just shows a line. */
  motivationKind?: "instrumental" | "communal";
  /** A commitment or one of its parts (ADR-0035). */
  commitment?: boolean;
  /** In the Not now tier (ADR-0041): shown greyed, never picked. A Not
   *  now unit holds no tasks (spec §5.4.1). */
  notNow?: boolean;
}

/** The selection after tapping `tapped`. `value[0]` is the home unit. */
export function selectUnit(
  value: readonly string[],
  tapped: string,
  units: readonly PickableUnit[],
  max: number,
): string[] {
  if (value.includes(tapped)) return value.filter((v) => v !== tapped);
  if (units.find((u) => u.id === tapped)?.notNow === true) return [...value];
  const isCommitment = (id: string) =>
    units.find((u) => u.id === id)?.commitment === true;

  if (isCommitment(tapped)) {
    const others = value.filter((v) => !isCommitment(v));
    // Replacing a commitment never needs a free slot; adding one does.
    const replacing = others.length < value.length;
    if (!replacing && value.length >= max) return [...value];
    return [tapped, ...others];
  }
  if (value.length >= max) return [...value];
  return [...value, tapped];
}

/** Whether a unit chip can be tapped at all right now. */
export function canPick(
  value: readonly string[],
  id: string,
  units: readonly PickableUnit[],
  max: number,
): boolean {
  if (value.includes(id)) return true;
  if (units.find((u) => u.id === id)?.notNow === true) return false;
  if (value.length < max) return true;
  // Full, but a commitment can still swap for the one already there.
  const isCommitment = (x: string) =>
    units.find((u) => u.id === x)?.commitment === true;
  return isCommitment(id) && value.some(isCommitment);
}

/**
 * Whether this task can be saved as scheduled so far (ADR-0033).
 *
 * **Recurring commitment work has to name its days.** The band pays a
 * commitment task on the days it is scheduled; one set to "any three
 * days" belongs to no day in particular, so no day's band could ever
 * pay it and it would sit on the checklist worth nothing. A one-off is
 * fine without a date — it is owed from the moment it exists.
 */
export function needsDays(input: {
  homeIsCommitment: boolean;
  once: boolean;
  weekdays: readonly unknown[];
}): boolean {
  return input.homeIsCommitment && !input.once && input.weekdays.length === 0;
}

/**
 * Everything a task can be filed under: commitments and their parts
 * first, then the scored life units.
 *
 * Commitments lead because there are at most three of them, they are
 * where assignments and sessions go, and at the end of an eighteen-chip
 * row they would be the chips nobody scrolls to.
 */
export function pickableUnits(plan: PlanData | null): PickableUnit[] {
  if (plan === null) return [];
  const commitments = plan.commitments.flatMap((c) => [
    // A split commitment holds nothing itself — its work goes in a
    // sub-commitment (ADR-0035 §1) — so only those are offered.
    ...(c.split ? [] : [{ id: c.id, name: c.name, areaId: COMMITMENT_AREA, commitment: true }]),
    ...c.parts.map((p) => ({
      id: p.id,
      name: p.name,
      areaId: COMMITMENT_AREA,
      commitment: true,
    })),
  ]);
  const life = plan.areas.flatMap((a) =>
    a.units
      .filter((u) => u.includeInScoring)
      .map((u) => ({
        id: u.id,
        name: u.name,
        areaId: u.areaId,
        motivationKind: u.motivationKind,
      })),
  );
  // Not now units come last and greyed: seen, so you know where they
  // went, but they hold no tasks until moved up (spec §5.4.1).
  const notNow = plan.areas.flatMap((a) =>
    a.units
      // The same test the tiers use (`tierRules`): out of scoring.
      .filter((u) => !u.includeInScoring)
      .map((u) => ({ id: u.id, name: u.name, areaId: u.areaId, notNow: true })),
  );
  return [...commitments, ...life, ...notNow];
}

/**
 * The unit a new task's title points to (spec §5.7), worked out on the
 * device, or null for "Choose a unit". A commitment or one of its parts
 * named in the title comes first ("COMP2521 lab"); then the strongest
 * keyword match among the units you can pick. Never a Not now unit.
 */
export function guessUnit(title: string, units: readonly PickableUnit[]): string | null {
  const t = title.trim().toLowerCase();
  if (t.length < 3) return null;
  // As a whole word: "Work" mustn't claim "workout", which would make
  // a run commitment work.
  const named = units
    .filter((u) => u.commitment === true && u.name.trim().length >= 3)
    .filter((u) => wholeWord(t, u.name.trim().toLowerCase()))
    // The longest name is the most specific: "COMP2521" over "School".
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (named) return named.id;
  const pickable = new Set(units.filter((u) => u.notNow !== true).map((u) => u.id));
  return suggestTags(t).find((id) => pickable.has(id)) ?? null;
}

/** The hue commitments are drawn in everywhere else in the app. */
export const COMMITMENT_AREA = "work-money";

/** Whether `word` appears in `text` with no letter or digit either side. */
function wholeWord(text: string, word: string): boolean {
  let from = 0;
  for (;;) {
    const i = text.indexOf(word, from);
    if (i === -1) return false;
    const before = text[i - 1];
    const after = text[i + word.length];
    const edge = (c: string | undefined) => c === undefined || !/[a-z0-9]/.test(c);
    if (edge(before) && edge(after)) return true;
    from = i + 1;
  }
}
