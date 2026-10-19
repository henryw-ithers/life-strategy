/**
 * Life's stack (the route keeps its old name, `goals`). Its root has a
 * large "Life" title, Settings and the + menu in the native nav bar. A
 * commitment pushes within the tab, so the tab bar stays, and
 * gets a native bar of its own (`pushedOptions`).
 */
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

import { pushedOptions, tabRootOptions } from "../../../components/nav/tabRoot";
import { getTheme } from "../../../theme/colors";

export default function LifeLayout() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  return (
    <Stack screenOptions={pushedOptions(theme)}>
      <Stack.Screen name="index" options={tabRootOptions(theme, "Life")} />
    </Stack>
  );
}
