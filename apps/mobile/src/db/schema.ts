/**
 * Drizzle schema per ADR-0002 (with amendments from ADR-0003..0009).
 *
 * Conventions (ADR-0002): text UUID primary keys, ISO-8601 UTC
 * timestamps, soft deletes via archived_at, calendar bucketing via
 * local_date TEXT 'YYYY-MM-DD'. History never restates: values that
 * affect grades are denormalized at the moment they're earned.
 */
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
};

// ── Taxonomy ────────────────────────────────────────────────────────

export const lifeArea = sqliteTable("life_area", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export const lifeUnit = sqliteTable("life_unit", {
  id: text("id").primaryKey(),
  areaId: text("area_id")
    .notNull()
    .references(() => lifeArea.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isCustom: integer("is_custom", { mode: "boolean" }).notNull().default(false),
  /** ADR-0003 §2: excluded units stay in the diagnostic but hold no points. */
  includeInScoring: integer("include_in_scoring", { mode: "boolean" })
    .notNull()
    .default(true),
  /**
   * Why a person does this (ADR-0025 §1). `communal` units — the three
   * Relationships units — are **dimensions, not containers**: they hold
   * no tasks of their own, and anything may tag them instead.
   *
   * It exists so a future reader sees *why* three units behave
   * differently, rather than finding bare special-casing. There is
   * deliberately no task-level override (ADR-0025 §14) and no
   * `autotelic` value — that distinction is editorial only (§13).
   */
  motivationKind: text("motivation_kind", {
    enum: ["instrumental", "communal"],
  })
    .notNull()
    .default("instrumental"),
  /**
   * The commitment this unit sits inside (ADR-0029 §1). Null for all 18
   * life units and for a commitment itself; set on a **sub-commitment**
   * — School → COMP2521.
   *
   * Two levels only: a sub-commitment may not itself be a parent. That
   * is enforced at the write seam rather than by the schema, which
   * cannot express it.
   *
   * Sub-commitments **price nothing**. ADR-0032 §3 divides the band
   * across a commitment's eligible *tasks*, so this column groups and
   * labels; it never takes a cut. Treat it the way ADR-0021 treats
   * `area_id` — a soft attribute that may decide colour and grouping
   * and never a stored score.
   */
  parentUnitId: text("parent_unit_id").references(
    (): AnySQLiteColumn => lifeUnit.id,
  ),
  /**
   * A **commitment's** relative share of the commitment band
   * (ADR-0032 §3) — School 50, Work 30, Basketball 20. Null on the 18
   * life units, on sub-commitments, and on any unit that is not a
   * commitment.
   *
   * Relative, not a percentage: shares are normalised at read time
   * across the commitments that actually hold work on the day being
   * scored, so a Monday with only School gives School the whole band
   * rather than leaving the others' shares dead. They are deliberately
   * **not** required to sum to anything.
   *
   * The band's own size is a single number and lives in `app_setting`
   * under `commitment.band` — see `db/settings.ts`.
   */
  commitmentShare: real("commitment_share"),
  archivedAt: text("archived_at"),
  ...timestamps,
});

// ── Diagnostic (ADR-0005) ───────────────────────────────────────────

export const snapshot = sqliteTable("snapshot", {
  id: text("id").primaryKey(),
  takenAt: text("taken_at").notNull(),
  formulaVersion: integer("formula_version").notNull(),
  note: text("note"),
  ...timestamps,
});

export const rating = sqliteTable(
  "rating",
  {
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => snapshot.id),
    unitId: text("unit_id")
      .notNull()
      .references(() => lifeUnit.id),
    /** Rank-derived score (rankToScore), continuous 1–10 — not
     *  necessarily an integer (ADR-0003 amendment: ranked diagnostic). */
    importance: real("importance").notNull(),
    satisfaction: real("satisfaction").notNull(),
    /** Trailing-28-day effort frozen at snapshot time (ADR-0005 §3). */
    effortPoints: real("effort_points"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.snapshotId, t.unitId] })],
);

export const unitWeight = sqliteTable(
  "unit_weight",
  {
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => snapshot.id),
    unitId: text("unit_id")
      .notNull()
      .references(() => lifeUnit.id),
    derived: real("derived").notNull(),
    /** Effective weight = override ?? derived (ADR-0002 §3). */
    override: real("override"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.snapshotId, t.unitId] })],
);

// ── Goals (ADR-0007) ────────────────────────────────────────────────

