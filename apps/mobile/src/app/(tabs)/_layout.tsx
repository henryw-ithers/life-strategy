/**
 * The five top-level destinations. Order is Goals · Tasks · Home ·
 * Portfolio · Log — Home sits dead centre, with the two screens you
 * edit to its left and the two you review to its right.
 *
 * **Settings left the bar and Log took its place (2026-08-19.)** The
 * bar is the most expensive space in the app and Settings was the one
 * destination in it that is not part of the product's loop: you visit
 * it to change a reminder, not to plan, execute, or reflect. Meanwhile
 * the third of the product's three horizons — the record of a life
 * (PRODUCT.md; design principle 5) — had no surface anywhere, while
 * journals, photos and achievements were written and never read back.
 * Settings now sits behind the control on Home's header, which is
 * where every app this one wants to stand beside puts it.
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
      <Tabs.Screen name="log" options={{ title: "Log" }} />
    </Tabs>
  );
}
