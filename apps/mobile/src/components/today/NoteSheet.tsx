import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

interface NoteSheetProps {
  visible: boolean;
  /** "today" or a spoken date. */
  dayLabel: string;
  theme: ThemeTokens;
  onClose: () => void;
  onCommit: (body: string) => void;
}

/** Add a journal note to a day. Entries are append-only (ADR-0002) —
 *  the sheet always opens blank; the day's record only grows. */
export function NoteSheet({ visible, dayLabel, theme, onClose, onCommit }: NoteSheetProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const [body, setBody] = useState("");
  const inputRef = useRef<TextInput>(null);

  const keyboardStyle = useAnimatedStyle(() => ({
    paddingBottom:
      insets.bottom +
      space.lg +
      Math.max(keyboard.height.value - insets.bottom, 0),
  }));

  useEffect(() => {
    if (visible) setBody("");
  }, [visible]);

  const commit = () => {
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    onCommit(trimmed);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setTimeout(() => inputRef.current?.focus(), 80)}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.canvas, borderColor: theme.hairline },
          keyboardStyle,
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.hairline }]} />
        <AppText variant="title" color={theme.ink}>
          A note on {dayLabel}
        </AppText>
        <TextInput
          ref={inputRef}
          value={body}
          onChangeText={setBody}
          placeholder="What's worth remembering?"
          placeholderTextColor={theme.muted}
          multiline
          style={[styles.input, { backgroundColor: theme.surface, color: theme.ink }]}
        />
        <Button
          label="Save note"
          disabled={body.trim().length === 0}
          onPress={commit}
          theme={theme}
        />
        <Button label="Cancel" variant="quiet" onPress={onClose} theme={theme} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.sm + 2,
    gap: space.lg,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  input: {
    ...typeScale.body,
    minHeight: 120,
    maxHeight: 240,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    textAlignVertical: "top",
  },
});
