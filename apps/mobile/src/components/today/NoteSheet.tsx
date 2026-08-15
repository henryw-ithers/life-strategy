import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

interface NoteSheetProps {
  visible: boolean;
  /** "today" or a spoken date. */
  dayLabel: string;
  /** The note being rewritten. Absent when adding a new one. */
  initialBody?: string;
  theme: ThemeTokens;
  onClose: () => void;
  onCommit: (body: string) => void;
}

/** Write a journal note, or rewrite one.
 *
 *  Entries used to be append-only (ADR-0002) and this sheet always
 *  opened blank. That was retired on 2026-08-13 — pass `initialBody`
 *  and the same sheet edits in place. */
export function NoteSheet({
  visible,
  dayLabel,
  initialBody,
  theme,
  onClose,
  onCommit,
}: NoteSheetProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const [body, setBody] = useState(initialBody ?? "");
  const inputRef = useRef<TextInput>(null);

  const keyboardStyle = useAnimatedStyle(() => ({
    paddingBottom:
      insets.bottom +
      space.lg +
      Math.max(keyboard.height.value - insets.bottom, 0),
  }));

  // Re-seed each time it opens: blank for a new note, the existing
  // text when rewriting one.
  useEffect(() => {
    if (visible) setBody(initialBody ?? "");
  }, [visible, initialBody]);

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
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.canvas, borderColor: theme.hairline },
          keyboardStyle,
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.hairline }]} />
        <AppText variant="title" color={theme.ink}>
          {initialBody === undefined ? `A note on ${dayLabel}` : "Edit note"}
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
          label={initialBody === undefined ? "Save note" : "Save changes"}
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
  backdrop: { flex: 1, backgroundColor: SCRIM },
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
