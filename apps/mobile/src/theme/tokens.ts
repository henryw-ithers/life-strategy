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
 * SF, the system font (ADR-0043 §3). It comes with the phone, so
 * nothing loads at launch, and iOS applies its own optical tracking
 * for each size, so the scale sets no letter spacing. Weights are
 * plain `fontWeight` values: unlike a bundled family, SF has every
 * weight built in.
 *
 * Text outside `AppText` (a `TextInput`, or a raw `Text` with its own
 * sizing) should still take its weight from here.
 */
export const weight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/**
 * Type scale, disciplined. Sizes are unchanged from the Manrope scale
 * so no screen reflows; tabular numerals wherever numbers align.
 */
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: weight.bold },
  title: { fontSize: 22, lineHeight: 28, fontWeight: weight.bold },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: weight.semibold },
  body: { fontSize: 16, lineHeight: 24, fontWeight: weight.regular },
  label: { fontSize: 15, lineHeight: 20, fontWeight: weight.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: weight.medium },
  footnote: { fontSize: 12, lineHeight: 16, fontWeight: weight.medium },
  /** The day's grade. A real, recurring display size the scale was
   *  missing — `DayNumber` had been hard-coding it. */
  numeral: { fontSize: 44, lineHeight: 48, fontWeight: weight.bold },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
