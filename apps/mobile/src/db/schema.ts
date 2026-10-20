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
   * The commitment this unit sits inside (ADR-0035 §1). Null for all 18
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
   * rather than leaving the others' shares dead. Since 2026-10-02 the
   * app writes them as whole percentages summing to 100
   * (`rebalanceShares`); the engine still reads them only relative to
   * one another, so older rows that sum to anything keep working.
   *
   * **Since formula v11 its value prices nothing**: each day's share
   * comes from that day (ADR-0044), or from `set_share`. The column
   * stays because a non-null value is what marks a unit as a
   * commitment (`isCommitmentUnit`).
   */
  commitmentShare: real("commitment_share"),
  /**
   * A share of the day you set for this commitment ("School at 60%"),
   * in percent, replacing the automatic one on every day it has work
   * (ADR-0044 §3). Null, the default, is automatic: the commitment's
   * time that day over the day's working hours.
   *
   * Since formula v11 this, not `commitment_share`, is what a user sets.
   * `commitment_share` stays as the column that marks a unit as a
   * commitment (`isCommitmentUnit`); its value no longer prices
   * anything, and neither does the old `commitment.band` setting.
   */
  setShare: real("set_share"),
  /**
   * Whether a commitment is split into sub-commitments (ADR-0035 §1 as
   * amended 2026-10-02). On, its work lives in its sub-commitments and
   * the commitment holds none directly; off, it holds its own work and
   * has no sub-commitments. Meaningful only on a commitment. A
   * commitment with live sub-commitments reads as on whatever this
   * says, so rows written before the column existed need no backfill.
   */
  usesSubCommitments: integer("uses_sub_commitments", { mode: "boolean" })
    .notNull()
    .default(false),
  /**
   * The unit's own colour, as a palette key (`theme/palette.ts`), or
   * null to use its area's (ADR-0043 §4). A key rather than hex so a
   * palette revision recolours every unit without a migration.
   * Presentation only, like `area_id`: never a weight, rank or score
   * (ADR-0021).
   */
  colour: text("colour"),
  /**
   * The unit's Priorities tier (ADR-0041): `top`, `important`,
   * `background` or `notNow`. Weights are derived from this and
   * `tier_order`, and nothing else. Null until the tiers are seeded
   * (Phase 5b) or set on Priorities (Phase 6). Meaningless on a
   * commitment, which is scored from its own share of the day.
   */
  tier: text("tier", { enum: ["top", "important", "background", "notNow"] }),
  /** The unit's place inside its tier, 0 first. */
  tierOrder: integer("tier_order"),
  archivedAt: text("archived_at"),
  ...timestamps,
});

// ── Diagnostic (ADR-0005)───────────────────────────────────────────

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
    /** The recommended weight when the snapshot was saved: since
     *  ADR-0041, its tier weight (`deriveTierWeights`). */
    derived: real("derived").notNull(),
    /** A weight you set, shown beside the recommended one. The latest
     *  snapshot's overrides are what score (`applyWeightOverrides`),
     *  and saving Priorities carries them forward. */
    override: real("override"),
    /** The unit's tier and place in it when the snapshot was saved
     *  (ADR-0041 action item 2). Null on snapshots from before tiers. */
    tier: text("tier", { enum: ["top", "important", "background", "notNow"] }),
    tierOrder: integer("tier_order"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.snapshotId, t.unitId] })],
);

// ── Goals (ADR-0007, ADR-0042) ──────────────────────────────────────

/**
 * A goal the app can count (ADR-0042 §1): times done, time spent,
 * points earned, or a streak. It belongs to one unit or commitment.
 *
 * Every goal made before formula 11 was erased by migration 0022
 * (ADR-0042 §6), with its conditions, milestones, progress entries and
 * achievements; their tables went with them.
 *
 * **A goal never grades a day** (ADR-0042 §4). Nothing in scoring
 * reads this table or the two below it.
 */
