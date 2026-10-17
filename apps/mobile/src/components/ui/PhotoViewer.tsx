/**
 * A photo, full screen: tap anywhere to close. Its buttons float over
 * the photo in glass, the way the Photos app does it (ADR-0043 §2):
 * Close at the top left, and Delete at the top right where the photo
 * can be deleted (the day's record; the Log only looks).
 *
 * The photo fades in; the buttons don't, because glass can't fade
 * (`Glass`), so the Modal itself doesn't animate. Inset by the safe
 * area, because the viewer is edge to edge.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { space } from "../../theme/tokens";
import { Glass } from "./Glass";

/** Behind the photo, and the glass buttons' solid fallback. */
const BACKDROP = "rgba(0,0,0,0.92)";
const BUTTON_FALLBACK = "#3A3A3C";

export function PhotoViewer({
  uri,
  onClose,
  onDelete,
}: {
  /** The photo on screen; null when closed. */
  uri: string | null;
  onClose: () => void;
  /** Where the photo can be deleted. The screen offers Undo. */
  onDelete?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return (
    <Modal visible={uri !== null} transparent statusBarTranslucent onRequestClose={onClose}>
      {uri !== null ? (
        <>
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(180)}
            style={styles.fill}
          >
            {/* Tap anywhere to close, for touch. VoiceOver gets the
                Close button instead, and the photo as itself. */}
            <Pressable style={styles.viewer} onPress={onClose} accessible={false}>
              <Image
                source={{ uri }}
                style={styles.photo}
                contentFit="contain"
                accessible
                accessibilityLabel="Photo"
              />
            </Pressable>
          </Animated.View>
          <View style={[styles.bar, { top: insets.top + space.sm }]} pointerEvents="box-none">
            <GlassButton
              symbol="xmark"
              fallbackIcon="close"
              label="Close photo"
              onPress={onClose}
            />
            {onDelete ? (
              <GlassButton
                symbol="trash"
                fallbackIcon="trash-outline"
                label="Delete this photo"
                onPress={() => {
                  // Delete first: the caller finds the photo by what's open.
                  onDelete();
                  onClose();
                }}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </Modal>
  );
}

function GlassButton({
  symbol,
  fallbackIcon,
  label,
  onPress,
}: {
  symbol: SFSymbol;
  fallbackIcon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      {({ pressed }) => (
        <Glass style={styles.button} fallback={BUTTON_FALLBACK} scheme="dark" interactive>
          {/* Pressed feedback on the glyph, never on the glass. */}
          <SymbolView
            name={symbol}
            size={20}
            tintColor="#ffffff"
            style={{ opacity: pressed ? 0.5 : 1 }}
            fallback={<Ionicons name={fallbackIcon} size={20} color="#ffffff" />}
          />
        </Glass>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  viewer: {
    flex: 1,
    backgroundColor: BACKDROP,
    alignItems: "center",
    justifyContent: "center",
  },
  photo: { width: "100%", height: "100%" },
  bar: {
    position: "absolute",
    left: space.screen,
    right: space.screen,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
