import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import type { UnitInfo } from "../../content/units";
import { type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";

interface UnitInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  /** After it has finished closing (`NativeSheet`). */
  onDismissed?: () => void;
  unitName: string;
  info: UnitInfo;
  accent: string;
  theme: ThemeTokens;
}

/** Bottom sheet: what a unit covers, and what success in it looks like. */
export function UnitInfoSheet({
  visible,
  onClose,
  onDismissed,
  unitName,
  info,
  accent,
  theme,
}: UnitInfoSheetProps) {
  const { height: windowH } = useWindowDimensions();

  return (
    <NativeSheet onDismissed={onDismissed} visible={visible} onClose={onClose} title={unitName} dismiss="done">
      {/* Scrolls inside a cap, so a long entry never runs off the sheet. */}
      <ScrollView style={{ maxHeight: Math.round(windowH * 0.7) }} showsVerticalScrollIndicator={false}>
      <AppText color={theme.ink}>
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
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
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
});
