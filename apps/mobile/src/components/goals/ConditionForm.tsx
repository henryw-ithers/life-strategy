/**
 * The inline form that names a condition — adding one or renaming one.
 * The same prompt either way: it is one job.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, TextInput } from "react-native";
import Animated, { type FadeIn } from "react-native-reanimated";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

export function ConditionForm({
  value,
  onChangeText,
  renaming,
  onSubmit,
  onCancel,
  accent,
  entering,
  theme,
}: {
  value: string;
  onChangeText: (text: string) => void;
  /** True when this rewrites an existing condition rather than adding. */
  renaming: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  accent: string;
  entering: FadeIn | undefined;
  theme: ThemeTokens;
}) {
  return (
    <Animated.View entering={entering} style={styles.form}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel="Condition"
        placeholder="What has to be true?"
        placeholderTextColor={theme.muted}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        style={[styles.input, { backgroundColor: theme.surface, color: theme.ink }]}
      />
      <Pressable
        onPress={onSubmit}
        accessibilityRole="button"
        accessibilityLabel={renaming ? "Save condition" : "Add condition"}
        hitSlop={8}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: accent, opacity: pressed ? 0.5 : 1 },
        ]}
      >
        <Ionicons name={renaming ? "checkmark" : "add"} size={17} color={theme.onAccent} />
      </Pressable>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        hitSlop={8}
        style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.5 : 1 }]}
      >
        <AppText variant="label" color={theme.muted}>
          Cancel
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  form: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xl,
  },
  input: {
    ...typeScale.body,
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  submit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cancel: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.xs },
});
