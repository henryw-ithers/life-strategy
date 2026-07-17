import type { TextStyle } from "react-native";

/**
 * Spacing scale (4-based). Every gap, padding, and margin in the app
 * comes from here — no ad-hoc values.
 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  /** Horizontal screen gutter. */
  screen: 20,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 22,
  pill: 999,
} as const;

/**
 * Type scale: system font (SF Pro / Roboto), disciplined. Negative
 * tracking on large sizes, tabular numerals wherever numbers align.
 */
export const type = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.35,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    letterSpacing: 0,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    letterSpacing: 0.05,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
