/**
 * One listed event or task: its name, then when and where.
 *
 * Shared by the Tasks tab and the commitment screens (Henry, 2026-10-02:
 * "why would the shape or functionality of events change based on if
 * it's in a commitment or not?"). An event reads the same wherever it
 * is filed — "Mon, Wed · 09:00–11:00 · Room 101" — and opens the same
 * sheet.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatMinutes } from "@glide/scoring";
import { Pressable, StyleSheet, View } from "react-native";

import { spokenDate } from "../../lib/format";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { formatFrequencyShort } from "./frequency";
import { formatWeekdaySummary, parseWeekdays } from "./planning";

/** What a row needs to know about the event or task it shows. */
export interface ListedItem {
  id: string;
  title: string;
  timesPerWeek: number;
  plannedWeekdays: string | null;
  startMinute: number | null;
  endMinute: number | null;
  oneOffDate: string | null;
  oneOffSize: string | null;
  location: string | null;
}

/** "Mon, Wed · 09:00–11:00", or "Tuesday, 4 November · 09:00–11:00". */
export function eventWhen(e: ListedItem): string {
  const day = e.oneOffDate
    ? spokenDate(e.oneOffDate)
    : (formatWeekdaySummary(parseWeekdays(e.plannedWeekdays)) ?? "");
  const time =
    e.startMinute !== null && e.endMinute !== null
      ? `${formatMinutes(e.startMinute)}–${formatMinutes(e.endMinute)}`
      : "";
  return [day, time].filter(Boolean).join(" · ");
}

/** "3×/wk", "Mon, Thu", or a one-off's date. */
export function taskWhen(t: ListedItem): string {
  if (t.oneOffSize !== null) return t.oneOffDate ? spokenDate(t.oneOffDate) : "Any day";
  return (
    formatWeekdaySummary(parseWeekdays(t.plannedWeekdays)) ?? formatFrequencyShort(t.timesPerWeek)
  );
}

export function ItemRow({
  item,
  detail,
  onPress,
  onLongPress,
  theme,
  last,
}: {
  item: ListedItem;
  detail: string;
  onPress?: () => void;
  onLongPress?: () => void;
  theme: ThemeTokens;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        last
          ? null
          : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline },
        { opacity: pressed ? 0.6 : 1 },
      ]}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={[item.title, detail, item.location].filter(Boolean).join(", ")}
    >
      <View style={styles.grow}>
        <AppText color={theme.ink} numberOfLines={1}>
          {item.title}
        </AppText>
        <AppText variant="footnote" color={theme.muted} numberOfLines={1}>
          {[detail, item.location].filter(Boolean).join(" · ")}
        </AppText>
      </View>
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.muted}
          importantForAccessibility="no"
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    minHeight: 52,
  },
  grow: { flex: 1 },
});