export const goal = sqliteTable("goal", {
  id: text("id").primaryKey(),
  unitId: text("unit_id")
    .notNull()
    .references(() => lifeUnit.id),
  title: text("title").notNull(),
  description: text("description"),
  /** The number to reach. Meaning depends on `metricKind` (ADR-0015 §1). */
  targetValue: real("target_value"),
  /**
   * ADR-0015 §1. **Null means no metric** — a plain goal, exactly as
   * goals worked before, which is why every existing goal stays valid.
   *
   * `cumulative` sums entries toward a total ("24 books").
   * `target` logs readings and is met when one reaches the target
   * ("bench 225", "weigh 80kg"). Direction is *inferred* from the
   * earliest progress entry against the target, so gaining and losing
   * share one kind and the user is never asked which way they go.
   * `habit` is a run of consecutive days and has **no target at all**
   * (decided 2026-08-16): a habit is meant to be permanent, so it
   * never completes. Its rungs are day counts in `milestone`, and
   * `target_value` stays null for it.
   */
  metricKind: text("metric_kind", { enum: ["cumulative", "target", "habit"] }),
  /** Free-text label: "books", "lb", "kg", "hours". The app does not
   *  know what a kilogram is and does not need to. */
  metricUnit: text("metric_unit"),
  /**
   * Rough deadline at **month granularity**, `'YYYY-MM'` (ADR-0015 §4).
   * A month picker, never a date picker and never a time.
   *
   * When it passes, **nothing happens** — no "overdue", no colour, no
   * badge, no prompt, no auto-pause. A marker that appeared only when
   * you were behind would be conditioning on a shortfall, which
   * ADR-0008 forbids. It surfaces in the monthly review as part of the
   * normal pass over active goals, never as a date-triggered alert.
   */
  targetDate: text("target_date"),
  /**
   * One task whose completion increments a `cumulative` goal by one
   * (ADR-0015 §2). Explicitly nominated, never "all tasks under this
   * goal" — that would make progress a silent function of the task
   * list, so editing tasks would rewrite goal history. Nulls when the
   * task archives; entries already written stay.
   */
  autocountTaskId: text("autocount_task_id").references(
    (): AnySQLiteColumn => task.id,
  ),
  status: text("status", {
    enum: ["active", "paused", "revised", "abandoned", "completed"],
  })
    .notNull()
    .default("active"),
  statusChangedAt: text("status_changed_at"),
  linkedFromGoalId: text("linked_from_goal_id").references(
    (): AnySQLiteColumn => goal.id,
  ),
  linkKind: text("link_kind", { enum: ["revision", "follow_up"] }),
  ...timestamps,
});

export const milestone = sqliteTable("milestone", {
  id: text("id").primaryKey(),
  goalId: text("goal_id")
    .notNull()
    .references(() => goal.id),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull(),
  status: text("status", { enum: ["pending", "current", "completed"] })
    .notNull()
    .default("pending"),
  /** This rung's own threshold (ADR-0015 §5) — vision.md's bench
   *  example is 135 → 185 → 225, and without this the rungs are just
   *  labels. Passing it *prompts* to advance; nothing auto-completes. */
  targetValue: real("target_value"),
  /**
   * When it actually happened, `'YYYY-MM-DD'` (ADR-0015 §5).
   * Milestones are often noticed late ("I passed 185 a few weeks
   * ago"), and recording one in the wrong month would put a false
   * entry in the log of a life. Written together with the minor
   * achievement's `achieved_at`, so look-back views agree.
   */
  completedOn: text("completed_on"),
  ...timestamps,
});

/**
 * One reading toward a metric goal (ADR-0015 §2).
 *
 * Deletable, like journal entries. Auto-counted rows (`source`
 * `'task'`) are ordinary entries — visible in the list and
 * individually removable, so nothing ever accrues invisibly.
 *
 * Progress is **not** a scoring event (ADR-0015 §7): no points, no
 * denominator, no effect on any day's number. It does not feed effort
 * either — a progress entry measures a thing done, often days later,
 * and counting it would double-count the session it describes.
 */
export const goalProgress = sqliteTable("goal_progress", {
  id: text("id").primaryKey(),
  goalId: text("goal_id")
    .notNull()
    .references(() => goal.id),
  localDate: text("local_date").notNull(),
  value: real("value").notNull(),
  note: text("note"),
  source: text("source", { enum: ["manual", "task"] })
    .notNull()
    .default("manual"),
  ...timestamps,
});

// ── Tasks (ADR-0003) ────────────────────────────────────────────────

