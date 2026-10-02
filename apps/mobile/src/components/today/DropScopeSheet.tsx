/**
 * The question a drag has nowhere to ask: a task dropped into another
 * part of the day — is that where it goes from now on, or just today?
 * Confirms scope only; the row is already where it was put, and Cancel
 * returns it.
 */
import { Modal, StyleSheet, View } from "react-native";

import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { ANYTIME_LABEL, PART_OF_DAY_LABEL, type PartOfDay } from "../plan/planning";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

export function DropScopeSheet({
  drop,
  onJustToday,
  onFromNowOn,
  onCancel,
  theme,
}: {
  /** The dropped task and where it landed; null hides the sheet. */
  drop: { title: string; part: PartOfDay | null } | null;
  onJustToday: () => void;
  onFromNowOn: () => void;
  onCancel: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Modal
      visible={drop !== null}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View
          style={[styles.card, { backgroundColor: theme.canvas, borderColor: theme.hairline }]}
        >
          <AppText variant="title" color={theme.ink} numberOfLines={2}>
            {drop?.title}
          </AppText>
          <AppText color={theme.muted}>
            Moved to{" "}
            {drop?.part ? PART_OF_DAY_LABEL[drop.part] : ANYTIME_LABEL.toLowerCase()}. Is that
            where it goes from now on?
          </AppText>
          <Button label="Just today" color={theme.accent} onPress={onJustToday} theme={theme} />
          <Button label="From now on" variant="secondary" onPress={onFromNowOn} theme={theme} />
          <Button label="Cancel" variant="quiet" onPress={onCancel} theme={theme} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /** Centred card over a scrim. */
  backdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.screen,
  },
  /** Wider than the press-and-hold menu: this one carries a sentence of
   *  copy, not a list of verbs. */
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xl,
    gap: space.md,
  },
});
