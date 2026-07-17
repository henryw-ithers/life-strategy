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
  /** One categorical hue per Strategic Life Area, keyed by area id. */
  areas: Record<string, string>;
}

/** Hues 20/150/200/255/80/300 at L≈0.55–0.66 C≈0.10–0.13 (light canvas). */
const AREA_COLORS_LIGHT: Record<string, string> = {
  relationships: "#bb565a", // rose, hue 20
  "physical-health": "#4a925c", // green, hue 150
  "mental-wellbeing": "#008c92", // brand teal, hue 200
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

const THEMES: Record<ThemeName, ThemeTokens> = {
  light: {
    name: "light",
    canvas: "#ffffff",
    surface: "#eef1f1",
    ink: "#151c1e",
    muted: "#5a6569",
    hairline: "#dbdfe0",
    accent: "#008c92",
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
    areas: AREA_COLORS_DARK,
  },
};

export function getTheme(name: ThemeName): ThemeTokens {
  return THEMES[name];
}
