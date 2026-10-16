/**
 * App colour tokens: the Prism style (ADR-0043 §3, chosen 2026-10-13).
 *
 * The backgrounds, text and separators are iOS's own system colours, so
 * the app sits beside Apple's in light and dark mode. The accent is the
 * label colour (black in light mode, white in dark), so it is never
 * confused with a unit's colour. All the colour in the app comes from
 * units, through `palette.ts`. Contrast is checked in
 * `__tests__/palette.test.ts`.
 */
import { AREA_COLOUR, PALETTE, isPaletteKey, type PaletteKey } from "./palette";

export type ThemeName = "light" | "dark";

export interface ThemeTokens {
  name: ThemeName;
  /** systemBackground: #FFFFFF / #000000 */
  canvas: string;
  /** secondarySystemBackground, for cards: #F2F2F7 / #1C1C1E */
  surface: string;
  /** label */
  ink: string;
  /** secondary text, opaque so it holds 4.5:1 on cards as well as the
   *  background (iOS's translucent secondaryLabel doesn't). */
  muted: string;
  /** separator */
  hairline: string;
  /** The label colour: buttons and highlights. */
  accent: string;
  /** Text and ticks on `accent` or on a unit-coloured fill. */
  onAccent: string;
  /** Destructive actions only. It is the same red as the palette's Red,
   *  as on iOS, where a red list and a red Delete button coexist: a
   *  destructive action is known by its label, never by colour alone. */
  danger: string;
  /** Each area's colour, keyed by area id. */
  areas: Record<string, string>;
}

/** Sheet/modal backdrop dim, identical in both themes. */
export const SCRIM = "rgba(0,0,0,0.45)";

function areaColours(name: ThemeName): Record<string, string> {
  return Object.fromEntries(
    Object.entries(AREA_COLOUR).map(([area, key]) => [area, PALETTE[key][name]]),
  );
}

const THEMES: Record<ThemeName, ThemeTokens> = {
  light: {
    name: "light",
    canvas: "#FFFFFF",
    surface: "#F2F2F7",
    ink: "#000000",
    muted: "#6C6C70",
    hairline: "#C6C6C8",
    accent: "#000000",
    onAccent: "#FFFFFF",
    danger: "#D70015",
    areas: areaColours("light"),
  },
  dark: {
    name: "dark",
    canvas: "#000000",
    surface: "#1C1C1E",
    ink: "#FFFFFF",
    muted: "#98989F",
    hairline: "#38383A",
    accent: "#FFFFFF",
    onAccent: "#000000",
    danger: "#FF6961",
    areas: areaColours("dark"),
  },
};

export function getTheme(name: ThemeName): ThemeTokens {
  return THEMES[name];
}

/**
 * A unit's colour: its own palette colour if it has one, otherwise its
 * area's (ADR-0043 §4). A stored value that isn't a palette key is
 * ignored rather than drawn.
 */
export function unitHue(
  theme: ThemeTokens,
  unit: { areaId: string; colour?: string | null },
): string {
  if (isPaletteKey(unit.colour)) return PALETTE[unit.colour][theme.name];
  return theme.areas[unit.areaId] ?? theme.accent;
}

/**
 * The grade chip's six bands, low to high: under 50, the 50s, 60s, 70s,
 * 80s, and 90 and over. Palette colours since 2026-10-16 (Henry), so the
 * chips match the rest of the app in both modes. Used on the month grid
 * and Home's week strip only (DESIGN.md, the calendar exception).
 */
const GRADE_RAMP: readonly PaletteKey[] = ["red", "orange", "yellow", "green", "mint", "blue"];

/**
 * A hue as a selectable surface: 12% on the light canvas, 18% on the
 * dark one, which swallows the lighter tint (DESIGN.md, Tonal button).
 *
 * **Pair it with an Ink label, never `onAccent` on the solid hue.**
 * Four of the six area hues fall under 4.5:1 in light theme when used
 * as a fill behind small text — Physical health lands at 3.78:1 and
 * Environment at 3.16:1 — so a solid-fill chip is an AA failure for a
 * third of the taxonomy. On a wash, Ink never drops below 13.9:1 in
 * either theme.
 *
 * DESIGN.md states the underlying rule twice: the tonal button's label
 * "is Ink, never `accent`", and the calendar ramp's numerals render in
 * Ink "because the mid-band hues sit under 4.5:1 at footnote size".
 * This is that rule, shared rather than retyped.
 */
export function wash(hue: string, theme: ThemeTokens): string {
  return `${hue}${theme.name === "dark" ? "2e" : "1f"}`;
}

/**
 * A hue as a **solid fill with `onAccent` text on it**: the primary
 * button, the checklist's tick circle.
 *
 * Under Prism every palette colour already carries `onAccent` at 4.5:1
 * or better in both modes (the palette test checks it), so the fill is
 * the hue itself. Kept as the one place a fill is chosen, so a future
 * palette that needs a deeper fill changes here and nowhere else.
 */
export function solidFill(hue: string, _theme: ThemeTokens): string {
  return hue;
}

export function gradeColor(grade: number, theme: ThemeTokens): string {
  const band =
    grade < 50 ? 0 : grade < 60 ? 1 : grade < 70 ? 2 : grade < 80 ? 3 : grade < 90 ? 4 : 5;
  return PALETTE[GRADE_RAMP[band]!][theme.name];
}
