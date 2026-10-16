/**
 * Home's stack. Its nav bar carries only the + menu and Settings, with
 * no title: Home draws its own header (the week strip and the grade)
 * until Phase 9 rebuilds it (Henry, 2026-10-16).
 */
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

import { tabRootOptions } from "../../../components/nav/tabRoot";
import { getTheme } from "../../../theme/colors";

export default function HomeLayout() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={tabRootOptions(theme, "")} />
    </Stack>
  );
}
