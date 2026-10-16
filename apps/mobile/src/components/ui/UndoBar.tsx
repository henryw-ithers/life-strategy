/**
 * "Note deleted · Undo": the bar after a delete that can be taken back
 * (`useUndoDelete`). It floats just above the tab bar, like Mail's Undo
 * Send, and goes by itself after about five seconds.
 *
 * It sits in react-native-screens' safe area, which on a tab's screen
 * includes the tab bar, so it clears the bar at any size, minimised or
 * not. Render it after the screen's scroll view, so the scroll view
 * stays first.
 */
import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-screens/experimental";

import type { UndoDelete } from "../../hooks/useUndoDelete";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "./AppText";

export function UndoBar({ undo, theme }: { undo: UndoDelete; theme: ThemeTokens }) {
  const reduceMotion = useReducedMotion();
  const { pending } = undo;

  // The bar appears away from VoiceOver's focus, so without this a
  // screen-reader user never learns the delete can be taken back. Keyed
  // on the delete, not its words: two notes deleted in a row are two
  // announcements.
  useEffect(() => {
    if (pending !== null) {
      AccessibilityInfo.announceForAccessibility(`${pending.message}. Undo available.`);
    }
  }, [pending]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <SafeAreaView edges={{ bottom: true }} style={styles.area} pointerEvents="box-none">
        {pending ? (
          <Animated.View
            key={pending.id}
            entering={reduceMotion ? undefined : FadeInDown.duration(200)}
            exiting={reduceMotion ? undefined : FadeOutDown.duration(200)}
            style={[styles.bar, { backgroundColor: theme.surface }]}
          >
            <AppText color={theme.ink} style={styles.grow} numberOfLines={1}>
              {pending.message}
            </AppText>
            <Pressable
              onPress={undo.undo}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Undo: ${pending.message}`}
              style={({ pressed }) => [styles.undo, { opacity: pressed ? 0.5 : 1 }]}
            >
              <AppText variant="headline" color={theme.accent}>
                Undo
              </AppText>
            </Pressable>
          </Animated.View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { justifyContent: "flex-end" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    marginHorizontal: space.screen,
    marginBottom: space.md,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    borderRadius: radius.xl,
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.16)",
  },
  grow: { flex: 1 },
  undo: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: space.sm },
});
