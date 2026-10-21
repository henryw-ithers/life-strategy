/**
 * Move to… (spec §4.4): pin a task into another of today's windows,
 * from Home. It stays there while that window is current or to come
 * (windows-and-pins §2). Moving never brings up a warning (X1, X2).
 */
import type { TimeRange } from "@glide/scoring";
import { Pressable, StyleSheet } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { spanLabel, spokenSpan } from "../plan/dayView";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";

interface MoveToWindowSheetProps {
  visible: boolean;
  taskTitle: string;
  /** Today's windows still to come, other than the one it's in. */
  windows: readonly TimeRange[];
  theme: ThemeTokens;
  onClose: () => void;
  onDismissed?: () => void;
  onPick: (window: TimeRange) => void;
}

export function MoveToWindowSheet({
  visible,
  taskTitle,
  windows,
  theme,
  onClose,
  onDismissed,
  onPick,
}: MoveToWindowSheetProps) {
  return (
    <NativeSheet visible={visible} onClose={onClose} onDismissed={onDismissed} title={`Move ${taskTitle}`}>
      {windows.length === 0 ? (
        <AppText color={theme.muted}>There&apos;s no other window left today.</AppText>
      ) : (
        windows.map((w) => (
          <Pressable
            key={`${w.start}-${w.end}`}
            onPress={() => onPick(w)}
            accessibilityRole="button"
            accessibilityLabel={`To the window ${spokenSpan(w)}`}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.5 : 1 }]}
          >
            <AppText color={theme.ink} tabular>
              {spanLabel(w)}
            </AppText>
          </Pressable>
        ))
      )}
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, justifyContent: "center", paddingVertical: space.xs },
});
