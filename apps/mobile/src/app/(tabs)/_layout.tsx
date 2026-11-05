/**
 * The four tabs, in the native iOS 26 tab bar (ADR-0043 §1, spec §2.1):
 * Today, Week, Life and Log, each with an SF Symbol and a label (Home
 * and Plan until windows were set aside, ADR-0051). The bar
 * shrinks as you scroll down, except on Home: its own header sits
 * above its scroll view, so iOS can't find what to follow.
 *
 * **Every tab's page is opaque and draws its own backdrop.** The
 * backdrop used to live here, once, behind see-through pages. But iOS
 * changes tabs with both pages on screen for a moment, so the two
 * pages' content and bar buttons showed through each other on every
 * switch (Henry, 2026-10-16). Expo's native tabs guide gives the same
 * advice: opaque page backgrounds. iOS finds the scroll view that
 * drives the large title, the glass edge and the tab bar's shrinking by
 * following each screen's first child down, so the backdrop goes
 * inside the scroll view (`ScrollBackdrop`).
 *
 * Settings is a button in the nav bar on Home and Life, not a tab:
 * Apple keeps tabs for the app's main places. Focused flows (Priorities,
 * calibration, backup, onboarding, Settings) are pushed by
 * the root stack, so they cover the tab bar.
 *
 * Route names kept their old paths (`(home)`, `plan`, `goals`) when the
 * labels became Today, Week and Life, so no link had to change.
 */
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, useColorScheme, View } from "react-native";

import { getTheme } from "../../theme/colors";


export default function TabsLayout() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const opaque = { backgroundColor: theme.canvas };
  return (
    <View style={[styles.root, opaque]}>
      <NativeTabs minimizeBehavior="onScrollDown" tintColor={theme.accent}>
        <NativeTabs.Trigger name="(home)" contentStyle={opaque}>
          <NativeTabs.Trigger.Icon sf="sun.max" />
          <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="plan" contentStyle={opaque}>
          <NativeTabs.Trigger.Icon sf="calendar" />
          <NativeTabs.Trigger.Label>Week</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="goals" contentStyle={opaque}>
          <NativeTabs.Trigger.Icon sf="square.grid.2x2" />
          <NativeTabs.Trigger.Label>Life</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="log" contentStyle={opaque}>
          <NativeTabs.Trigger.Icon sf="book.closed" />
          <NativeTabs.Trigger.Label>Log</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
