import { Circle, DashPathEffect, Group, Line, Path, vec } from "@shopify/react-native-skia";

import { arrowPath } from "./geometry";
import type { UnitSeries } from "./series";

interface CompareOverlayProps {
  series: UnitSeries[];
  oldIndex: number;
  newIndex: number;
  colorFor: (areaId: string) => string;
  /** Dimming from selection/legend focus, per unit id (0.25–1). */
  dimFor: (unitId: string) => number;
}

/**
 * Static compare-mode layer: dashed ghost at the older snapshot's
 * position, a trail line, and an arrowhead resting at the current
 * bubble's edge. Units new since the older snapshot get a dashed ring
 * instead of a trail.
 */
export function CompareOverlay({
  series,
  oldIndex,
  newIndex,
  colorFor,
  dimFor,
}: CompareOverlayProps) {
  return (
    <Group>
      {series.map((s) => {
        const color = colorFor(s.areaId);
        const dim = dimFor(s.unitId);
        const existsNow = s.present[newIndex] === 1;
        if (!existsNow) return null;

        const isNew = s.present[oldIndex] !== 1;
        const x2 = s.xs[newIndex]!;
        const y2 = s.ys[newIndex]!;
        const rNew = s.rs[newIndex]!;

        if (isNew) {
          return (
            <Circle
              key={s.unitId}
              cx={x2}
              cy={y2}
              r={rNew + 5}
              color={color}
              opacity={0.5 * dim}
              style="stroke"
              strokeWidth={1}
            >
              <DashPathEffect intervals={[3, 4]} />
            </Circle>
          );
        }

        const x1 = s.xs[oldIndex]!;
        const y1 = s.ys[oldIndex]!;
        const rOld = s.rs[oldIndex]!;
        const arrow = arrowPath(x1, y1, x2, y2, rNew + 2);

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const lineEnd =
          len > rNew + 4
            ? vec(x2 - (dx / len) * (rNew + 3), y2 - (dy / len) * (rNew + 3))
            : null;

        return (
          <Group key={s.unitId}>
            <Circle
              cx={x1}
              cy={y1}
              r={rOld}
              color={color}
              opacity={0.3 * dim}
              style="stroke"
              strokeWidth={1}
            >
              <DashPathEffect intervals={[4, 4]} />
            </Circle>
            {lineEnd ? (
              <Line
                p1={vec(x1, y1)}
                p2={lineEnd}
                color={color}
                opacity={0.45 * dim}
                strokeWidth={1.5}
              />
            ) : null}
            {arrow ? <Path path={arrow} color={color} opacity={0.7 * dim} /> : null}
          </Group>
        );
      })}
    </Group>
  );
}
