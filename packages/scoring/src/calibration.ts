/**
 * Contentment calibration (ADR-0008): compares weekly grades against
 * felt contentment over a rolling window, using simple, explainable
 * statistics — no opaque models. The ADR specifies the gate and the
 * concepts ("direction and size of the divergence, rank agreement");
 * this module is the concrete, tested implementation of both.
 */

/** ≥8 data points spanning ≥6 distinct weeks (ADR-0008 §2, cold start). */
const COLD_START_MIN_POINTS = 8;
const COLD_START_MIN_WEEKS = 6;

/** Below this, treat grade and contentment as aligned rather than
 *  diverging — on a 0–100 scale, a small gap isn't worth surfacing. */
const DIVERGENCE_THRESHOLD = 10;

export function meetsColdStartGate(samples: { weekStart: string }[]): boolean {
  if (samples.length < COLD_START_MIN_POINTS) return false;
  const distinctWeeks = new Set(samples.map((s) => s.weekStart)).size;
  return distinctWeeks >= COLD_START_MIN_WEEKS;
}

export interface WeeklyGradeSample {
  weekStart: string;
  /** aggregateGrade's `base`, 0–100 (may exceed 100). */
  grade: number;
}

export interface ContentmentSample {
  weekStart: string;
  /** 1–10. */
  score: number;
}

export interface DivergenceStats {
  weekCount: number;
  /** grade − score×10, averaged; positive = grades running higher
   *  than the weeks felt. */
  meanDivergence: number;
  direction: "higher" | "lower" | "aligned";
  /** −1..1: (concordant − discordant) / comparable pairs, across every
   *  week-pair — a plain concordance count, not a named statistic. */
  rankAgreement: number;
}

/**
 * Pairs weeks present in both inputs and computes the divergence.
 * `null` when there's nothing to pair — the caller is responsible for
 * windowing to the rolling ~12-week period first.
 */
export function computeDivergence(
  grades: readonly WeeklyGradeSample[],
  contentment: readonly ContentmentSample[],
): DivergenceStats | null {
  const contentmentByWeek = new Map(contentment.map((c) => [c.weekStart, c.score]));
  const paired = grades
    .filter((g) => contentmentByWeek.has(g.weekStart))
    .map((g) => ({
      weekStart: g.weekStart,
      grade: g.grade,
      score: contentmentByWeek.get(g.weekStart)!,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  if (paired.length === 0) return null;

  const diffs = paired.map((p) => p.grade - p.score * 10);
  const meanDivergence = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const direction: DivergenceStats["direction"] =
    meanDivergence > DIVERGENCE_THRESHOLD
      ? "higher"
      : meanDivergence < -DIVERGENCE_THRESHOLD
        ? "lower"
        : "aligned";

  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < paired.length; i++) {
    for (let j = i + 1; j < paired.length; j++) {
      const gradeDelta = paired[j]!.grade - paired[i]!.grade;
      const scoreDelta = paired[j]!.score - paired[i]!.score;
      if (gradeDelta === 0 || scoreDelta === 0) continue;
      if (Math.sign(gradeDelta) === Math.sign(scoreDelta)) concordant++;
      else discordant++;
    }
  }
  const comparable = concordant + discordant;
  const rankAgreement = comparable > 0 ? (concordant - discordant) / comparable : 0;

  return { weekCount: paired.length, meanDivergence, direction, rankAgreement };
}
