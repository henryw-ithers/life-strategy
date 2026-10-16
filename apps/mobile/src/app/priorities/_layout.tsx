/**
 * Priorities: today's ranking screen and the full graph, opened from
 * Life (Phase 3b; Phase 6 replaces the screen with the tiers). It used
 * to be the Portfolio tab. It sits outside the tabs so it covers the tab
 * bar, like the other focused screens, and owns a stack so the graph
 * pushes within it.
 */
import { Stack } from "expo-router";

export default function PrioritiesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