export const task = sqliteTable("task", {
  id: text("id").primaryKey(),
  unitId: text("unit_id")
    .notNull()
    .references(() => lifeUnit.id),
  /** Nullable: habit tasks attach directly to their unit (ADR-0002 §1). */
  goalId: text("goal_id").references(() => goal.id),
  title: text("title").notNull(),
  /**
   * What the task actually involves. Never scored.
   *
   * **No longer editable from the UI (2026-08-18)**: Henry's call —
   * "the task name speaks for itself" — and in real use the field was
   * a second thing to write for every task, on a surface whose whole
   * job is that capture stays cheap. The column stays, and existing
   * text is preserved on save rather than cleared, because hiding a
   * field destroys nothing while dropping the column would delete
   * what people already wrote.
   */
  description: text("description"),
  /** Times per week: 1–7 (7 = daily); 0 = once every two weeks. */
  timesPerWeek: integer("times_per_week").notNull().default(7),
  /**
   * Preferred weekdays as ISO numbers, e.g. `"1,3,5"` (ADR-0024).
   * Null = flexible, "any N days". Picking days sets `timesPerWeek`;
   * clearing them reverts to flexible — one mental model, so the two
   * settings can never contradict each other.
   */
  plannedWeekdays: text("planned_weekdays"),
  /**
   * Where in the day this sits (ADR-0024 §1). Null renders as
   * *Anytime*, which is a first-class value and the default — most of
   * a plan is deliberately flexible.
   *
   * There is no clock time and no time column, anywhere, on purpose:
   * ADR-0024 §1, reaffirmed under challenge in ADR-0025 §7. Nothing in
   * the app consumes a time, so one would buy ordering that
   * `partOfDay` already provides.
   */
  partOfDay: text("part_of_day", {
    enum: ["morning", "afternoon", "evening"],
  }),
  /**
   * Where this row sits on the daily checklist, within its part of the
   * day (added 2026-08-18). Null sorts last, so tasks that predate the
   * column keep their derived order until something is dragged.
   *
   * **Persistent, not per-day** (Henry, 2026-08-18): "if I put sunlight
   * and supplements at the start of my tasks I want it to stay there."
   * So this belongs to the task rather than to a date — yesterday's
   * arrangement follows you into today.
   *
   * Deliberately separate from `rank_in_unit`, which *prices* the task
   * (ADR-0003 §5). Two orders doing two jobs: rank says what a task is
   * worth, this says where you like to see it.
   */
  dayOrder: integer("day_order"),
  /**
   * Which half of the fortnight a **fortnightly** task belongs to:
   * 0 = the week the fortnight opens, 1 = the following week (added
   * 2026-08-18). Ignored unless `times_per_week` is 0 and weekdays
   * are pinned.
   *
   * "Every other Tuesday" needs to say *which* Tuesday, and the date
   * alone cannot: fortnights are anchored to epoch-even weeks so the
   * boundary stays stable, which leaves the choice to the task. This
   * is what the "switch weeks" control flips.
   *
   * Presentation only, like every other planning field — it decides
   * which day a row appears on and never what it is worth.
   */
  fortnightOffset: integer("fortnight_offset").notNull().default(0),
  /**
   * Non-null marks this task as a **one-off**: done once, then archived.
   *
   * It doubles as the discriminator because a one-off always has a size
   * — that is how it is priced, at `SIZE_RATE × the unit's variable day
   * rate`, the same arithmetic a logged activity uses. Null means an
   * ordinary recurring task and `times_per_week` governs instead.
   *
   * One-offs are deliberately kept **out of `bandPointValues`**. Letting
   * one into the recurring allocation would make every other non-daily
   * task in its unit drop in value while the errand existed and jump
   * back when it was ticked — the same instability ADR-0027's amendment
   * removed from the variable band, reintroduced across time. The 20
   * point cap in `computeDayScore` is what keeps generous one-off
   * pricing from inflating a day.
   */
  oneOffSize: text("one_off_size", { enum: ["quick", "normal", "big"] }),
  /** The day it was planned for. Null is "no particular day". It never
   *  moves: rolling forward is a display rule, not a write, so the
   *  original intention survives being late. */
  oneOffDate: text("one_off_date"),
  /** Optional deadline. Informational only — it is never a penalty and
   *  never an alarm colour (PRODUCT.md rules out loss-aversion tricks);
   *  it exists so that rolling forward has a visible edge. */
  oneOffDue: text("one_off_due"),
  pointValue: integer("point_value").notNull(),
  /** Beli-style rank; point values derive from rank shares (ADR-0003 §5). */
  rankInUnit: integer("rank_in_unit").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  archivedAt: text("archived_at"),
  ...timestamps,
});

