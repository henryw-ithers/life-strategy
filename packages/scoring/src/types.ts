export interface UnitRating {
  unitId: string;
  /** 1–10 — an absolute rating or a rank-derived score (`rankToScore`).
   *  Since v8 this is the **only** input to weight derivation. */
  importance: number;
  /**
   * 1–10, rated directly (ADR-0022).
   *
   * Optional, and **not read by `deriveWeights`** since formula v8
   * (ADR-0028 §1). It stays on the type because a diagnostic entry
   * genuinely carries both numbers — the `rating` table, the portfolio
   * graph's x-axis and `unitProfile` all want it — and dropping it here
   * would make callers assemble two shapes for one row. Nothing that
   * derives a weight will look at it.
   */
  satisfaction?: number;
}

export interface DerivedWeight {
  unitId: string;
  /** The flattened rank score: 1 + (WEIGHT_SPREAD − 1)(importance − 1)/9 */
  raw: number;
  /** exact normalized share of DAILY_BUDGET before rounding */
  exact: number;
  /** integer share; all weights sum to exactly DAILY_BUDGET */
  weight: number;
}
