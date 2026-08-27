/**
 * App color tokens, composed in OKLCH and exported as hex (React
 * Native can't parse OKLCH at runtime). Sources in comments so the
 * palette can be recomposed. Light canvas is pure white; dark canvas
 * is pure near-black — the brand hue lives in the area colors and
 * accents, never smuggled into the surface.
 */
export type ThemeName = "light" | "dark";

export interface ThemeTokens {
  name: ThemeName;
  /** oklch(1 0 0) / oklch(0.13 0 0) */
  canvas: string;
  /** oklch(0.955 0.003 220) / oklch(0.19 0.006 220) */
  surface: string;
  /** oklch(0.22 0.012 220) / oklch(0.93 0.005 200) — ≥16:1 on canvas */
  ink: string;
  /** oklch(0.50 0.015 220) / oklch(0.68 0.010 200) — ≥6:1 on canvas */
  muted: string;
  /** oklch(0.90 0.004 220) / oklch(0.30 0 0) */
  hairline: string;
  /** Brand teal (hue 200) — primary actions and app-level accents. */
  accent: string;
  /** Label color on accent/area fills. Dark theme lifts its hues, so
   *  the readable label there is near-black, not white (≥7:1). */
  onAccent: string;
  /** Destructive actions only — never an area hue doing double duty. */
  danger: string;
  /** One categorical hue per Strategic Life Area, keyed by area id. */
  areas: Record<string, string>;
}

/** Sheet/modal backdrop dim, identical in both themes. */
export const SCRIM = "rgba(0,0,0,0.45)";

/** Hues 20/150/200/255/80/300 at L≈0.55–0.66 C≈0.10–0.13 (light canvas). */
const AREA_COLORS_LIGHT: Record<string, string> = {
  relationships: "#bb565a", // rose, hue 20
  "physical-health": "#4a925c", // green, hue 150
  "mental-wellbeing": "#007a80", // brand teal, hue 200 — tracks `accent`
  "work-money": "#3d73b6", // blue, hue 255
  "home-environment": "#b8892d", // amber, hue 80
  "leisure-creativity": "#7d5fad", // violet, hue 300
};

/** Same hues lifted to L≈0.70–0.78 so bubbles glow on the dark canvas. */
const AREA_COLORS_DARK: Record<string, string> = {
  relationships: "#eb8182",
  "physical-health": "#6fc082",
  "mental-wellbeing": "#3ebfc6",
  "work-money": "#64a1ee",
  "home-environment": "#e3ad4b",
  "leisure-creativity": "#ab8be3",
};

/**
 * The light hues at the lightness a **white label** needs, keyed by the
 * hue they stand in for (see `solidFill`).
 *
 * DESIGN.md recorded this as an open decision: `Button`'s primary
 * variant renders `onAccent` on whatever fill it is given, and thirteen
 * call sites hand it an area hue — 3.78:1 on Physical health, 3.16:1 on
 * Environment. The two options it named were restricting fills to the
 * accent or giving the variant a wash; Henry chose a third on
 * 2026-08-17: keep the hue, take it down to where the label passes.
 *
 * Same OKLCH hue and chroma, L lowered until white clears **4.8:1** —
 * AA with a little margin rather than a value sitting on the line.
 * Four of the six move by less than a step and are visually the same
 * colour; only Physical health and Environment change materially, which is
 * exactly the pair that failed. Environment reads as deep ochre rather
 * than amber when filled, because an amber that carries white text *is*
 * ochre — the alternative was a 3.16:1 button.
 *
 * These are for **solid fills behind a label only**. Bubbles, pips,
 * borders, washes and the graph all keep the original hues: they carry
 * no text, and matching them here would darken the app's identity for
 * no reason.
 */
const AREA_FILLS_LIGHT: Record<string, string> = {
  "#bb565a": "#b85156", // rose      4.57 → 4.82
  "#4a925c": "#36804a", // green     3.78 → 4.83
  "#007a80": "#007a80", // teal      5.13, already clear
  "#3d73b6": "#3d73b6", // blue      4.85, already clear
  "#b8892d": "#966a04", // amber     3.16 → 4.81
  "#7d5fad": "#7d5fad", // violet    5.11, already clear
};

const THEMES: Record<ThemeName, ThemeTokens> = {
  light: {
    name: "light",
    canvas: "#ffffff",
    surface: "#eef1f1",
    ink: "#151c1e",
    muted: "#5a6569",
    hairline: "#dbdfe0",
    /** oklch(0.52 0.087 200) — 5.1:1 as text on canvas, 4.5:1 on
     *  surface, and 5.1:1 for the white label on an accent fill. The
     *  previous #008c92 sat at 4.06:1 in all three roles, under AA for
     *  15–17px label text; this is the same hue, one step down. */
    accent: "#007a80",
    onAccent: "#ffffff",
    danger: "#a63d33", // oklch(0.50 0.13 30) — 6.3:1 on white
    areas: AREA_COLORS_LIGHT,
  },
  dark: {
    name: "dark",
    canvas: "#070707",
    surface: "#111416",
    ink: "#e4e9e9",
    muted: "#929a9b",
    hairline: "#2e2e2e",
    accent: "#3ebfc6",
    onAccent: "#070707",
    danger: "#ee9086", // lifted to match dark-area weight — 8.6:1 on canvas
    areas: AREA_COLORS_DARK,
  },
};

export function getTheme(name: ThemeName): ThemeTokens {
  return THEMES[name];
}

/** Grade ramp for calendar scores: red <50, orange 50s, yellow 60s,
 *  green 70s, brighter green 80s, bright blue 90+. Hues at palette
 *  weight per theme (darker on light canvas, lifted on dark). */
const GRADE_RAMP_LIGHT = ["#c2453c", "#c07a2b", "#a38f1f", "#4a925c", "#31a352", "#2b7fdd"];
const GRADE_RAMP_DARK = ["#ef7a6d", "#e59a4a", "#d9c04b", "#6fc082", "#52d97e", "#58b0ff"];

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
 * A hue as a **solid fill with `onAccent` text on it** — the primary
 * button, the checklist's tick circle.
 *
 * Light theme swaps in the deepened variant (`AREA_FILLS_LIGHT`) so the
 * white label clears AA. Dark theme returns the hue untouched: its
 * label is near-black on a lifted hue, which is 7.2:1 at worst.
 *
 * Anything that is *not* a fill behind text — bubbles, pips, borders,
 * washes — takes `theme.areas[id]` directly and must not come through
 * here. Call it once, at the point the fill is chosen, so callers keep
 * passing the hue they mean.
 */
export function solidFill(hue: string, theme: ThemeTokens): string {
  if (theme.name === "dark") return hue;
  return AREA_FILLS_LIGHT[hue.toLowerCase()] ?? hue;
}

export function gradeColor(grade: number, theme: ThemeTokens): string {
  const ramp = theme.name === "dark" ? GRADE_RAMP_DARK : GRADE_RAMP_LIGHT;
  const band =
    grade < 50 ? 0 : grade < 60 ? 1 : grade < 70 ? 2 : grade < 80 ? 3 : grade < 90 ? 4 : 5;
  return ramp[band]!;
}
