/** The day's notes (ADR-0002): free text, addable after a grade
 *  settles, and editable and deletable since 2026-08-13. */
import { eq } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { currentLocalDate } from "../lib/calendar";
import { db } from "./client";
import { journalEntry } from "./schema";

/** Journal is append-only and exempt from the edit window (ADR-0002:
 *  entries after the window just display a retroactive marker). */
export async function addJournalEntry(date: string, body: string): Promise<void> {
  if (date > currentLocalDate()) throw new Error("Can't journal a future day.");
  await db.insert(journalEntry).values({
    id: Crypto.randomUUID(),
    localDate: date,
    body,
  });
}

/**
 * Rewrite a note in place.
 *
 * **Journal entries were append-only** (ADR-0002) on the grounds that
 * the log should be a faithful record. That was retired on 2026-08-13:
 * a typo you cannot fix is not fidelity, and the append-only rule had
 * no editing affordance to soften it — the day's record simply grew.
 *
 * Deliberately **not** gated on the edit window. Grades finalize;
 * memories don't (ADR-0002), and notes touch no score, so there is
 * nothing here that settling a day needs to protect.
 */
export async function updateJournalEntry(id: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    await deleteJournalEntry(id);
    return;
  }
  await db.update(journalEntry).set({ body: trimmed }).where(eq(journalEntry.id, id));
}

/** Remove a note. Hard delete: a journal entry has no downstream
 *  reader (see the ADR index's "nothing reads the life log back"), so
 *  there is nothing a soft delete would preserve. */
export async function deleteJournalEntry(id: string): Promise<void> {
  await db.delete(journalEntry).where(eq(journalEntry.id, id));
}
