/**
 * The five top-level destinations. Order is Goals · Tasks · Home ·
 * Portfolio · Settings — Home sits dead centre, with the two screens
 * you edit to its left and the two you review to its right.
 *
 * Focused tasks stay *outside* this group — diagnostic, calibration,
 * backup, and onboarding are pushed by the root stack so they cover
 * the bar rather than sit beside it. The diagnostic in particular is a
 * ritual with its own exit, not a place you browse to; it is reached
 * from Portfolio, from Plan's empty state, and from onboarding.
 */
import { Tabs } from "expo-router";

import { TabBar } from "../../components/nav/TabBar";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="goals" options={{ title: "Goals" }} />
      <Tabs.Screen name="plan" options={{ title: "Tasks" }} />
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="portfolio" options={{ title: "Portfolio" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
