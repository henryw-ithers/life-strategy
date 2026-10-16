/**
 * The four tabs, in the native iOS 26 tab bar (ADR-0043 §1, spec §2.1):
 * Home, Plan, Life and Log, each with an SF Symbol and a label. The bar
 * shrinks as you scroll down, except on Home for now: its own header
 * sits above its scroll view, so iOS can't find what to follow. Phase 9
 * rebuilds Home.
 *
 * **The backdrop lives here, once, behind every tab.** iOS finds the
 * scroll view that drives the large title, the glass edge and the tab
 * bar's shrinking by following each screen's first child down. A
 * backdrop drawn first inside a screen would sit in that path and stop
 * all three, so each tab's root screen is transparent and the bubbles
 * show through from here (spec §2.2: the backdrop sits behind
 * everything). Pushed screens are opaque and draw their own.
 *
 * Settings is a button in the nav bar on Home and Life, not a tab:
 * Apple keeps tabs for the app's main places. Focused flows (diagnostic,
 * calibration, backup, onboarding, Settings, Priorities) are pushed by
 * the root stack, so they cover the tab bar.
 *
 * Route names kept their old paths (`goals`, `plan`) when the labels
 * became Life and Plan, so no link had to change.
 */
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { StyleSheet, useColorScheme, View } from "react-native";

import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { getTheme } from "../../theme/colors";

/** Tab roots are see-through so the backdrop behind the tabs shows. */
const SEE_THROUGH = { backgroundColor: "transparent" } as const;
const NATIVE_CONTAINER = { nativeContainerStyle: SEE_THROUGH } as const;

export default function TabsLayout() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <NativeTabs
        minimizeBehavior="onScrollDown"
        tintColor={theme.ink}
        // The tab bar controller paints systemBackground over everything
        // unless told otherwise, which hid the backdrop on the phone
        // (the web preview has no such container).
        unstable_nativeProps={NATIVE_CONTAINER}
      >
        <NativeTabs.Trigger name="(home)" contentStyle={SEE_THROUGH}>
          <NativeTabs.Trigger.Icon sf="sun.max" />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="plan" contentStyle={SEE_THROUGH}>
          <NativeTabs.Trigger.Icon sf="calendar" />
          <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="goals" contentStyle={SEE_THROUGH}>
          <NativeTabs.Trigger.Icon sf="square.grid.2x2" />
          <NativeTabs.Trigger.Label>Life</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="log" contentStyle={SEE_THROUGH}>
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
