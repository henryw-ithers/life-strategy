import { useState } from "react";

import {
  markNotificationPermissionAsked,
  setNotificationEnabled,
} from "../../db/settings";
import { requestPermission } from "../../notifications/dailyNudge";
import { type ThemeTokens } from "../../theme/colors";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";

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
    <NativeSheet
      visible={visible}
      onClose={notNow}
      // "Not now" is what Cancel does here: it won't ask again.
      cancelLabel="Not now"
      dismissible={!busy}
      title="A daily reminder?"
      confirm={{ label: "Enable", onPress: enable, disabled: busy }}
    >
      <AppText color={theme.ink}>
        One nudge a day, at a time you choose, and only when today’s list
        still needs you. It never says what’s on it. Tapping it opens
        today’s checklist.
      </AppText>
    </NativeSheet>
  );
}
