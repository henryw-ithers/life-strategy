/**
 * "Note deleted · Undo": the bar after a delete that can be taken back
 * (`useUndoDelete`). It floats just above the tab bar in glass, like
 * Mail's Undo Send, and goes by itself after about five seconds.
 *
 * It sits in react-native-screens' safe area, which on a tab's screen
 * includes the tab bar, so it clears the bar at any size, minimised or
 * not. Render it after the screen's scroll view, so the scroll view
 * stays first.
 */
import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Animated, { Keyframe, useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-screens/experimental";

import type { UndoDelete } from "../../hooks/useUndoDelete";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "./AppText";
import { Glass } from "./Glass";

/** A short rise into place, and back down: the bar's own height and a
 *  bit, not the whole screen (Reanimated's Slide starts off-screen). */
const TRAVEL = 80;
const RISE = new Keyframe({
  0: { transform: [{ translateY: TRAVEL }] },
  100: { transform: [{ translateY: 0 }] },
}).duration(220);
const SINK = new Keyframe({
  0: { transform: [{ translateY: 0 }] },
  100: { transform: [{ translateY: TRAVEL }] },
}).duration(180);

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
          // Moves rather than fades: glass stops rendering while
          // anything above it is see-through (`Glass`).
          <Animated.View
            key={pending.id}
            entering={reduceMotion ? undefined : RISE}
            exiting={reduceMotion ? undefined : SINK}
            style={styles.slot}
          >
            <Glass style={styles.bar} fallback={theme.surface}>
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
            </Glass>
          </Animated.View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { justifyContent: "flex-end" },
  slot: { marginHorizontal: space.screen, marginBottom: space.md },
  /** A capsule, like iOS's own floating glass controls. */
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    borderRadius: 26,
  },
  grow: { flex: 1 },
  undo: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: space.sm },
});
