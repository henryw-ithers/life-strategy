export type GoalStatus =
  | "active"
  | "paused"
  | "revised"
  | "abandoned"
  | "completed";

export type GoalAction = "pause" | "resume" | "abandon" | "revive" | "complete";

/**
 * Goal state machine (ADR-0007 §1). `revise` isn't an action here — it
 * doesn't just change status, it closes the goal as `revised` while
 * spawning a linked successor row, which is a multi-row operation
 * handled at the db layer.
 */
export function nextGoalStatus(
  current: GoalStatus,
  action: GoalAction,
): GoalStatus {
  switch (action) {
    case "pause":
      if (current !== "active") {
        throw new Error(`nextGoalStatus: cannot pause a ${current} goal`);
      }
      return "paused";
    case "resume":
      if (current !== "paused") {
        throw new Error(`nextGoalStatus: cannot resume a ${current} goal`);
      }
      return "active";
    case "abandon":
      if (current !== "active" && current !== "paused") {
        throw new Error(`nextGoalStatus: cannot abandon a ${current} goal`);
      }
      return "abandoned";
    case "revive":
      if (current !== "abandoned") {
        throw new Error(`nextGoalStatus: cannot revive a ${current} goal`);
      }
      return "active";
    case "complete":
      if (current !== "active") {
        throw new Error(`nextGoalStatus: cannot complete a ${current} goal`);
      }
      return "completed";
  }
}

/**
 * `advanceMilestone` and `MilestoneStatus` **retired 2026-08-26**
 * (ADR-0030 §5).
 *
 * They ran ADR-0007 §3's ordered ladder: one `current` rung at a time,
 * promoted as each was completed. A goal's authored child is now a
 * **condition** — a parallel prerequisite that never completes — so
 * there is no order to advance through and no status to hold. Habit
 * rungs, the one ladder worth keeping, are computed from
 * `HABIT_LADDER` against a streak instead of stored (see `streak.ts`).
 */
