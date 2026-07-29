/**
 * Goals owns a stack inside its tab so a goal's detail screen pushes
 * *within* the tab and the bar stays put — without this layout, Expo
 * Router would surface `[goalId]` as a sixth destination.
 */
import { Stack } from "expo-router";

export default function GoalsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
