/**
 * Light, Dark or the system's look (Henry, 2026-11-10). React Native's
 * own override: every `useColorScheme()` and the native bars follow it,
 * so no screen needs to know.
 */
import { Appearance } from "react-native";

export type AppearanceChoice = "system" | "light" | "dark";

export function isAppearanceChoice(value: unknown): value is AppearanceChoice {
  return value === "system" || value === "light" || value === "dark";
}

export function applyAppearance(choice: AppearanceChoice): void {
  // The web preview's react-native-web has no override; it follows the
  // browser there.
  if (typeof Appearance.setColorScheme !== "function") return;
  Appearance.setColorScheme(choice === "system" ? "unspecified" : choice);
}
