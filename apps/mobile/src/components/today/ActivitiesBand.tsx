/**
 * The day's logged activities (ADR-0009) and the way to log another.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { type LinearTransition } from "react-native-reanimated";

import type { DayKind, TodayActivity } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { ActivityRow } from "./DayRecord";

export function ActivitiesBand({
  activities,
  dayKind,
  editable,
  onEdit,
  onAdd,
  layout,
  theme,
}: {
  activities: TodayActivity[];
  dayKind: DayKind;
  editable: boolean;
  onEdit: (activity: TodayActivity) => void;
  onAdd: () => void;
  layout: LinearTransition | undefined;
  theme: ThemeTokens;
}) {
  return (
    <Animated.View layout={layout} style={[styles.band, { borderTopColor: theme.hairline }]}>
      {activities.length > 0 ? (
        <AppText variant="caption" color={theme.muted}>
          Logged
        </AppText>
      ) : null}
      {activities.map((a) => (
        <ActivityRow
          key={a.id}
          activity={a}
          dayKind={dayKind}
          disabled={!editable}
          onPress={() => onEdit(a)}
          theme={theme}
        />
      ))}
      {editable ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          style={({ pressed }) => [styles.logButton, { opacity: pressed ? 0.5 : 1 }]}
        >
          <View style={styles.action}>
            <Ionicons name="add" size={15} color={theme.accent} />
            <AppText variant="label" color={theme.accent}>
              Log an activity
            </AppText>
          </View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Different content from the checklist, so it keeps the rule that
   *  says so. */
  band: {
    marginTop: space.xl,
    paddingTop: space.md,
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  logButton: { minHeight: 44, justifyContent: "center" },
  action: { flexDirection: "row", alignItems: "center", gap: 4 },
});
