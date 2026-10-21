/**
 * The four answers to onboarding's "Anything with set hours?"
 * (ADR-0045 §1, spec §5.11). The choice fills in the working-hours
 * step and, for shift work, makes new events one-time by default. It
 * creates nothing: commitments and their events are added by hand.
 *
 * Working hours are when you're free to work, and events are cut out
 * of them (ADR-0039 §1). So a 9–5 job's hours run around the job, not
 * over it: its events take the middle of the day out.
 */
import type { WorkSchedule } from "@glide/scoring";

export type TemplateId = "student" | "nine-to-five" | "shifts" | "nothing-fixed";

export interface ScheduleTemplate {
  id: TemplateId;
  label: string;
  detail: string;
  schedules: readonly WorkSchedule[];
  /** New events start as one-time rather than weekly. */
  eventsOnce: boolean;
}

const h = (hour: number, minute = 0) => hour * 60 + minute;
const WEEKDAYS = [1, 2, 3, 4, 5] as const;
const WEEKEND = [6, 7] as const;
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7] as const;

export const SCHEDULE_TEMPLATES: readonly ScheduleTemplate[] = [
  {
    id: "student",
    label: "Student",
    detail: "Classes on set days",
    schedules: [
      { weekdays: WEEKDAYS, ranges: [{ start: h(8), end: h(18) }] },
      { weekdays: WEEKEND, ranges: [{ start: h(10), end: h(16) }] },
    ],
    eventsOnce: false,
  },
  {
    id: "nine-to-five",
    label: "9–5 job",
    detail: "The same hours each week",
    schedules: [
      { weekdays: WEEKDAYS, ranges: [{ start: h(7), end: h(21) }] },
      { weekdays: WEEKEND, ranges: [{ start: h(9), end: h(17) }] },
    ],
    eventsOnce: false,
  },
  {
    id: "shifts",
    label: "Shift work",
    detail: "Hours that change week to week",
    schedules: [{ weekdays: EVERY_DAY, ranges: [{ start: h(8), end: h(20) }] }],
    eventsOnce: true,
  },
  {
    id: "nothing-fixed",
    label: "Nothing fixed",
    detail: "Your time is your own",
    schedules: [{ weekdays: EVERY_DAY, ranges: [{ start: h(9), end: h(17) }] }],
    eventsOnce: false,
  },
];

export function templateFor(id: string | null | undefined): ScheduleTemplate | null {
  return SCHEDULE_TEMPLATES.find((t) => t.id === id) ?? null;
}
