/**
 * Plan's stack: a large "Plan" title in the native nav bar, with the +
 * menu (ADR-0043 §1).
 */
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

import { tabRootOptions } from "../../../components/nav/tabRoot";
import { getTheme } from "../../../theme/colors";

export default function PlanLayout() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={tabRootOptions(theme, "Plan")} />
    </Stack>
  );
}
