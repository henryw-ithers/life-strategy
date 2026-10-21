/**
 * "Add from open" (spec §5.3): every open task the day lists, to pin
 * into one window. Pinning moves a task here from wherever it was that
 * day; one window per task per day (windows-and-pins.md §2.7). Work
 * planned for a later day can be pinned too, to do it early
 * (ADR-0037 §3).
 */
import { Pressable, StyleSheet, View } from "react-native";

import type { TodayTask } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";

interface AddFromOpenSheetProps {
  visible: boolean;
  /** "09:00–11:00". */
  windowLabel: string;
  /** The sheet's title, when it isn't adding to a window. */
  title?: string;
  /** What a tap does, for VoiceOver. */
  pickHint?: string;
  /** What it says with nothing to offer. */
  emptyNote?: string;
  tasks: readonly TodayTask[];
  hueFor: (t: TodayTask) => string;
  theme: ThemeTokens;
  onClose: () => void;
  onDismissed?: () => void;
  onPick: (task: TodayTask) => void;
}

export function AddFromOpenSheet({
  visible,
  windowLabel,
  title,
  pickHint = "Pins it to this window",
  emptyNote = "Everything open is already here.",
  tasks,
  hueFor,
  theme,
  onClose,
  onDismissed,
  onPick,
}: AddFromOpenSheetProps) {
  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      title={title ?? `Add to ${windowLabel}`}
      size="large"
      scroll
    >
      {tasks.length === 0 ? (
        <AppText color={theme.muted}>{emptyNote}</AppText>
      ) : (
        tasks.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => onPick(t)}
            accessibilityRole="button"
            accessibilityLabel={t.title}
            accessibilityHint={pickHint}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.5 : 1 }]}
          >
            <View style={[styles.dot, { backgroundColor: hueFor(t) }]} />
            <AppText variant="body" color={theme.ink} style={styles.grow} numberOfLines={2}>
              {t.title}
            </AppText>
          </Pressable>
        ))
      )}
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
});
