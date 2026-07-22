import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

interface AddGoalModalProps {
  visible: boolean;
  onClose: () => void;
  accent: string;
  theme: ThemeTokens;
  onCommit: (title: string, description: string | undefined) => Promise<void>;
}

/** A goal: specific, measurable, temporary (ADR-0007). Title required,
 *  description optional context for later you. */
export function AddGoalModal({
  visible,
  onClose,
  accent,
  theme,
  onCommit,
}: AddGoalModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const commit = () => {
    if (title.trim().length === 0 || saving) return;
    setSaving(true);
    const committedTitle = title.trim();
    const committedDescription =
      description.trim().length > 0 ? description.trim() : undefined;
    close();
    void onCommit(committedTitle, committedDescription);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.canvas,
              borderColor: theme.hairline,
              paddingBottom: insets.bottom + space.lg,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.hairline }]} />
          <AppText variant="title" color={theme.ink}>
            New goal
          </AppText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Bench 225 by June"
            placeholderTextColor={theme.muted}
            autoFocus
            returnKeyType="next"
            style={[styles.input, { backgroundColor: theme.surface, color: theme.ink }]}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Notes (optional)"
            placeholderTextColor={theme.muted}
            multiline
            style={[
              styles.input,
              styles.description,
              { backgroundColor: theme.surface, color: theme.ink },
            ]}
          />
          <Button
            label="Add goal"
            color={accent}
            disabled={title.trim().length === 0 || saving}
            onPress={commit}
            theme={theme}
          />
          <Button label="Cancel" variant="quiet" onPress={close} theme={theme} />
        </View>
      </KeyboardAvoidingView>
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
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  description: { minHeight: 72, paddingTop: space.sm, textAlignVertical: "top" },
});
