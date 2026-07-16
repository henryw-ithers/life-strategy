import { StyleSheet, Text, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
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
            <Text style={[styles.name, { color: theme.ink }]} numberOfLines={1}>
              {point.name}
            </Text>
          </View>
          <Text style={[styles.detail, { color: theme.muted }]}>
            Importance {point.importance} · Satisfaction {point.satisfaction} ·{" "}
            {effortLabel(point.effort)}
            {point.includeInScoring ? "" : " · not scored"}
          </Text>
        </>
      ) : (
        <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 56, justifyContent: "center", gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  detail: { fontSize: 14 },
  hint: { fontSize: 14 },
});
