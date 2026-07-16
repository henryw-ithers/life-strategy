import { Skia, type SkPath } from "@shopify/react-native-skia";

export const MIN_RADIUS = 10;
export const MAX_RADIUS = 26;

export interface PlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Inset the plot so a max-radius bubble at rating 1 or 10 never clips. */
export function plotRect(size: number): PlotRect {
  const pad = MAX_RADIUS + 4;
  return { x: pad, y: pad, w: size - pad * 2, h: size - pad * 2 };
}

export function ratingToX(value: number, plot: PlotRect): number {
  return plot.x + ((value - 1) / 9) * plot.w;
}

/** Importance grows upward; canvas y grows downward. */
export function ratingToY(value: number, plot: PlotRect): number {
  return plot.y + plot.h - ((value - 1) / 9) * plot.h;
}

export function effortToRadius(effort: number): number {
  const e = Math.min(1, Math.max(0, effort));
  return MIN_RADIUS + e * (MAX_RADIUS - MIN_RADIUS);
}

/** Qualitative effort wording for accessibility labels and callouts. */
export function effortLabel(effort: number): string {
  if (effort < 0.25) return "light effort";
  if (effort < 0.5) return "growing effort";
  if (effort < 0.75) return "steady effort";
  return "strong effort";
}

/**
 * Arrowhead for a compare trail, pulled back so it rests at the edge
 * of the destination bubble. Null when the movement is too small to
 * deserve an arrow.
 */
export function arrowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  endInset: number,
): SkPath | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < endInset + 14) return null;

  const ux = dx / len;
  const uy = dy / len;
  const tipX = x2 - ux * endInset;
  const tipY = y2 - uy * endInset;
  const size = 7;
  const baseX = tipX - ux * size;
  const baseY = tipY - uy * size;
  const px = -uy;
  const py = ux;

  const path = Skia.Path.Make();
  path.moveTo(tipX, tipY);
  path.lineTo(baseX + px * size * 0.55, baseY + py * size * 0.55);
  path.lineTo(baseX - px * size * 0.55, baseY - py * size * 0.55);
  path.close();
  return path;
}