export const goal = sqliteTable("goal", {
  id: text("id").primaryKey(),
  /** The unit or commitment. A commitment's goal reads its
   *  sub-commitments too (EC-41). */
  unitId: text("unit_id")
    .notNull()
    .references(() => lifeUnit.id),
  title: text("title").notNull(),
  description: text("description"),
  /** `GoalKind` from `@glide/scoring`. */
  kind: text("kind", {
    enum: ["timesDone", "timeSpent", "pointsEarned", "streak"],
  }).notNull(),
  /**
   * Times, hours or points: always the number you set (ADR-0042 §1,
   * clarified 2026-10-17). Never filled from how many sessions are
   * scheduled. Null for a streak, which has no target.
   */
  targetValue: real("target_value"),
  /**
   * A time goal counting every task in its unit or commitment,
   * including tasks added later, rather than the tasks linked in
   * `goal_task`. Only `timeSpent` reads it.
   */
  countsWholeUnit: integer("counts_whole_unit", { mode: "boolean" })
    .notNull()
    .default(false),
  /**
   * Optional end, at **month granularity**, `'YYYY-MM'` (ADR-0015 §4).
   * When it passes, nothing happens: no "overdue", no colour, no
   * prompt (ADR-0008).
   */
  targetDate: text("target_date"),
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

/**
 * The tasks a goal counts (ADR-0042 §1): the chosen tasks of a times
 * done or time spent goal, or a streak's one task. A points goal and a
 * time goal counting the whole unit have none.
 *
 * Only what counts **from now on**. A tick counts if its task was
 * linked when it was made, and it's kept as a `goal_entry`, so removing
 * a link never rewrites a goal's history.
 */
export const goalTask = sqliteTable(
  "goal_task",
  {
    goalId: text("goal_id")
      .notNull()
      .references(() => goal.id),
    taskId: text("task_id")
      .notNull()
      .references((): AnySQLiteColumn => task.id),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.goalId, t.taskId] })],
);

/**
 * One counted tick (`GoalEntry`, ADR-0042 §1), written with the tick
 * and removed with it.
 *
 * Saved rather than derived so that unlinking a task, archiving it
 * (EC-36) or changing its size later leaves past progress alone.
 * `task_id` is deliberately not a foreign key: a tick outlives its
 * task, as completions do.
 */
export const goalEntry = sqliteTable("goal_entry", {
  id: text("id").primaryKey(),
  goalId: text("goal_id")
    .notNull()
    .references(() => goal.id),
  completionId: text("completion_id")
    .notNull()
    .references((): AnySQLiteColumn => taskCompletion.id),
  taskId: text("task_id").notNull(),
  localDate: text("local_date").notNull(),
  /** What a time goal counts (`tickMinutes`). */
  minutes: real("minutes").notNull(),
  /** What the tick earned in the goal's own units only. */
  points: real("points").notNull(),
  ...timestamps,
});

// ── Tasks (ADR-0003) ────────────────────────────────────────────────

