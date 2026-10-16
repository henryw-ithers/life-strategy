/**
 * The press-and-hold menu: a centred card over a scrim, matching the
 * day record's own so one gesture has one look app-wide.
 *
 * Shared since 2026-10-02, when commitment screens gained it for their
 * sub-commitments: a second hand-rolled copy is how vocabularies drift
 * apart.
 */
import { useRef } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";

import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "./AppText";

export interface MenuRow {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function MenuSheet({
  visible,
  rows,
  theme,
  onClose,
  title,
}: {
  visible: boolean;
  rows: MenuRow[];
  theme: ThemeTokens;
  onClose: () => void;
  title?: string;
}) {
  /** A row's action waits until this menu has finished closing: most of
   *  them open a native sheet, and iOS drops a sheet presented while
   *  another view is still closing (Phase 3c). Phase 3d replaces this
   *  menu with a native one. */
  const pending = useRef<(() => void) | null>(null);
  const choose = (row: MenuRow) => {
    // The web preview's Modal never reports dismissal.
    if (Platform.OS === "web") {
      row.onPress();
      return;
    }
    pending.current = row.onPress;
    onClose();
  };
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => {
        const run = pending.current;
        pending.current = null;
        run?.();
      }}
    >
      <Pressable
        style={styles.menuBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <View
          style={[
            styles.menuCard,
            { backgroundColor: theme.canvas, borderColor: theme.hairline },
          ]}
        >
          {title ? (
            <AppText variant="caption" color={theme.muted} style={styles.menuTitle} numberOfLines={1}>
              {title}
            </AppText>
          ) : null}
          {rows.map((row) => (
            <Pressable
              key={row.label}
              onPress={() => choose(row)}
              disabled={row.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: row.disabled }}
              style={({ pressed }) => [
                styles.menuRow,
                { opacity: row.disabled ? 0.35 : pressed ? 0.5 : 1 },
              ]}
            >
              <AppText color={row.destructive ? theme.danger : theme.ink}>
                {row.label}
              </AppText>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
          >
            <AppText color={theme.muted}>Cancel</AppText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menuBackdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.screen,
  },
  menuCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.xs,
  },
  menuTitle: {
    textAlign: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  menuRow: { minHeight: 48, alignItems: "center", justifyContent: "center" },
});
