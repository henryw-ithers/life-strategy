/**
 * Contentment calibration (ADR-0008): weekly check-ins compared
 * against weekly grades over a rolling ~12-week window. Never a push
 * — everything here is computed on visit, the way `finalizePastDays`
 * (db/today.ts) lazily settles state on load rather than a background
 * job.
 */
import {
  addDays,
  computeDivergence,
  GAP_COEFFICIENT,
  meetsColdStartGate,
  weekStart,
  type ContentmentSample,
  type DivergenceStats,
} from "@life-strategy/scoring";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { loadWeekGrade } from "./grades";
import { calibrationSuggestion, contentmentCheckin, dayGrade } from "./schema";
import { getGapCoefficientOverride, setGapCoefficientOverride } from "./settings";
import { currentLocalDate } from "./today";

const ROLLING_WINDOW_WEEKS = 12;
/** Below this, don't bother proposing a change (ADR-0008 §5: only
 *  meaningful divergence is worth a suggestion). */
const SUGGESTION_THRESHOLD = 10;
const SUGGESTION_STEP = 0.1;
const GAP_COEFFICIENT_MIN = 0;
const GAP_COEFFICIENT_MAX = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function getCheckinScore(week: string): Promise<number | null> {
  const [row] = await db
    .select()
    .from(contentmentCheckin)
    .where(eq(contentmentCheckin.weekStartDate, week));
  return row?.score ?? null;
}

export interface CheckinStatus {
  weekStart: string;
  existingScore: number | null;
  label: "this" | "last";
}

/**
 * The one week to show a check-in card for. A missed week stays
 * fillable through the following week (ADR-0008 §3) — prioritize an
 * unanswered previous week (about to lapse) over a fresh current week,
 * so it actually gets a chance before it lapses quietly. Otherwise
 * shows the current week, editable if already answered.
 */
export async function loadCheckinStatus(today: string): Promise<CheckinStatus> {
  const thisWeek = weekStart(today);
  const lastWeek = addDays(thisWeek, -7);
  const [thisScore, lastScore] = await Promise.all([
    getCheckinScore(thisWeek),
    getCheckinScore(lastWeek),
  ]);
  // Last week unanswered — surface it regardless of this week's state;
  // it's the one about to lapse. Otherwise default to this week,
  // editable if it already has an answer.
  if (lastScore === null) {
    return { weekStart: lastWeek, existingScore: null, label: "last" };
  }
  return { weekStart: thisWeek, existingScore: thisScore, label: "this" };
}

export async function submitCheckin(week: string, score: number): Promise<void> {
  const [existing] = await db
    .select()
    .from(contentmentCheckin)
    .where(eq(contentmentCheckin.weekStartDate, week));
  if (existing) {
    await db
      .update(contentmentCheckin)
      .set({ score })
      .where(eq(contentmentCheckin.weekStartDate, week));
  } else {
    await db
      .insert(contentmentCheckin)
      .values({ id: Crypto.randomUUID(), weekStartDate: week, score });
  }
}

/** One averaged sample per week: that week's check-in plus any
 *  special-day ratings falling in it ("bonus ground truth," ADR-0008
 *  §3) — special days already store a 1–10 rating (ADR-0004 §3). */
