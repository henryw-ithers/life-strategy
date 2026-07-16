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
  points: GraphPoint[];
}

export type GraphMode = "now" | "compare" | "playback";
