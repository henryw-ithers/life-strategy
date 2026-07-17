import { StyleSheet, View, type ViewStyle } from "react-native";

export interface BackdropCircle {
  /** Area hue (hex). Alpha is appended, so pass the opaque token. */
  color: string;
  size: number;
  /** Position offsets; negatives bleed off-canvas by design. */
  offset: Pick<ViewStyle, "top" | "bottom" | "left" | "right">;
  /** Two-hex-digit alpha, default "14" (~8%). */
  alpha?: string;
}

/**
 * The app's visual signature: soft, oversized circles in area hues
 * bleeding off the canvas — the portfolio graph's geometry, echoed as
 * atmosphere. Render first inside a container with overflow hidden.
 * Never place it behind dense data (the graph canvas stays clean).
 */
export function Backdrop({ circles }: { circles: BackdropCircle[] }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {circles.map((c, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: c.size,
            height: c.size,
            borderRadius: c.size / 2,
            backgroundColor: `${c.color}${c.alpha ?? "14"}`,
            ...c.offset,
          }}
        />
      ))}
    </View>
  );
}

/**
 * All six area hues as a faint constellation — the app's portfolio
 * geometry, previewed. For landing/overview moments. `faint` halves
 * the presence for content-heavy screens.
 */
export function constellation(
  areas: Record<string, string>,
  opts?: { faint?: boolean },
): BackdropCircle[] {
  const f = opts?.faint === true;
  return [
    { color: areas["mental-wellbeing"] ?? "#888", size: 260, offset: { top: -90, right: -70 }, alpha: f ? "0d" : "1a" },
    { color: areas["relationships"] ?? "#888", size: 150, offset: { top: 130, left: -70 }, alpha: f ? "0a" : "14" },
    { color: areas["home-environment"] ?? "#888", size: 88, offset: { top: 40, left: 48 }, alpha: f ? "08" : "10" },
    { color: areas["leisure-creativity"] ?? "#888", size: 110, offset: { top: 300, right: 40 }, alpha: f ? "09" : "12" },
    { color: areas["work-money"] ?? "#888", size: 64, offset: { top: 220, right: 120 }, alpha: f ? "08" : "10" },
    { color: areas["physical-health"] ?? "#888", size: 190, offset: { bottom: -70, right: -50 }, alpha: f ? "08" : "0f" },
  ];
}

/** One hue washing a focused screen — used per area in the diagnostic. */
export function hueWash(accent: string): BackdropCircle[] {
  return [
    { color: accent, size: 280, offset: { top: -110, right: -90 }, alpha: "16" },
    { color: accent, size: 140, offset: { bottom: -40, left: -50 }, alpha: "0d" },
  ];
}
