import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { UNIT_INFO } from "../../content/units";
import type { DiagnosticUnit, RatingDraft } from "../../db/diagnostic";
import type { ThemeTokens } from "../../theme/colors";
import { space, type as typeScale } from "../../theme/tokens";
import { NumberDial } from "../number-dial/NumberDial";
import { AppText } from "../ui/AppText";
import { UnitInfoSheet } from "./UnitInfoSheet";

interface UnitRatingBlockProps {
  unit: DiagnosticUnit;
  draft: RatingDraft;
  onChange: (field: "importance" | "satisfaction", value: number) => void;
  accent: string;
  theme: ThemeTokens;
  reduceMotion: boolean;
}

/** One unit's name, info button, and its two rating dials. */
export function UnitRatingBlock({
  unit,
  draft,
  onChange,
  accent,
  theme,
  reduceMotion,
}: UnitRatingBlockProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const info = UNIT_INFO[unit.id];

  return (
    <View style={[styles.block, { borderTopColor: theme.hairline }]}>
      <View style={styles.nameRow}>
        <View style={styles.nameGroup}>
          <AppText variant="headline" color={theme.ink} style={styles.name}>
            {unit.name}
          </AppText>
          {info ? (
            <Pressable
              onPress={() => setInfoOpen(true)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`About ${unit.name}`}
              style={({ pressed }) => [
                styles.infoButton,
                { borderColor: theme.hairline, opacity: pressed ? 0.5 : 1 },
              ]}
            >
              <Text style={[styles.infoGlyph, { color: theme.muted }]}>i</Text>
            </Pressable>
          ) : null}
        </View>
        {!unit.includeInScoring ? (
          <AppText variant="caption" color={theme.muted}>
            not scored
          </AppText>
        ) : null}
      </View>

      <NumberDial
        label="Priority"
        a11yName={`${unit.name} — Priority`}
        value={draft.importance}
        onChange={(v) => onChange("importance", v)}
        accent={accent}
        theme={theme}
        reduceMotion={reduceMotion}
      />
      <NumberDial
        label="Satisfaction"
        a11yName={`${unit.name} — Satisfaction`}
        value={draft.satisfaction}
        onChange={(v) => onChange("satisfaction", v)}
        accent={accent}
        theme={theme}
        reduceMotion={reduceMotion}
      />

      {info ? (
        <UnitInfoSheet
          visible={infoOpen}
          onClose={() => setInfoOpen(false)}
          unitName={unit.name}
          info={info}
          accent={accent}
          theme={theme}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space.md,
    paddingVertical: space.lg + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: -space.xs,
  },
  nameGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flexShrink: 1,
  },
  name: { flexShrink: 1 },
  infoButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoGlyph: {
    ...typeScale.footnote,
    fontWeight: "600",
    fontStyle: "italic",
    lineHeight: 13,
  },
});
