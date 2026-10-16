/**
 * The browser preview's stand-in for `NativeSheet.tsx`: SwiftUI doesn't
 * render on the web, so this draws the app's older custom sheet with
 * the same header. Same props, so callers never know which one they
 * got. The preview is for looking at UI, never a target
 * (docs/web-preview.md).
 */
import { useEffect, useRef } from "react";
import { Modal, StyleSheet, useColorScheme, View } from "react-native";

import { getTheme } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import type { NativeSheetProps } from "./NativeSheet";
import { SheetFrame } from "./SheetFrame";
import { SheetHeader } from "./SheetHeader";

export function NativeSheet({
  visible,
  onClose,
  size = "fit",
  scroll: _scroll,
  onDismissed,
  dismissible: _dismissible,
  children,
  ...header
}: NativeSheetProps) {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  // React Native's Modal doesn't report dismissal on the web, so
  // `onDismissed` fires as it closes.
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible) onDismissed?.();
    wasVisible.current = visible;
  }, [visible, onDismissed]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SheetFrame onClose={onClose}>
        <View
          style={[
            styles.sheet,
            size === "large" ? styles.large : null,
            { backgroundColor: theme.canvas },
          ]}
        >
          <SheetHeader {...header} onCancel={onClose} />
          {children}
        </View>
      </SheetFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  large: { height: "92%" },
});
