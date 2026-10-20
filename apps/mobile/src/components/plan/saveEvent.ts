/**
 * Saving an event from the event sheet, wherever it was opened (Plan, a
 * commitment): one path, so the places can't drift apart.
 *
 * Editing a repeating event asks "This event only", "This and following"
 * or "All events" (ADR-0040 §2; spec §5.8). From Plan or a commitment
 * there's no particular day, so "this event" is the series' next run
 * from today. Changing only how long it repeats doesn't ask: that's the
 * series' own setting.
 */
import { addDays } from "@glide/scoring";
import { Alert } from "react-native";

import type { EventInput } from "../../db/events";
import { nextRun, type Bounds } from "../../db/seriesRules";
import {
  editEventFollowing,
  editEventOccurrence,
  setEventRepeat,
  tickedFrom,
} from "../../db/seriesWrites";
import { loadTaskSkips } from "../../db/skips";
import { addEvent, updateEvent } from "../../db/tasks";
import { currentLocalDate } from "../../lib/calendar";

/** The event as it was before the sheet opened. */
export interface StoredEvent {
  id: string;
  title: string;
  plannedWeekdays: string | null;
  oneOffDate: string | null;
  startMinute: number | null;
  endMinute: number | null;
  notes: string | null;
  timesPerWeek: number;
  repeatFrom: string | null;
  repeatUntil: string | null;
}

type Scope = "one" | "following" | "all";

function askScope(): Promise<Scope | null> {
  return new Promise((resolve) => {
    Alert.alert("Change which events?", undefined, [
      { text: "This event only", onPress: () => resolve("one") },
      { text: "This and following", onPress: () => resolve("following") },
      { text: "All events", onPress: () => resolve("all") },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

/** A new event, with how long it repeats. Returns its id. */
export async function saveNewEvent(
  unitIds: string[],
  input: EventInput,
  bounds: Bounds | null,
): Promise<string | null> {
  const id = await addEvent(unitIds, input);
  if (id && bounds) await setEventRepeat(id, bounds);
  return id;
}

/** The days a series' own skips take off it, and the days from today
 *  it's already ticked, for the run "this event" means. */
async function skippedDays(taskId: string): Promise<Set<string>> {
  const out = await tickedFrom(taskId, currentLocalDate());
  for (const s of await loadTaskSkips(taskId)) {
    if (s.kind === "occurrence") out.add(s.localDate);
    else for (let i = 0; i < 7; i++) out.add(addDays(s.localDate, i));
  }
  return out;
}

/**
 * Save an edited event. Resolves false if the scope question was
 * cancelled, so the sheet can stay open.
 */
export async function saveEventEdit(
  event: StoredEvent,
  input: EventInput,
  bounds: Bounds | null,
): Promise<boolean> {
  const repeating = event.plannedWeekdays !== null && event.oneOffDate === null;
  const staysRepeating = input.weekdays.length > 0;
  const detailsChanged =
    input.title.trim() !== event.title ||
    [...input.weekdays].sort().join(",") !== (event.plannedWeekdays ?? "") ||
    input.date !== (repeating ? null : event.oneOffDate) ||
    input.startMinute !== event.startMinute ||
    input.endMinute !== event.endMinute ||
    (input.notes?.trim() || null) !== (event.notes?.trim() || null);

  /** The repeat length is the series' own setting: saved only when it
   *  changed, whichever events the details apply to. */
  const boundsChanged =
    bounds !== null &&
    (bounds.repeatFrom !== event.repeatFrom || bounds.repeatUntil !== event.repeatUntil);

  // A one-time event, a change to or from one-time, or only the repeat
  // length: the whole thing changes, with nothing to ask.
  if (!repeating || !staysRepeating || !detailsChanged) {
    if (detailsChanged) await updateEvent(event.id, input);
    if (boundsChanged) await setEventRepeat(event.id, bounds);
    return true;
  }

  const scope = await askScope();
  if (scope === null) return false;
  const date = nextRun(
    { ...event, skippedDates: await skippedDays(event.id) },
    currentLocalDate(),
  );
  if (scope === "all" || date === null) {
    await updateEvent(event.id, input);
    if (boundsChanged) await setEventRepeat(event.id, bounds);
    return true;
  }
  if (scope === "one") {
    await editEventOccurrence(event.id, date, input);
    if (boundsChanged) await setEventRepeat(event.id, bounds);
    return true;
  }
  const next = await editEventFollowing(event.id, date, input);
  if (boundsChanged) {
    await setEventRepeat(
      next ?? event.id,
      next ? { repeatFrom: date, repeatUntil: bounds.repeatUntil } : bounds,
    );
  }
  return true;
}

/** Say so when a save fails, rather than leave a rejected promise
 *  nobody sees. Resolves whether it saved. */
export async function savedOrSaid(save: () => Promise<boolean>): Promise<boolean> {
  try {
    return await save();
  } catch (e) {
    Alert.alert("It wasn't saved", e instanceof Error ? e.message : String(e));
    return false;
  }
}