export const task = sqliteTable("task", {
  id: text("id").primaryKey(),
  unitId: text("unit_id")
    .notNull()
    .references(() => lifeUnit.id),
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
   * — that is how it is priced, at `SIZE_RATE × its unit's weight`, the
   * same three ratios a logged activity uses. Null means an ordinary
   * recurring task and `times_per_week` governs instead.
   *
   * One-offs are deliberately kept **out of `taskWeights`**. Letting one
   * into the recurring allocation would make every other task in its
   * unit drop in weight while the errand existed and jump back when it
   * was ticked — the same instability ADR-0027's amendment removed from
   * the variable band, reintroduced across time. A one-off joins the
   * day's flexible pool like any other unpinned work (ADR-0029 §1).
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
  /**
   * Start and end as **integer minutes from local midnight**, 0–1439,
   * or null for a task with no clock time (ADR-0036).
   *
   * Any task may carry one and **nothing requires one** — part-of-day
   * stays the default and no flow prompts for a time. Those defaults
   * are load-bearing: they are the only place the product's opinion
   * about granularity now lives (PRODUCT.md principle 6).
   *
   * Integers rather than `"HH:MM"` because the grid does arithmetic on
   * them constantly: they sort and compare correctly and cannot be
   * malformed. `formatMinutes` handles display.
   *
   * The rollover hour is 3am (ADR-0004 §1), so these are a position
   * *within* a day and not a day boundary. Do not confuse the two.
   */
  startMinute: integer("start_minute"),
  endMinute: integer("end_minute"),
  /**
   * Effort size (ADR-0026 §1), reusing `activity.size`'s vocabulary so
   * one scale means the same thing everywhere.
   *
   * Optional, and unset rather than `normal` by default: a person who
   * never wants to think about size should never have to, and an
   * unsized task behaves exactly as tasks did before this column.
   *
   * **Never minutes.** ADR-0024 §6's reasoning stands — a minute
   * estimate inherits the planning fallacy, which the app cannot
   * correct without task segmentation it does not have. Window
   * capacity is a rough fit, not an arithmetic.
   *
   * It does **not** price a recurring task (ADR-0026 §2): rank already
   * does that job, and two mechanisms for one job can disagree. It
   * feeds fit and display only. One-offs keep pricing by size through
   * `ONE_OFF_SIZE_RATE`, unchanged.
   */
  size: text("size", { enum: ["quick", "normal", "big"] }),
  /**
   * Whether this task may be completed partially (ADR-0014 §1).
   *
   * A per-task toggle, off by default, rather than the app inferring
   * which tasks qualify. "Brush teeth, 50%" is meaningless and simply
   * has it off; the app offers the capability and the user says where
   * it applies (PRODUCT.md principle 6).
   */
  allowsPartial: integer("allows_partial", { mode: "boolean" })
    .notNull()
    .default(false),
  /**
   * `task` or `event` (ADR-0038). An event is a window of
   * time you attend — a class, a shift — and so always carries a start
   * and an end; otherwise it is a task in every way, ticked and paid
   * like one.
   */
  kind: text("kind", { enum: ["task", "event"] }).notNull().default("task"),
  /**
   * First and last day a repeating task or event runs, inclusive, or
   * null for no bound (ADR-0040 §1). "For N weeks" is saved as the last
   * day (`untilForWeeks`). Checked with `boundsError` on write; a bad
   * stored value only makes the series run never, it can't break a day.
   */
  repeatFrom: text("repeat_from"),
  repeatUntil: text("repeat_until"),
  /**
   * The sub-commitment this task lived in before its commitment stopped
   * using sub-commitments, so turning them back on puts it home again
   * (ADR-0035 §1 as amended 2026-10-02). Null otherwise, and cleared
   * once it has gone back.
   */
  movedFromUnitId: text("moved_from_unit_id"),
  pointValue: integer("point_value").notNull(),
  /** Beli-style rank; point values derive from rank shares (ADR-0003 §5). */
  rankInUnit: integer("rank_in_unit").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  archivedAt: text("archived_at"),
  /**
   * Paused because its unit went to Not now (ADR-0041 §3): archived like
   * any other, and marked so that moving the unit back up restores
   * exactly these tasks, without their pins. Cleared on restore.
   */
  pausedForNotNow: integer("paused_for_not_now", { mode: "boolean" })
    .notNull()
    .default(false),
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
  /**
   * How much of the task this completion represents: 0.25, 0.5, 0.75 or
   * 1 (ADR-0014 §2). Defaults to a whole completion, which is what
   * every row written before partial credit existed was.
   *
   * **This is the column ADR-0004 §2 anticipated** — "the
   * `task_completion` schema anticipates a partial-credit fraction
   * column" — added once windows made "I worked on it and did not
   * finish" a visible recurring event rather than an invisible one.
   *
   * Progress is the **sum** of a task's fractions, so finishing later
   * pays only the remainder without any new state that could disagree
   * with the completion history. `pointsEarned` still denormalizes what
   * this particular completion paid.
   */
  fraction: real("fraction").notNull().default(1),
  /**
   * "Took about…", in minutes (ADR-0042 §5), kept between 1 minute and
   * 12 hours (`clampTookAbout`). Only time goals read it; it never
   * changes points.
   */
  actualMinutes: integer("actual_minutes"),
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
 *
 * **To be retired in Phase 9**, when Home's windows replace the
 * part-of-day sections. A placement can say "Anytime, just today",
 * which has no window to pin to, so rows are copied to
 * `window_placement` and this table retired (not dropped) only when the
 * screens that write it go.
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

// ── Working hours and windows (ADR-0039) ────────────────────────────

/**
 * One version of the working-hours template (ADR-0039 §1), from its
 * first day on. "This week and after" writes a new version, so earlier
 * days keep the hours they had (EC-15). The version for a date is the
 * latest one that has started (`versionFor`).
 *
 * Each version is read and written whole, so its groups and gaps are
 * JSON rather than child rows:
 * `schedules`: `[{ weekdays: [1,2,3,4,5], ranges: [{ start, end }] }]`;
 * `gaps`: `[{ weekdays, range: { start, end }, name }]`. Minutes from
 * local midnight, as on `task.start_minute`. Checked with `rangeError`
 * on write and read tolerantly: a bad range is dropped, never thrown.
 * No rows at all means no hours have been set, so days use
 * `DEFAULT_RANGES` (EC-13).
 */
export const workHours = sqliteTable("work_hours", {
  fromDate: text("from_date").primaryKey(),
  schedules: text("schedules").notNull(),
  gaps: text("gaps").notNull().default("[]"),
  ...timestamps,
});

/**
 * One date's own working ranges, replacing the template's and its named
 * gaps ("Just this week", ADR-0039 §1). `ranges` is JSON like a
 * schedule's; `[]` is a day with no working hours.
 */
export const workDayOverride = sqliteTable("work_day_override", {
  localDate: text("local_date").primaryKey(),
  ranges: text("ranges").notNull(),
  ...timestamps,
});

/**
 * One change to one day's windows (§1.4 of windows-and-pins.md),
 * applied in `seq` order (`applyEdits`). Edits are by time, so removing
 * a range the day no longer has changes nothing.
 *
 * `made_on` is the local date the edit was made. One made on the day
 * itself doesn't count toward the commitment share's hours, which are
 * the hours as they stood when the day began (ADR-0044 §5, EC-56).
 */
export const dayWindowEdit = sqliteTable("day_window_edit", {
  id: text("id").primaryKey(),
  localDate: text("local_date").notNull(),
  seq: integer("seq").notNull(),
  kind: text("kind", { enum: ["add", "remove", "change"] }).notNull(),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
  /** A `change`'s new range; null on add and remove. */
  toStartMinute: integer("to_start_minute"),
  toEndMinute: integer("to_end_minute"),
  madeOn: text("made_on").notNull(),
  ...timestamps,
});

/**
 * A pin (windows-and-pins.md §2): a task held in the window at one time
 * of day, on one date or on chosen weekdays every week. Replaces
 * `planned_occurrence` and `pool_member` once the screens that write
 * those move over (Phases 8 and 9).
 *
 * **One live pin per task per day** (§2.7), kept by `db/pins.ts`:
 * pinning a task on a day it already has a pin moves it. `pinsOn`
 * still settles anything that slips through.
 *
 * **Old pins aren't kept** (§7). A pin for one date is deleted once its
 * day has ended, unless it's a pin until done still carrying an open
 * task, and a repeating pin keeps only its pattern and exceptions.
 * Finished pins kept beside completion times would let someone work
 * out how often pins were kept, which ADR-0029 §3 says must not be
 * derivable from what's stored. Pins never change a score (ADR-0039
 * §12).
 */
export const windowPlacement = sqliteTable("window_placement", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => task.id),
  kind: text("kind", { enum: ["window", "untilDone"] }).notNull(),
  /** The time it holds: the start of the window it was pinned into,
   *  in minutes from local midnight (§2.6). */
  anchorMinute: integer("anchor_minute").notNull(),
  repeat: text("repeat", { enum: ["once", "weekly"] }).notNull(),
  /** `once`: the date. Null on a weekly pin. */
  localDate: text("local_date"),
  /** `once` only: pinned after the week's runs were done, so an extra
   *  run on purpose (§2.8). */
  extra: integer("extra", { mode: "boolean" }).notNull().default(false),
  /** `weekly`: ISO weekdays, e.g. `"1,3,5"`. */
  weekdays: text("weekdays"),
  /** `weekly`: first and last day, inclusive; null until for no end. */
  fromDate: text("from_date"),
  untilDate: text("until_date"),
  /** Order inside its window, lower first. */
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

/** A date a weekly pin skips: "Just this day" changes and removals
 *  (§2.5). A change also writes a pin for that date. */
export const windowPlacementException = sqliteTable(
  "window_placement_exception",
  {
    placementId: text("placement_id")
      .notNull()
      .references(() => windowPlacement.id),
    localDate: text("local_date").notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.placementId, t.localDate] })],
);

