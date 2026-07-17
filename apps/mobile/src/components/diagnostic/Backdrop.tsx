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
