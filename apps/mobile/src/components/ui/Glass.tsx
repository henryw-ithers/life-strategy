/**
 * Liquid Glass for the app's own floating controls (ADR-0043 §2): the
 * Undo bar, the keyboard's hide button, a photo viewer's buttons. The
 * tab bar, nav bars, menus and sheets are already glass; iOS draws
 * them.
 *
 * Glass is only for controls that float over content. Never a card, a
 * row or the score, and never glass on glass.
 *
 * Solid instead, in `fallback`, when Reduce Transparency is on, before
 * iOS 26, where the glass API is missing (some iOS 26 betas), and in
 * the web preview. Nothing above it may fade (`opacity` below 1, a
 * fading Modal): glass stops rendering. Move it, or fade a part of the
 * screen it isn't in.
 */
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { View, type ColorValue, type StyleProp, type ViewStyle } from "react-native";

import { useReduceTransparency } from "../../hooks/useReduceTransparency";

/** Read once: it doesn't change while the app runs. */
const GLASS = isGlassEffectAPIAvailable();

interface GlassProps {
  style?: StyleProp<ViewStyle>;
  /** The solid colour it falls back to: usually `theme.surface`. */
  fallback: ColorValue;
  /** Responds to touch, as iOS's glass buttons do. For a button. */
  interactive?: boolean;
  /** "dark" over a photo, whatever the phone's appearance. */
  scheme?: "auto" | "light" | "dark";
  children?: React.ReactNode;
}

export function Glass(props: GlassProps) {
  return GLASS ? <LiveGlass {...props} /> : <Solid {...props} />;
}

function LiveGlass({ style, fallback, interactive = false, scheme = "auto", children }: GlassProps) {
  const reduce = useReduceTransparency();
  if (reduce) {
    return (
      <Solid style={style} fallback={fallback}>
        {children}
      </Solid>
    );
  }
  return (
    <GlassView
      style={style}
      glassEffectStyle="regular"
      isInteractive={interactive}
      colorScheme={scheme}
    >
      {children}
    </GlassView>
  );
}

function Solid({ style, fallback, children }: GlassProps) {
  return <View style={[style, { backgroundColor: fallback }]}>{children}</View>;
}
