/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: docs/content/notifications.md
 * Regenerate: npm run content:build
 *
 * Edits here are lost on the next build, and `npm run content:check`
 * fails the moment this file and its source disagree.
 */

export const NOTIFICATION_COPY: readonly string[] = [
  "Today's list is ready.",
  "Your day's checklist is waiting, whenever works.",
  "A few minutes for today's list.",
  "Today's checklist is there when you want it."
];

export function randomNotificationLine(): string {
  const i = Math.floor(Math.random() * NOTIFICATION_COPY.length);
  return NOTIFICATION_COPY[i] ?? NOTIFICATION_COPY[0]!;
}
