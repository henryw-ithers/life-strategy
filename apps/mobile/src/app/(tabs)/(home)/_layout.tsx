/**
 * Today's stack. A large title that folds as you scroll, like the other
 * tabs (Henry, 2026-11-07); the screen sets it to the day it shows.
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
      <Stack.Screen name="index" options={tabRootOptions(theme, "Today")} />
    </Stack>
  );
}
