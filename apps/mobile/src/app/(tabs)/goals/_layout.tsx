/**
 * Life's stack (the route keeps its old name, `goals`). Its root has a
 * large "Life" title, Settings and the + menu in the native nav bar. A
 * goal or a commitment pushes within the tab, so the tab bar stays;
 * those screens draw their own header until Phase 3d.
 */
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

import { PUSHED_OPTIONS, tabRootOptions } from "../../../components/nav/tabRoot";
import { getTheme } from "../../../theme/colors";

export default function LifeLayout() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  return (
    <Stack screenOptions={PUSHED_OPTIONS}>
      <Stack.Screen name="index" options={tabRootOptions(theme, "Life")} />
    </Stack>
  );
}
