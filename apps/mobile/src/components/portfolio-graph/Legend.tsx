import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";

export interface LegendArea {
  id: string;
  name: string;
}

interface LegendProps {
  areas: LegendArea[];
  focusAreaId: string | null;
  onToggle: (areaId: string | null) => void;
  theme: ThemeTokens;
}

/** Six area chips; tapping one focuses its bubbles and dims the rest. */
export function Legend({ areas, focusAreaId, onToggle, theme }: LegendProps) {
  return (
    <View style={styles.wrap}>
      {areas.map((area) => {
        const active = focusAreaId === area.id;
        const dimmed = focusAreaId !== null && !active;
        return (
          <Pressable
            key={area.id}
            onPress={() => onToggle(active ? null : area.id)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${area.name} area`}
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              { borderColor: active ? theme.muted : theme.hairline },
              active && { backgroundColor: theme.surface },
              dimmed && styles.dimmed,
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: theme.areas[area.id] ?? theme.muted },
              ]}
            />
            <Text style={[styles.label, { color: theme.ink }]} numberOfLines={1}>
              {area.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 13, fontWeight: "500" },
  dimmed: { opacity: 0.45 },
});
