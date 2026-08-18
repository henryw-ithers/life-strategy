/**
 * The layout walk behind cross-section dragging on the daily checklist
 * (ADR-0024 §3) — the pure half.
 *
 * Free of React Native imports on purpose, so it can be tested off
 * device (root AGENTS.md, the same rule the scoring package follows).
 * That matters more here than usual: a long-press-armed pan is not
 * reproducible with synthetic events, so this is the only level at
 * which the maths can be checked — and its failure mode is a row
 * silently landing in the wrong part of the day and being written
 * there.
 *
 * The model is a **list of lists**: one array of row ids per section.
 * Both placement and drop resolution walk the same structure, so what
 * sits under the finger and what gets committed cannot disagree.
 *
 * `gap` is passed in rather than imported, since the token module
 * reaches into React Native for its types.
 */

export interface ChecklistMetrics {
  /** Per section, including the air that separates it from the slot
   *  above — sections are uniform in the app, but not by assumption. */
  headerHeights: number[];
  rowHeight: number;
  gap: number;
}

/** Y of a row, or of the end of the list when the id is not present. */
export function topOfRow(
  sections: readonly (readonly string[])[],
  m: ChecklistMetrics,
  id: string,
): number {
  "worklet";
  let y = 0;
  for (let s = 0; s < sections.length; s++) {
    y += (m.headerHeights[s] ?? 0) + m.gap;
    const rows = sections[s] ?? [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] === id) return y;
      y += m.rowHeight + m.gap;
    }
  }
  return y;
}

/** Y of a section's header, by the same walk. */
export function topOfHeader(
  sections: readonly (readonly string[])[],
  m: ChecklistMetrics,
  index: number,
): number {
  "worklet";
  let y = 0;
  for (let s = 0; s < sections.length; s++) {
    if (s === index) return y;
    y += (m.headerHeights[s] ?? 0) + m.gap;
    y += (sections[s]?.length ?? 0) * (m.rowHeight + m.gap);
  }
  return y;
}

/**
 * Which (section, index) an in-flight row's top edge is nearest.
 *
 * Every gap is a candidate — before the first row of a section, between
 * any two, and after the last — so **an empty section is a landing
 * place in its own right**. That is the case a row-relative drag cannot
 * express, and the reason this exists: "do this in the afternoon"
 * matters most when the afternoon is empty.
 *
 * Nearest-slot rather than a threshold walk, so the row commits to a
 * new home once it has travelled half a slot, and clamping at both ends
 * is free.
 */
export function locate(
  sections: readonly (readonly string[])[],
  m: ChecklistMetrics,
  y: number,
): { section: number; index: number } {
  "worklet";
  let cursor = 0;
  let best = { section: 0, index: 0 };
  let bestDist = Number.MAX_SAFE_INTEGER;
  for (let s = 0; s < sections.length; s++) {
    cursor += (m.headerHeights[s] ?? 0) + m.gap;
    const rows = sections[s] ?? [];
    for (let i = 0; i <= rows.length; i++) {
      const slotY = cursor + i * (m.rowHeight + m.gap);
      const dist = Math.abs(slotY - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { section: s, index: i };
      }
    }
    cursor += rows.length * (m.rowHeight + m.gap);
  }
  return best;
}

/**
 * Move a row to a new place, returning a fresh structure.
 *
 * Returns the input untouched when the target resolves to where the row
 * already is — including the index one past itself in its own section,
 * which is the same gap seen from the other side. Without that, a drag
 * would rewrite the layout every frame and tick a haptic each time.
 */
export function moveRow(
  sections: readonly (readonly string[])[],
  id: string,
  target: { section: number; index: number },
): string[][] | null {
  "worklet";
  let fromS = -1;
  let fromI = -1;
  for (let s = 0; s < sections.length; s++) {
    const i = (sections[s] ?? []).indexOf(id);
    if (i >= 0) {
      fromS = s;
      fromI = i;
      break;
    }
  }
  if (fromS < 0) return null;
  if (
    target.section === fromS &&
    (target.index === fromI || target.index === fromI + 1)
  ) {
    return null;
  }

  const next = sections.map((rows) => [...rows]);
  next[fromS]!.splice(fromI, 1);
  const insertAt =
    target.section === fromS && target.index > fromI
      ? target.index - 1
      : target.index;
  next[target.section]!.splice(insertAt, 0, id);
  return next;
}
