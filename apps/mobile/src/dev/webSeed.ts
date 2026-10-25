/**
 * Web preview only (docs/web-preview.md): fill the browser's database
 * with a believable plan, so screens past Priorities can be looked at.
 * Priorities' Done is a native toolbar button, so the web preview can't
 * save tiers by hand.
 *
 * Exposed as `globalThis.__lsDev.seed()` from `index.web.js`; nothing on
 * the device imports this. Run it once on an empty database, then
 * reload.
 */
import { createCommitment } from "../db/commitmentWrites";
import { saveHoursFrom } from "../db/hours";
import { completeOnboarding } from "../db/onboarding";
import { loadPriorities, savePriorities } from "../db/priorities";
import { addEvent, addTask } from "../db/tasks";
import { currentLocalDate } from "../lib/calendar";

const TOP = ["exercise-fitness", "sleep-recovery", "job-career"];
const BACKGROUND = ["finances", "hygiene", "spirituality", "adventure-experiences"];
const NOT_NOW = ["giving-service"];

const h = (hour: number, minute = 0) => hour * 60 + minute;

export async function seed(): Promise<string> {
  const board = await loadPriorities();
  if (!board.firstRun) return "Already seeded.";
  await savePriorities(
    board.units.map((u) => ({
      unitId: u.unitId,
      tier: TOP.includes(u.unitId)
        ? "top"
        : BACKGROUND.includes(u.unitId)
          ? "background"
          : NOT_NOW.includes(u.unitId)
            ? "notNow"
            : "important",
    })),
    new Map(),
  );
  const today = currentLocalDate();
  await saveHoursFrom(today, [
    { weekdays: [1, 2, 3, 4, 5], ranges: [{ start: h(7), end: h(21) }] },
    { weekdays: [6, 7], ranges: [{ start: h(9), end: h(17) }] },
  ]);
  const work = await createCommitment({ name: "Work" });
  await addEvent([work], {
    title: "Office",
    weekdays: [1, 2, 3, 4, 5],
    date: null,
    startMinute: h(9),
    endMinute: h(17),
    notes: null,
  });
  await addTask([work], "Weekly report", 1);
  for (const [unit, title, times] of [
    ["exercise-fitness", "Gym", 3],
    ["exercise-fitness", "Run", 2],
    ["sleep-recovery", "Lights out", 7],
    ["job-career", "Deep work", 5],
    ["nutrition", "Cook", 4],
    ["education-learning", "Read", 5],
    ["living-space", "Tidy", 3],
    ["finances", "Check the accounts", 1],
  ] as const) {
    await addTask([unit], title, times);
  }
  await completeOnboarding();
  return "Seeded. Reload the page.";
}