/**
 * A task's scoring membership, one row per unit it serves (ADR-0019).
 *
 * Every task has at least one row here — the one matching `task.unitId`,
 * its home unit for grouping. A task that serves more than one unit
 * takes a rank slot in each and earns each unit's share, so completing
 * it once credits all of them. Each unit still divides only its own
 * weight across its own ranked tasks, so weights keep summing to 100;
 * the day's denominator counts the task in every unit too, so a shared
 * task inflates neither side of the grade.
 *
 * `task.point_value` stays as the sum of these rows — a cache, so the
 * scoring engine and `task_completion` keep taking one number per task.
 */
export const taskUnit = sqliteTable(
  "task_unit",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => task.id),
    unitId: text("unit_id")
      .notNull()
      .references(() => lifeUnit.id),
    /** Beli-style rank within this unit; point value derives from it. */
    rankInUnit: integer("rank_in_unit").notNull(),
    pointValue: integer("point_value").notNull(),
    /**
     * `scoring` is the ADR-0019 behaviour above — a rank slot that
     * earns the unit's share. `note` records that the task touches the
     * unit without taking a slot or earning anything: no rank, no
     * points, feeds effort and the log only (ADR-0025 §5).
     *
     * Deliberately general rather than communal-only. Plenty of things
     * touch a unit they should not earn from, and forcing every
     * mention through a scoring slot is what made the model feel wrong
     * for relationships in the first place.
     *
     * A `note` row still carries `rank_in_unit`/`point_value` columns
     * because the primary key and the table shape are shared; both are
     * written 0 and must be ignored by every consumer.
     */
    membership: text("membership", { enum: ["scoring", "note"] })
      .notNull()
      .default("scoring"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.taskId, t.unitId] })],
);

export const taskCompletion = sqliteTable("task_completion", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => task.id),
  localDate: text("local_date").notNull(),
  completedAt: text("completed_at").notNull(),
  /** Denormalized at completion time; past days never restate (ADR-0002). */
  pointsEarned: integer("points_earned").notNull(),
  ...timestamps,
});

/**
 * Which other units a completion counted toward (ADR-0025 §4).
 *
 * Tags are per-completion rather than fixed to the task: "study"
 * sometimes counts toward Friendship and sometimes doesn't, so a
 * persistent task-level tag would over-report. Added by press-and-hold
 * on the completion — never by a prompt, which would put a second
 * decision on the daily surface.
 *
 * **Units only, never named people** (ADR-0025 §4, an explicit
 * non-goal). This column can hold nothing but a `life_unit.id`. There
 * is no name field and no free text, and the UI asks *where does this
 * count* rather than *who were you with* — recording that an hour
 * counted toward Family is a fact about the user's own life, while
 * naming who was there would create a record about someone who never
 * agreed to be in this database. The app's one-sentence privacy story
 * holds precisely because everything in it is self-reported about the
 * self.
 */
export const taskCompletionTag = sqliteTable(
  "task_completion_tag",
  {
    completionId: text("completion_id")
      .notNull()
      .references(() => taskCompletion.id),
    unitId: text("unit_id")
      .notNull()
      .references(() => lifeUnit.id),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.completionId, t.unitId] })],
);

/**
 * A run of a flexible task placed on a specific date (ADR-0024 §1,
 * phase 3) — typically during the weekly planning pass.
 *
 * Placements are **intentions, not obligations**: completions fulfill
 * them when the dates match, and an unfulfilled placement simply
 * lapses. It is not surfaced, not counted, and never mentioned again.
 * No adherence statistic is computed from this table — ADR-0024 §2
 * makes that an invariant, and this is the table that would tempt
 * someone to break it.
 */
export const plannedOccurrence = sqliteTable("planned_occurrence", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => task.id),
  localDate: text("local_date").notNull(),
  partOfDay: text("part_of_day", {
    enum: ["morning", "afternoon", "evening"],
  }),
  /** Archived rather than deleted when its task archives (ADR-0024). */
  archivedAt: text("archived_at"),
  ...timestamps,
});

// ── Days, grades, and the life log (ADR-0004) ──────────────────────

