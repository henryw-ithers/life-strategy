import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { UnitInfo } from "../../content/units";
import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

interface UnitInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  unitName: string;
  info: UnitInfo;
  accent: string;
  theme: ThemeTokens;
}

/** Bottom sheet: what a unit covers, and what success in it looks like. */
export function UnitInfoSheet({
  visible,
  onClose,
  unitName,
  info,
  accent,
  theme,
}: UnitInfoSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
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
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <AppText variant="title" color={theme.ink}>
              {unitName}
            </AppText>
          </View>
          <AppText color={theme.ink} style={styles.description}>
            {info.description}
          </AppText>

          <AppText variant="caption" color={theme.muted} style={styles.heading}>
            Success in this area
          </AppText>
          {info.guidelines.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <View style={[styles.bullet, { backgroundColor: accent }]} />
              <AppText color={theme.ink} style={styles.bulletText}>
                {line}
              </AppText>
            </View>
          ))}
        </ScrollView>
        <View style={styles.closeWrap}>
          <Button label="Close" variant="secondary" onPress={onClose} theme={theme} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: SCRIM },
  sheet: {
    maxHeight: "75%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.sm + 2,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: space.lg,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm + 2 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  description: { marginTop: space.sm + 2 },
  heading: { marginTop: space.xl, marginBottom: space.sm + 2 },
  bulletRow: { flexDirection: "row", gap: space.sm + 2, marginBottom: space.sm + 2 },
  bullet: { width: 5, height: 5, borderRadius: 2.5, marginTop: 9 },
  bulletText: { flex: 1 },
  closeWrap: { marginTop: space.sm },
});
