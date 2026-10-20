export interface DerivedWeight {
  unitId: string;
  /** Before scaling: the tier base × its place in the tier. */
  raw: number;
  /** exact normalized share of DAILY_BUDGET before rounding */
  exact: number;
  /** integer share; all weights sum to exactly DAILY_BUDGET */
  weight: number;
}
