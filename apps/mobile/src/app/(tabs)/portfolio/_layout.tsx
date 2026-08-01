/**
 * Portfolio owns a stack inside its tab so the full graph pushes
 * *within* the tab and the bar stays put — without this layout, Expo
 * Router would name the route `portfolio/index` and surface `graph` as
 * a sixth destination.
 */
import { Stack } from "expo-router";

export default function PortfolioLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
