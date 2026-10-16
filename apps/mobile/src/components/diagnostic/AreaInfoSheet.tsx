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
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import type { AreaInfo } from "../../content/areas";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";

interface AreaInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  /** After it has finished closing (`NativeSheet`). */
  onDismissed?: () => void;
  info: AreaInfo;
  /** The area's own hue, so the sheet is identifiably about that area. */
  accent: string;
  theme: ThemeTokens;
}

export function AreaInfoSheet({
  visible,
  onClose,
  onDismissed,
  info,
  accent,
  theme,
}: AreaInfoSheetProps) {
  const { height: windowH } = useWindowDimensions();

  return (
    <NativeSheet onDismissed={onDismissed} visible={visible} onClose={onClose} title={info.name} dismiss="done">
      {/* Scrolls inside a cap, so a long entry never runs off the sheet. */}
      <ScrollView
        style={{ maxHeight: Math.round(windowH * 0.7) }}
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
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.xs },
  prose: { maxWidth: 460 },
  coverRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  /** Sits on the first line's optical centre, not the paragraph's. */
  pip: { width: 5, height: 5, borderRadius: 2.5, marginTop: 9 },
  coverText: { flex: 1 },
});
