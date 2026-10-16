import { useHeaderHeight } from "expo-router/react-navigation";
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from "react-native";

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
 *
 * **Kept clear of the top (Prism, 2026-10-14).** Nothing starts above
 * the large title, so the nav bar and its glass have little to blur
 * at rest (spec §2.2). The circles begin about where content does.
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
 * The backdrop for a pushed screen, which has to keep its scroll view
 * first (`pushedOptions`): put this first *inside* the scroll content.
 * It is placed as if it were behind the screen, from the top of the
 * window and a window high, so the circles sit where a tab's do; they
 * scroll away with the content.
 */
export function ScrollBackdrop({ circles }: { circles: BackdropCircle[] }) {
  const { height } = useWindowDimensions();
  // Scroll content starts below the nav bar on iOS, where it's
  // transparent. The web preview's bar takes its own space.
  const headerHeight = useHeaderHeight();
  const top = Platform.OS === "ios" ? -headerHeight : 0;
  return (
    <View pointerEvents="none" style={[styles.scrolling, { top, height }]}>
      <Backdrop circles={circles} />
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
    { color: areas["mental-wellbeing"] ?? "#888", size: 260, offset: { top: 120, right: -110 }, alpha: f ? "0d" : "1a" },
    { color: areas["relationships"] ?? "#888", size: 150, offset: { top: 130, left: -70 }, alpha: f ? "0a" : "14" },
    { color: areas["home-environment"] ?? "#888", size: 88, offset: { top: 190, left: 36 }, alpha: f ? "08" : "10" },
    { color: areas["leisure-creativity"] ?? "#888", size: 110, offset: { top: 300, right: 40 }, alpha: f ? "09" : "12" },
    { color: areas["work-money"] ?? "#888", size: 64, offset: { top: 220, right: 120 }, alpha: f ? "08" : "10" },
    { color: areas["physical-health"] ?? "#888", size: 190, offset: { bottom: -70, right: -50 }, alpha: f ? "08" : "0f" },
  ];
}

/** One hue washing a focused screen — used per area in the diagnostic. */
export function hueWash(accent: string): BackdropCircle[] {
  return [
    { color: accent, size: 280, offset: { top: 120, right: -130 }, alpha: "16" },
    { color: accent, size: 140, offset: { bottom: -40, left: -50 }, alpha: "0d" },
  ];
}

const styles = StyleSheet.create({
  scrolling: { position: "absolute", left: 0, right: 0 },
});
