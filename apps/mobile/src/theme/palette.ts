/**
 * The 12 colours a unit or commitment can carry (ADR-0043 §4).
 *
 * They are iOS's 12 system colours, in the higher-contrast versions
 * Apple publishes, so every one works as a checkbox ring, an event bar
 * or tinted text: at least 4.5:1 on the background and on cards in
 * both modes (`__tests__/palette.test.ts` holds them to it). Three light
 * versions are a step darker than Apple's: green (4.4:1 on white, Henry,
 * 2026-10-14), and teal and mint (4.0 and 4.2:1 on a card).
 *
 * A filled checkbox uses the same colour with a white tick in light mode
 * and a black tick in dark mode, which clears 4.5:1 for every colour.
 *
 * The six areas take six of the 12 (`AREA_COLOUR`). A unit with no
 * colour of its own uses its area's. Colour is presentation only: it
 * never touches weight, rank or order (ADR-0021).
 *
 * Stored as the key (`life_unit.colour`), never as hex, so a palette
 * revision recolours every unit without a migration.
 */
import type { ThemeName } from "./colors";

export const PALETTE_KEYS = [
  "red",
  "orange",
  "yellow",
  "green",
  "mint",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "pink",
  "brown",
] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];

export interface PaletteColour {
  /** What the colour picker calls it. */
  name: string;
  /** On the light background. */
  light: string;
  /** On the dark background. */
  dark: string;
}

export const PALETTE: Record<PaletteKey, PaletteColour> = {
  red: { name: "Red", light: "#D70015", dark: "#FF6961" },
  orange: { name: "Orange", light: "#C93400", dark: "#FFB340" },
  yellow: { name: "Yellow", light: "#B25000", dark: "#FFD426" },
  green: { name: "Green", light: "#1F7F38", dark: "#30DB5B" },
  mint: { name: "Mint", light: "#0B7A74", dark: "#66D4CF" },
  teal: { name: "Teal", light: "#00778C", dark: "#5DE6FF" },
  cyan: { name: "Cyan", light: "#0071A4", dark: "#70D7FF" },
  blue: { name: "Blue", light: "#0040DD", dark: "#409CFF" },
  indigo: { name: "Indigo", light: "#3634A3", dark: "#7D7AFF" },
  purple: { name: "Purple", light: "#8944AB", dark: "#DA8FFF" },
  pink: { name: "Pink", light: "#D30F45", dark: "#FF6482" },
  brown: { name: "Brown", light: "#7F6545", dark: "#B59469" },
};

/** Each area's colour, keeping the families the areas had before Prism. */
export const AREA_COLOUR: Record<string, PaletteKey> = {
  relationships: "pink",
  "physical-health": "green",
  "mental-wellbeing": "teal",
  "work-money": "blue",
  "home-environment": "orange",
  "leisure-creativity": "purple",
};

export function isPaletteKey(value: unknown): value is PaletteKey {
  return typeof value === "string" && (PALETTE_KEYS as readonly string[]).includes(value);
}

export function paletteHue(key: PaletteKey, theme: ThemeName): string {
  return PALETTE[key][theme];
}
