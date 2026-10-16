import { describe, expect, it } from "vitest";

import { getTheme, unitHue } from "../colors";
import { AREA_COLOUR, PALETTE, PALETTE_KEYS, isPaletteKey } from "../palette";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const light = getTheme("light");
const dark = getTheme("dark");

describe("the 12 colours (ADR-0043 §4)", () => {
  it("has 12", () => {
    expect(PALETTE_KEYS).toHaveLength(12);
  });

  it.each(PALETTE_KEYS)("%s reads as text on both backgrounds", (key) => {
    const c = PALETTE[key];
    expect(contrast(c.light, light.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.dark, dark.canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETTE_KEYS)("%s reads as text on a card in both modes", (key) => {
    const c = PALETTE[key];
    // Goal captions on Life are set in the unit's colour inside a Group.
    expect(contrast(c.light, light.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.dark, dark.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETTE_KEYS)("%s carries the tick when filled", (key) => {
    const c = PALETTE[key];
    expect(contrast(c.light, light.onAccent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.dark, dark.onAccent)).toBeGreaterThanOrEqual(4.5);
  });

  it("gives every area one of the 12, all different", () => {
    const keys = Object.values(AREA_COLOUR);
    expect(keys).toHaveLength(6);
    expect(new Set(keys).size).toBe(6);
    expect(keys.every(isPaletteKey)).toBe(true);
  });
});

describe("a unit's colour", () => {
  it("is its own when it has one", () => {
    expect(unitHue(light, { areaId: "work-money", colour: "pink" })).toBe(PALETTE.pink.light);
    expect(unitHue(dark, { areaId: "work-money", colour: "pink" })).toBe(PALETTE.pink.dark);
  });

  it("falls back to its area's", () => {
    expect(unitHue(light, { areaId: "physical-health", colour: null })).toBe(PALETTE.green.light);
  });

  it("ignores a stored value that isn't a palette key", () => {
    expect(unitHue(light, { areaId: "physical-health", colour: "#ff0000" })).toBe(
      PALETTE.green.light,
    );
  });
});

describe("Prism text tokens", () => {
  it.each([light, dark])("$name: text reads on the background and on cards", (t) => {
    for (const bg of [t.canvas, t.surface]) {
      expect(contrast(t.ink, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.muted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.danger, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
