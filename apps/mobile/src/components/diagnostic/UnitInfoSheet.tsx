import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { UnitInfo } from "../../content/units";
import { type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

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
      <SheetFrame onClose={onClose}>
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

          {/* The app's own thinking about this unit (ADR-0025 §13) —
              why it behaves differently from the rest. Seven units
              have one; the other eleven have nothing to explain, and
              a note on all eighteen would be noise.

              Last, and in a quieter block: it is context for someone
              who went looking, not a lesson to read first. That is
              ADR-0008's "discoverable always, pushed never" — the
              sheet has to be opened before any of this is seen. */}
          {info.note ? (
            <View
              style={[
                styles.note,
                { backgroundColor: theme.surface, borderColor: theme.hairline },
              ]}
            >
              <AppText variant="caption" color={theme.muted}>
                {info.note}
              </AppText>
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.closeWrap}>
          <Button label="Close" variant="secondary" onPress={onClose} theme={theme} />
        </View>
      </View>
      </SheetFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  note: {
    marginTop: space.md,
    marginBottom: space.xs,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  closeWrap: { marginTop: space.sm },
});
