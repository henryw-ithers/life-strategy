/**
 * Confirmation for erasing everything.
 *
 * Two taps, not one. The sheet lists what actually goes rather than
 * asking "are you sure?", and the destructive button has to be armed
 * before it fires — a single mis-tap in Settings should not be able to
 * end a month of someone's journal entries. The export route is named
 * here because this is the last moment it's useful.
 */
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

interface EraseDataModalProps {
  visible: boolean;
  onClose: () => void;
  theme: ThemeTokens;
  onConfirm: () => Promise<void>;
}

export function EraseDataModal({
  visible,
  onClose,
  theme,
  onConfirm,
}: EraseDataModalProps) {
  const insets = useSafeAreaInsets();
  const [armed, setArmed] = useState(false);
  const [erasing, setErasing] = useState(false);

  const close = () => {
    if (erasing) return;
    setArmed(false);
    onClose();
  };

  const press = () => {
    if (erasing) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setErasing(true);
    void onConfirm();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
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
        {/* Matches the Settings row that opens it ("Reset everything").
         *  A sheet that renames the action mid-flow reads as a different
         *  action, which is the last thing this one should read as. */}
        <AppText variant="title" color={theme.ink}>
          Reset everything?
        </AppText>
        <AppText color={theme.ink}>
          Your diagnostics, goals, tasks, grades, journal entries, photos and
          check-ins are all deleted from this device. Glide starts again from
          the introduction.
        </AppText>
        <AppText variant="caption" color={theme.muted}>
          This can't be undone. If you want to keep any of it, close this and
          export a backup from Your data first.
        </AppText>

        <Button
          label={
            erasing
              ? "Resetting…"
              : armed
                ? "Tap again to reset"
                : "Reset everything"
          }
          color={theme.danger}
          disabled={erasing}
          onPress={press}
          theme={theme}
        />
        <Button
          label="Cancel"
          variant="quiet"
          disabled={erasing}
          onPress={close}
          theme={theme}
        />
      </View>
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
});
