/**
 * What a Strategic Life Area covers, and which units sit inside it.
 *
 * The sibling of `UnitInfoSheet`, and it exists because the six areas
 * were the one thing in the taxonomy a person could not ask about. Every
 * unit row in the app opens an explanation; the areas above them were
 * six coloured names and nothing else, including on the onboarding
 * screen whose entire job is teaching what the six are.
 *
 * It lists the units rather than describing the area twice. "Physical
 * health" needs no argument; what a reader actually wants to know is
 * whether sleep is in it, and that is a list.
 *
 * Areas are presentational (ADR-0021), so nothing here is a control:
 * no weight, no exclusion, no navigation into the unit. It is a sheet
 * you read and dismiss.
 */
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AreaInfo } from "../../content/areas";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

interface AreaInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  info: AreaInfo;
  /** The area's own hue, so the sheet is identifiably about that area. */
  accent: string;
  theme: ThemeTokens;
}

export function AreaInfoSheet({
  visible,
  onClose,
  info,
  accent,
  theme,
}: AreaInfoSheetProps) {
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

          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <AppText variant="title" color={theme.ink}>
              {info.name}
            </AppText>
          </View>

          <ScrollView
            style={styles.scroller}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <AppText color={theme.ink} style={styles.prose}>
              {info.description}
            </AppText>

            {info.covers.map((line) => (
              <View key={line} style={styles.coverRow}>
                <View style={[styles.pip, { backgroundColor: accent }]} />
                <AppText color={theme.ink} style={styles.coverText}>
                  {line}
                </AppText>
              </View>
            ))}
          </ScrollView>

          <Button label="Done" variant="secondary" onPress={onClose} theme={theme} />
        </View>
      </SheetFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.sm + 2,
    gap: space.md,
    maxHeight: "80%",
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  scroller: { flexGrow: 0 },
  body: { gap: space.md, paddingBottom: space.xs },
  prose: { maxWidth: 460 },
  coverRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  /** Sits on the first line's optical centre, not the paragraph's. */
  pip: { width: 5, height: 5, borderRadius: 2.5, marginTop: 9 },
  coverText: { flex: 1 },
});
