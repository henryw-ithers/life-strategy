import { StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { AppText } from "../ui/AppText";
import { effortLabel } from "./geometry";
import type { GraphPoint } from "./types";

interface CalloutProps {
  point: GraphPoint | null;
  hint: string;
  theme: ThemeTokens;
}

/**
 * Selection readout above the plot. Reserved height so the canvas
 * never jumps when selection changes.
 */
export function Callout({ point, hint, theme }: CalloutProps) {
  return (
    <View style={styles.wrap}>
      {point ? (
        <>
          <View style={styles.titleRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: theme.areas[point.areaId] ?? theme.muted },
              ]}
            />
            <AppText
              variant="headline"
              color={theme.ink}
              numberOfLines={1}
              style={styles.name}
            >
              {point.name}
            </AppText>
          </View>
          <AppText variant="caption" color={theme.muted} tabular>
            Priority {point.importance} · Satisfaction {point.satisfaction} ·{" "}
            {effortLabel(point.effort)}
            {point.includeInScoring ? "" : " · not scored"}
          </AppText>
        </>
      ) : (
        <AppText variant="caption" color={theme.muted}>
          {hint}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 56, justifyContent: "center", gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { flexShrink: 1 },
});
