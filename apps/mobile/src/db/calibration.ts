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
  meetsColdStartGate,
  weekStart,
  type ContentmentSample,
  type DivergenceStats,
} from "@glide/scoring";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { loadWeekGrade } from "./grades";
import { calibrationSuggestion, contentmentCheckin, dayGrade } from "./schema";
import { currentLocalDate } from "../lib/calendar";

const ROLLING_WINDOW_WEEKS = 12;

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
 * Loads the current calibration picture: the cold-start gate, and the
 * divergence between weekly grades and weekly check-ins once it passes.
 *
 * **It proposes nothing, as of formula v8 (ADR-0028 §4).** ADR-0008's
 * one automatic suggestion moved `GAP_COEFFICIENT` — the strength of
 * the satisfaction-gap boost — up or down when grades ran persistently
 * higher or lower than the weeks felt. ADR-0028 §1 removed that term
 * from the formula, so the lever it pulled no longer exists, and a
 * suggestion that writes a setting nothing reads is worse than none.
 *
 * The measurement is the part worth keeping and it is untouched: the
 * gate, the mean divergence, and the rank agreement are all still
 * computed and still shown. What the app cannot currently do is offer
 * to *act* on them. The obvious candidate lever is the 80/20 band
 * split itself — but moving that is a formula change with an ADR's
 * worth of consequences, not a slider, so §4 leaves it open rather
 * than repointing the automation at it.
 *
 * Existing rows are left alone. Suggestions already stored stay
 * readable in the history list, and `resolveSuggestion` still records
 * a decision on them; it simply no longer applies a `gapCoefficient`.
 */
export async function loadCalibrationState(): Promise<CalibrationState> {
  const [samples, grades, suggestions] = await Promise.all([
    loadContentmentSamples(),
    loadRecentWeeklyGrades(ROLLING_WINDOW_WEEKS),
    db.select().from(calibrationSuggestion).orderBy(desc(calibrationSuggestion.createdAt)),
  ]);

  const gate = meetsColdStartGate(samples);
  const divergence = gate ? computeDivergence(grades, samples) : null;

  return { gate, divergence, suggestions };
}

/**
 * Records the user's answer to a suggestion. ADR-0008 §1's rule — "every
 * change applies only on an explicit yes" — is unchanged and now
 * vacuous: nothing generates suggestions since ADR-0028 §4, and the
 * leftover rows have no change left to apply. Dismissed suggestions are
 * never regenerated or re-surfaced automatically.
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

  // Nothing to apply. Every suggestion the app has ever written is a
  // `gapCoefficient` one, and formula v8 retired that constant
  // (ADR-0028 §1) — accepting a leftover row records the user's answer
  // and changes no arithmetic. When calibration gets a lever again,
  // this is where applying it goes.
}
