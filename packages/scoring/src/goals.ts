export type GoalStatus =
  | "active"
  | "paused"
  | "revised"
  | "abandoned"
  | "completed";

export type GoalAction = "pause" | "resume" | "abandon" | "revive" | "complete";

export type MilestoneStatus = "pending" | "current" | "completed";

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
 * Milestones are a flat, ordered list with exactly one `current`
 * (ADR-0007 §3). Given the milestone that was just completed, returns
 * the next one (by `sortOrder`) to promote to `current`, or `null` if
 * none remain — the caller should then run the goal's completion flow.
 */
export function advanceMilestone(
  milestones: { id: string; sortOrder: number; status: MilestoneStatus }[],
  completedId: string,
): { nextCurrentId: string | null } {
  const next = milestones
    .filter((m) => m.id !== completedId && m.status !== "completed")
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return { nextCurrentId: next?.id ?? null };
}
