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
 * Manrope, loaded at launch (see `src/app/_layout.tsx`).
 *
 * React Native does **not** synthesize weights for a custom family —
 * each weight is a separately registered family name, and setting
 * `fontWeight` alongside one makes Android fake-bold on top of an
 * already-bold file. So the scale names the exact face and never
 * carries `fontWeight`.
 *
 * Any text outside `AppText` — a `TextInput`, or a raw `Text` inside a
 * component with its own sizing — must still pull its family from
 * here, or it silently falls back to the system font and the screen
 * ends up in two typefaces.
 */
export const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
} as const;

/**
 * Type scale, disciplined. Negative tracking on large sizes, tabular
 * numerals wherever numbers align (Manrope ships `tnum`).
 */
export const type = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fonts.bold,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.bold,
    letterSpacing: -0.35,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.semibold,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fonts.regular,
    letterSpacing: 0,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.semibold,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.medium,
    letterSpacing: 0.05,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.medium,
    letterSpacing: 0.1,
  },
  /** The day's grade. A real, recurring display size the scale was
   *  missing — `DayNumber` had been hard-coding it. */
  numeral: {
    fontSize: 44,
    lineHeight: 48,
    fontFamily: fonts.bold,
    letterSpacing: -1,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
