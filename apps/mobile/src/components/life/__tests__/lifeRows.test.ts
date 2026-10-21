/**
 * Life's units by tier, with their shares of time (spec §5.4).
 */
import { describe, expect, it } from "vitest";

import { tierGroups } from "../lifeRows";

const unit = (id: string, tier: "top" | "important" | "background" | "notNow" | null, tierOrder: number, tasks = 0) => ({
  id,
  name: id,
  areaId: "a",
  tier,
  tierOrder,
  tasks: Array.from({ length: tasks }, () => ({ kind: "task" })),
});

describe("tierGroups", () => {
  it("groups by tier in your order, leaving out empty tiers", () => {
    const groups = tierGroups(
      [unit("b", "top", 1), unit("a", "top", 0), unit("c", "notNow", 0), unit("d", null, 2)],
      [],
    );
    expect(groups.map((g) => [g.label, g.units.map((u) => u.id)])).toEqual([
      ["Top", ["a", "b"]],
      ["Important", ["d"]],
      ["Not now", ["c"]],
    ]);
  });

  it("draws each share against the largest, never against a target", () => {
    const [top] = tierGroups(
      [unit("run", "top", 0, 2), unit("read", "top", 1)],
      [
        { unitId: "run", share: 0.4 },
        { unitId: "read", share: 0.1 },
      ],
    );
    expect(top!.units.map((u) => [u.id, u.tasks, u.bar])).toEqual([
      ["run", 2, 1],
      ["read", 0, 0.25],
    ]);
  });

  it("draws no bars when nothing was done", () => {
    const [g] = tierGroups([unit("run", "top", 0)], []);
    expect(g!.units[0]!.bar).toBe(0);
  });
});