/**
 * "Do N of these" (ADR-0039 §6, ADR-0033 §3): up to three tasks pinned
 * in one window, from one commitment, any `planned_count` of which
 * satisfy it. Replaced the old `pool` table in Phase 8. The window is
 * named by the time it holds, like a pin's. One of the two things about
 * windows that can change a score, so writes mark grades stale.
 */
export const windowChoice = sqliteTable("window_choice", {
  id: text("id").primaryKey(),
  localDate: text("local_date").notNull(),
  anchorMinute: integer("anchor_minute").notNull(),
  plannedCount: integer("planned_count").notNull().default(1),
  ...timestamps,
});

export const windowChoiceMember = sqliteTable(
  "window_choice_member",
  {
    choiceId: text("choice_id")
      .notNull()
      .references(() => windowChoice.id),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.choiceId, t.taskId] })],
);

// ── Skips, Clear today and Away (ADR-0040) ──────────────────────────

/**
 * A skipped occurrence or week (ADR-0040 §2), expanded to dates for
 * `ScheduleBounds.skippedDates` by `skippedDatesFor`.
 *
 * - `occurrence`: one task's run on `local_date`.
 * - `taskWeek`: one task's (usually an event's) whole week starting
 *   `local_date`.
 * - `commitmentWeek`: every task in commitment `unit_id`, its
 *   sub-commitments included, for the week starting `local_date`.
 *
 * `made_on` is the local date the skip was made. A skip made on the day
 * it empties makes that day ungraded rather than a rest day
 * (`emptiedToday`, ADR-0040 §3).
 */
