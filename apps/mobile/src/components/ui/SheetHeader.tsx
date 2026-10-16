/**
 * The header of a form sheet, as iOS draws one: Cancel on the left, the
 * title in the middle, and the confirming action on the right in bold
 * (spec §2.2). Shared by `NativeSheet` and its web fallback.
 */
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";

import { getTheme } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "./AppText";

export interface SheetHeaderProps {
  title: string;
  /** The confirming action, such as Save or Add. */
  confirm?: { label: string; onPress: () => void; disabled?: boolean };
  /** "cancel" (the default) puts Cancel on the left. "done" is for a
   *  sheet with nothing to confirm, such as an explanation: a bold Done
   *  on the right closes it, as iOS does. */
  dismiss?: "cancel" | "done";
  /** The left button's word, when Cancel isn't what it means: "Not
   *  now" for a prompt that won't ask again. */
  cancelLabel?: string;
}

export function SheetHeader({
  title,
  confirm,
  dismiss = "cancel",
  cancelLabel = "Cancel",
  onCancel,
}: SheetHeaderProps & { onCancel: () => void }) {
  const right = dismiss === "done" ? { label: "Done", onPress: onCancel } : confirm;
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  return (
    <View style={styles.row}>
      {dismiss === "cancel" ? (
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.side, { opacity: pressed ? 0.5 : 1 }]}
        >
          <AppText color={theme.ink}>{cancelLabel}</AppText>
        </Pressable>
      ) : (
        <View style={styles.side} />
      )}
      <AppText
        variant="headline"
        color={theme.ink}
        // Two lines: titles can be the user's own words (a task's title).
        numberOfLines={2}
        style={styles.title}
        accessibilityRole="header"
      >
        {title}
      </AppText>
      <View style={[styles.side, styles.right]}>
        {right ? (
          <Pressable
            onPress={right.onPress}
            disabled={"disabled" in right ? right.disabled : false}
            accessibilityRole="button"
            accessibilityState={{ disabled: "disabled" in right && right.disabled === true }}
            hitSlop={8}
            style={({ pressed }) => ({
              opacity: "disabled" in right && right.disabled ? 0.35 : pressed ? 0.5 : 1,
            })}
          >
            <AppText variant="headline" color={theme.ink}>
              {right.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.sm },
  side: { minWidth: 72, minHeight: 44, justifyContent: "center" },
  right: { alignItems: "flex-end" },
  title: { flex: 1, textAlign: "center" },
});