export async function loadContentmentSamples(): Promise<ContentmentSample[]> {
  const [checkins, specialDays] = await Promise.all([
    db.select().from(contentmentCheckin),
    db
      .select()
      .from(dayGrade)
      .where(and(eq(dayGrade.kind, "special"), isNotNull(dayGrade.satisfactionRating))),
  ]);

  const byWeek = new Map<string, number[]>();
  for (const c of checkins) {
    byWeek.set(c.weekStartDate, [...(byWeek.get(c.weekStartDate) ?? []), c.score]);
  }
  for (const d of specialDays) {
    const week = weekStart(d.localDate);
    byWeek.set(week, [...(byWeek.get(week) ?? []), d.satisfactionRating!]);
  }

  return [...byWeek.entries()].map(([week, scores]) => ({
    weekStart: week,
    score: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));
}

async function loadRecentWeeklyGrades(
  weeks: number,
): Promise<{ weekStart: string; grade: number }[]> {
  const currentWeek = weekStart(currentLocalDate());
  const results = await Promise.all(
    Array.from({ length: weeks }, async (_, i) => {
      const week = addDays(currentWeek, -7 * i);
      const score = await loadWeekGrade(week);
      return score.base !== null ? { weekStart: week, grade: score.base } : null;
    }),
  );
  return results.filter((r): r is { weekStart: string; grade: number } => r !== null);
}

export interface CalibrationSuggestionRow {
  id: string;
  insightText: string;
  proposedChange: string;
  status: "proposed" | "accepted" | "dismissed";
  resolvedAt: string | null;
}

export interface CalibrationState {
  gate: boolean;
  divergence: DivergenceStats | null;
  suggestions: CalibrationSuggestionRow[];
}

/**
 * Loads the current calibration picture, proposing a fresh
 * `gapCoefficient` suggestion when the gate has passed, the divergence
 * is meaningful, and nothing of that type is already pending — never
 * more than one open suggestion of the same kind at a time.
 */
export async function loadCalibrationState(): Promise<CalibrationState> {
  const [samples, grades, existing] = await Promise.all([
    loadContentmentSamples(),
    loadRecentWeeklyGrades(ROLLING_WINDOW_WEEKS),
    db.select().from(calibrationSuggestion).orderBy(desc(calibrationSuggestion.createdAt)),
  ]);

  const gate = meetsColdStartGate(samples);
  const divergence = gate ? computeDivergence(grades, samples) : null;

  const hasPendingGapSuggestion = existing.some((s) => {
    if (s.status !== "proposed") return false;
    try {
      return (JSON.parse(s.proposedChange) as { type: string }).type === "gapCoefficient";
    } catch {
      return false;
    }
  });

  if (
    divergence &&
    Math.abs(divergence.meanDivergence) > SUGGESTION_THRESHOLD &&
    !hasPendingGapSuggestion
  ) {
    const currentG = (await getGapCoefficientOverride()) ?? GAP_COEFFICIENT;
    const proposedG = clamp(
      currentG + (divergence.direction === "higher" ? -SUGGESTION_STEP : SUGGESTION_STEP),
      GAP_COEFFICIENT_MIN,
      GAP_COEFFICIENT_MAX,
    );
    const insightText =
      divergence.direction === "higher"
        ? "Your grades have been running higher than your weeks felt."
        : "Your grades have been running lower than your weeks felt.";
    await db.insert(calibrationSuggestion).values({
      id: Crypto.randomUUID(),
      insightText,
      proposedChange: JSON.stringify({ type: "gapCoefficient", value: proposedG }),
      status: "proposed",
    });
  }

  const suggestions = await db
    .select()
    .from(calibrationSuggestion)
    .orderBy(desc(calibrationSuggestion.createdAt));

  return { gate, divergence, suggestions };
}

/**
 * Resolves a suggestion. Accepting applies its change only now, on
 * this explicit action (ADR-0008 §1: "every change applies only on an
 * explicit yes") — dismissing just records the decision; dismissed
 * suggestions are never regenerated or re-surfaced automatically.
 */
export async function resolveSuggestion(
  id: string,
  status: "accepted" | "dismissed",
): Promise<void> {
  const [row] = await db
    .select()
    .from(calibrationSuggestion)
    .where(eq(calibrationSuggestion.id, id));
  if (!row) return;

  await db
    .update(calibrationSuggestion)
    .set({ status, resolvedAt: new Date().toISOString() })
    .where(eq(calibrationSuggestion.id, id));

  if (status === "accepted") {
    try {
      const change = JSON.parse(row.proposedChange) as { type: string; value: number };
      if (change.type === "gapCoefficient") {
        await setGapCoefficientOverride(change.value);
      }
    } catch {
      // Malformed proposed_change — nothing to apply.
    }
  }
}