export const dayGrade = sqliteTable("day_grade", {
  localDate: text("local_date").primaryKey(),
  kind: text("kind", { enum: ["normal", "rest", "special"] })
    .notNull()
    .default("normal"),
  pointsEarned: integer("points_earned").notNull().default(0),
  pointsPossible: integer("points_possible").notNull().default(0),
  /** Special days: grade = rating × 10 (ADR-0004 §3). */
  satisfactionRating: integer("satisfaction_rating"),
  title: text("title"),
  flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
  /** Stamped at the third rollover after the day ends (ADR-0004 §1). */
  finalizedAt: text("finalized_at"),
  /**
   * Which scoring formula produced `points_earned`/`points_possible`.
   * Null on rows written before this column existed — treat those as
   * "unknown era, do not compare." Mirrors `snapshot.formula_version`,
   * which has always recorded the same thing for weights.
   */
  formulaVersion: integer("formula_version"),
  /**
   * The plan as it stood on this day, JSON:
   * `[{ taskId, unitId, pointValue, timesPerWeek }]`.
   *
   * Re-deriving a past day needs the tasks *that day* had, not the
   * ones the plan has now — otherwise a task added last week gets
   * applied to a day last month, and a deleted one vanishes from days
   * it was part of. Without this, "recompute history" can only ever
   * mean "score old days as if today's plan had always been in
   * force," which is an approximation dressed as a correction.
   *
   * Written on every `cacheDayScore`, so the last touch before a day
   * settles is what sticks. Null for days that predate the column, and
   * for days never touched (which score zero regardless of the plan).
   */
  planSnapshot: text("plan_snapshot"),
  ...timestamps,
});

/** Append-only; adding never overwrites. Entries created after the
 *  edit window display a retroactive marker (derived, no column). */
export const journalEntry = sqliteTable("journal_entry", {
  id: text("id").primaryKey(),
  localDate: text("local_date").notNull(),
  body: text("body").notNull(),
  ...timestamps,
});

export const photo = sqliteTable("photo", {
  id: text("id").primaryKey(),
  localDate: text("local_date").notNull(),
  fileUri: text("file_uri").notNull(),
  caption: text("caption"),
  ...timestamps,
});

// ── Spontaneous activities (ADR-0009) ───────────────────────────────

export const activity = sqliteTable("activity", {
  id: text("id").primaryKey(),
  localDate: text("local_date").notNull(),
  title: text("title").notNull(),
  note: text("note"),
  /** Null size = creditless journal-style entry. */
  size: text("size", { enum: ["quick", "normal", "big"] }),
  flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const activityTag = sqliteTable(
  "activity_tag",
  {
    activityId: text("activity_id")
      .notNull()
      .references(() => activity.id),
    unitId: text("unit_id")
      .notNull()
      .references(() => lifeUnit.id),
    /** Denormalized at log time (ADR-0009 §2). Max 3 tags per activity. */
    pointsCredited: integer("points_credited").notNull().default(0),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.activityId, t.unitId] })],
);

// ── Achievements, check-ins, calibration (ADR-0007/0008) ────────────

export const achievement = sqliteTable("achievement", {
  id: text("id").primaryKey(),
  /**
   * **Nullable since 2026-08-18**, when goals became deletable. An
   * achievement is a record of something that happened, and PRODUCT.md
   * principle 5 puts it in the life log alongside journals and photos —
   * so deleting the goal that produced it nulls this and keeps the
   * achievement. `title_snapshot` already exists to make that survivable:
   * it was copied at completion precisely so later goal edits could not
   * rewrite history, and a deleted goal is the limiting case of an edit.
   */
  goalId: text("goal_id").references(() => goal.id),
  milestoneId: text("milestone_id").references(() => milestone.id),
  /** Copied at completion so later goal edits don't rewrite history. */
  titleSnapshot: text("title_snapshot").notNull(),
  achievedAt: text("achieved_at").notNull(),
  ...timestamps,
});

export const contentmentCheckin = sqliteTable("contentment_checkin", {
  id: text("id").primaryKey(),
  weekStartDate: text("week_start_date").notNull(),
  score: integer("score").notNull(),
  ...timestamps,
});

export const calibrationSuggestion = sqliteTable("calibration_suggestion", {
  id: text("id").primaryKey(),
  insightText: text("insight_text").notNull(),
  proposedChange: text("proposed_change").notNull(),
  /** Dismissed suggestions never re-surface automatically (ADR-0008 §1). */
  status: text("status", { enum: ["proposed", "accepted", "dismissed"] })
    .notNull()
    .default("proposed"),
  resolvedAt: text("resolved_at"),
  ...timestamps,
});

export const appSetting = sqliteTable("app_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  ...timestamps,
});
