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
  /** Reserved for metric-linked goals (planned ADR-0015). */
  targetValue: real("target_value"),
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
  /** What the task actually involves — the products in the routine, what
   *  counts as done. Never scored: a title is a promise to yourself and
   *  this is where the fine print goes, not a progress mechanism. */
  description: text("description"),
  /** Times per week: 1–7 (7 = daily); 0 = once every two weeks. */
  timesPerWeek: integer("times_per_week").notNull().default(7),
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
  goalId: text("goal_id")
    .notNull()
    .references(() => goal.id),
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
