/**
 * The daily nudge's copy pool (ADR-0010 §3). Generic only — never a
 * task name, unit name, or count, and every line must read equally
 * well on a good day or a bad one (the ambient-kindness test,
 * ADR-0008). One is picked at random per schedule.
 */
export const NOTIFICATION_COPY: readonly string[] = [
  "Today's list is ready.",
  "Your day's checklist is waiting, whenever works.",
  "A few minutes for today's list.",
  "Today's checklist — take a look when you're ready.",
];

export function randomNotificationLine(): string {
  const i = Math.floor(Math.random() * NOTIFICATION_COPY.length);
  return NOTIFICATION_COPY[i] ?? NOTIFICATION_COPY[0]!;
}
