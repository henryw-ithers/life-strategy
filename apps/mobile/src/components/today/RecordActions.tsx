/**
 * Adding to the day's record: a note or a photo. Sits with the record
 * itself rather than beside the grade — having them a screen away from
 * what they add to cost the checklist its most valuable rows. Rendered
 * even when the record is empty, since that is when you most need the
 * way in.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

/** A small "+ Label" text button in the accent colour. */
export function AddAction({
  label,
  accessibilityLabel,
  onPress,
  theme,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      {/* Icon and label as one unit, so the pair never wraps apart. */}
      <View style={styles.action}>
        <Ionicons name="add" size={15} color={theme.accent} />
        <AppText variant="label" color={theme.accent}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

export function RecordActions({
  onAddNote,
  onAddPhoto,
  theme,
}: {
  onAddNote: () => void;
  onAddPhoto: () => void;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.row}>
      <AddAction
        label="Note"
        accessibilityLabel="Add a note to this day"
        onPress={onAddNote}
        theme={theme}
      />
      <AddAction
        label="Photo"
        accessibilityLabel="Add a photo to this day"
        onPress={onAddPhoto}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.xl,
    marginTop: space.md,
    minHeight: 44,
    alignItems: "center",
  },
  action: { flexDirection: "row", alignItems: "center", gap: 4 },
});
