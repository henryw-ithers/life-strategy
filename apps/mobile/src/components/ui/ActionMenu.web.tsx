/**
 * The browser preview's stand-in for `ActionMenu.tsx`: SwiftUI doesn't
 * render on the web. A tap runs the main action; the ••• opens a small
 * list of the actions. Same props, so callers never know which one they
 * got. The preview is for looking at UI, never a target
 * (docs/web-preview.md). A row with no main action opens the list on a
 * tap.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";

import { getTheme } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import type { ActionMenuProps } from "./ActionMenu";
import { AppText } from "./AppText";

export function ActionMenu({
  actions,
  onPress,
  label,
  moreColor,
  children,
  more = true,
  hint: _hint,
  heading = false,
}: ActionMenuProps) {
  // `sizing` only matters to the native host; plain views size to content.
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [open, setOpen] = useState(false);
  return (
    <View>
      <View style={styles.row}>
        <Pressable
          onPress={onPress ?? (() => setOpen((o) => !o))}
          accessibilityRole={heading ? "header" : "button"}
          accessibilityLabel={label}
          style={styles.grow}
        >
          {children}
        </Pressable>
        {more ? (
          <Pressable
            onPress={() => setOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={`More for ${label}`}
            style={styles.more}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={moreColor} />
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <View style={[styles.list, { backgroundColor: theme.surface }]}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                setOpen(false);
                a.onPress();
              }}
              accessibilityRole="button"
              style={styles.item}
            >
              <AppText color={a.destructive === true ? theme.danger : theme.ink}>{a.label}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  grow: { flex: 1 },
  more: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  list: { borderRadius: radius.md, paddingVertical: space.xs },
  item: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.lg },
});
