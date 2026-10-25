/**
 * ⓘ: the explanation a screen used to print, kept for whoever wants it
 * (Henry, 2026-10-25: "way too much exposition"). A tap shows it in a
 * native alert, so it costs the screen one glyph.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Alert, Pressable, StyleSheet } from "react-native";

import type { ThemeTokens } from "../../theme/colors";

export function InfoButton({
  title,
  body,
  theme,
}: {
  title: string;
  body: string;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={() => Alert.alert(title, body)}
      accessibilityRole="button"
      accessibilityLabel={`About ${title}`}
      hitSlop={10}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name="information-circle-outline" size={20} color={theme.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
