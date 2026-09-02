export interface GraphPoint {
  unitId: string;
  name: string;
  areaId: string;
  /** 1–10 */
  importance: number;
  /** 1–10 */
  satisfaction: number;
  /** 0–1, normalized trailing effort (ADR-0005 §3) */
  effort: number;
  /** ADR-0003 §2: excluded units still plot, rendered outlined. */
  includeInScoring: boolean;
}

export interface GraphSnapshot {
  id: string;
  /** Short human label for the scrubber, e.g. "Feb 2026" */
  label: string;
  /** `YYYY-MM` of `taken_at`. The month review needs to find the
   *  snapshot belonging to *its* month, and parsing the display label
   *  back into a date would break the first time one falls back to
   *  "Jul 16" because a month held two. */
  month: string;
  /**
   * Which instrument produced this snapshot's satisfaction (ADR-0022,
   * `formula_version` ≥ 4 is `"rated"`).
   *
   * The two are not comparable on the x-axis: `"ranked"` forced the same
   * 1–10 spread onto every snapshot, so a bubble's x said only where the
   * unit stood against its siblings, never how satisfying it actually
   * was. Movement *across* the boundary is an artefact of the change,
   * not of the life — the graph says so rather than pretending
   * otherwise.
   */
  satisfactionScale: "ranked" | "rated";
  points: GraphPoint[];
}

export type GraphMode = "now" | "compare" | "playback";