export const scheduleSkip = sqliteTable("schedule_skip", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["occurrence", "taskWeek", "commitmentWeek"] }).notNull(),
  taskId: text("task_id").references(() => task.id),
  unitId: text("unit_id").references(() => lifeUnit.id),
  localDate: text("local_date").notNull(),
  madeOn: text("made_on").notNull(),
  ...timestamps,
});

/**
 * Clear today (ADR-0040 §4): the day's windows and unticked events are
 * set aside, and the day is still graded (or ungraded if nothing is
 * left due). Nothing else is written: window pins are hidden while this
 * row exists, so Undo, which deletes it, brings them back. Undo lasts
 * until the day ends.
 */
export const dayClear = sqliteTable("day_clear", {
  localDate: text("local_date").primaryKey(),
  ...timestamps,
});

/** Days away (ADR-0040 §5), inclusive. Every day in one is ungraded,
 *  and its pins are kept and hidden (EC-33). */
export const awayRange = sqliteTable("away_range", {
  id: text("id").primaryKey(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  label: text("label"),
  ...timestamps,
});

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
  /**
   * The working hours the day began with, JSON ranges as in
   * `work_day_override` (ADR-0044 §5, action item 2). The commitment
   * share reads these, so changing the hours on the day itself, or
   * later, never moves that day's share. Written the first time the day
   * is scored and just before any change to the hours that reaches it.
   * Null for days before formula v11, and for days not yet begun.
   */
  startingHours: text("starting_hours"),
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
