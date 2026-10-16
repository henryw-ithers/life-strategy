/**
 * Log's stack: a large "Log" title in the native nav bar.
 */
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

import { tabRootOptions } from "../../../components/nav/tabRoot";
import { getTheme } from "../../../theme/colors";

export default function LogLayout() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={tabRootOptions(theme, "Log")} />
    </Stack>
  );
}
