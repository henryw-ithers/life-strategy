import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  markNotificationPermissionAsked,
  setNotificationEnabled,
} from "../../db/settings";
import { requestPermission } from "../../notifications/dailyNudge";
import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

interface PermissionPrescreenProps {
  visible: boolean;
  /** Fires after either choice, so the caller can dismiss and
   *  re-sync the scheduled nudge. */
  onDone: () => void;
  theme: ThemeTokens;
}

/**
 * The in-app pre-screen ADR-0010 §4 requires: ask before the OS asks,
 * so the effectively one-shot system prompt isn't spent on a screen
 * the user hasn't seen yet. "Not now" is final until settings.
 */
export function PermissionPrescreen({ visible, onDone, theme }: PermissionPrescreenProps) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    const { granted } = await requestPermission();
    if (granted) await setNotificationEnabled(true);
    await markNotificationPermissionAsked();
    setBusy(false);
    onDone();
  };

  const notNow = async () => {
    if (busy) return;
    await markNotificationPermissionAsked();
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={notNow}>
      <Pressable style={styles.backdrop} onPress={notNow} accessibilityRole="button" accessibilityLabel="Close" />
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
          A daily reminder?
        </AppText>
        <AppText color={theme.ink}>
          One nudge a day, at a time you choose, only when today's list still
          needs you. It never says what's on it — just a tap through to
          today's checklist.
        </AppText>
        <Button label="Enable" onPress={enable} disabled={busy} theme={theme} />
        <Button label="Not now" variant="quiet" onPress={notNow} disabled={busy} theme={theme} />
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
