export interface UnitRating {
  unitId: string;
  /** 1–10 — an absolute rating or a rank-derived score (`rankToScore`) */
  importance: number;
  /** 1–10 — an absolute rating or a rank-derived score (`rankToScore`) */
  satisfaction: number;
}

export interface DerivedWeight {
  unitId: string;
  /** importance + g × max(0, importance − satisfaction) */
  raw: number;
  /** exact normalized share of DAILY_BUDGET before rounding */
  exact: number;
  /** integer share; all weights sum to exactly DAILY_BUDGET */
  weight: number;
}
