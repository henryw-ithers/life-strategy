/**
 * The one irreversible act on a goal, so the one that asks — and the
 * copy says what survives rather than only what goes, since "delete"
 * reads worse than it is.
 */
import { Modal, StyleSheet, View } from "react-native";

import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

export function DeleteGoalModal({
  visible,
  goalTitle,
  onCancel,
  onDelete,
  theme,
}: {
  visible: boolean;
  goalTitle: string;
  onCancel: () => void;
  onDelete: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View
          style={[styles.card, { backgroundColor: theme.canvas, borderColor: theme.hairline }]}
        >
          <AppText variant="title" color={theme.ink}>
            Delete this goal?
          </AppText>
          <AppText color={theme.muted}>
            “{goalTitle}” and its conditions go for good. Anything you already achieved stays in
            your log, and its tasks stay in your plan — they just stop pointing at this goal.
          </AppText>
          <View style={styles.actions}>
            <View style={styles.grow}>
              <Button label="Cancel" variant="quiet" onPress={onCancel} theme={theme} />
            </View>
            <View style={styles.grow}>
              <Button label="Delete" color={theme.danger} onPress={onDelete} theme={theme} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /** Centred card over a scrim, matching the day record's own
   *  press-and-hold menu so one gesture has one look app-wide. */
  backdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.screen,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xl,
    gap: space.md,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.sm,
  },
  grow: { flex: 1 },
});
