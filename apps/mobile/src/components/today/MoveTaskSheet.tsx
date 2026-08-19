/**
 * Where a task sits today, and for how long (ADR-0024 §1 as amended
 * 2026-08-18).
 *
 * Two questions in one sheet, because they are one decision: which part
 * of the day, and whether that is the plan from now on or just how
 * today happens to go. Henry, 2026-08-18: *"we can have a quick prompt
 * to ask if they want this scheduling to be permanent or just for
 * today."*
 *
 * **Just today writes a `planned_occurrence`** — the table ADR-0024
 * created for exactly this and nothing had used. It is an intention,
 * not an obligation: an unfulfilled placement lapses silently, is never
 * counted, and no adherence statistic is derived from it (§2, which
 * this sheet is the first thing capable of violating).
 *
 * **From now on** rewrites the task's own `part_of_day`, which is the
 * same field the edit sheet sets — one value, two ways in.
 */
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ANYTIME_LABEL,
  PART_OF_DAY_LABEL,
  PART_OF_DAY_ORDER,
  type PartOfDay,
} from "../plan/planning";
import { wash, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

const SLOTS: readonly (PartOfDay | null)[] = [...PART_OF_DAY_ORDER, null];

interface MoveTaskSheetProps {
  visible: boolean;
  taskTitle: string;
  /** Where it sits now, so the current slot reads as current. */
  current: PartOfDay | null;
  /** Whether that came from a placement rather than from the task. */
  placedToday: boolean;
  /** "today" when the day in view is today, else the day's own name. */
  dayLabel: string;
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  onPick: (part: PartOfDay | null, scope: "today" | "always") => void;
  /** Only offered when a placement exists to clear. */
  onClearPlacement?: () => void;
}

export function MoveTaskSheet({
  visible,
  taskTitle,
  current,
  placedToday,
  dayLabel,
  accent,
  theme,
  onClose,
  onPick,
  onClearPlacement,
}: MoveTaskSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
        <AppText variant="title" color={theme.ink} numberOfLines={2}>
          {taskTitle}
        </AppText>
        <AppText variant="caption" color={theme.muted}>
          {placedToday
            ? `Moved for ${dayLabel} only. Its usual slot is unchanged.`
            : "When do you want to do this?"}
        </AppText>

        {SLOTS.map((slot) => {
          const on = slot === current;
          const label = slot ? PART_OF_DAY_LABEL[slot] : ANYTIME_LABEL;
          return (
            <View key={slot ?? "anytime"} style={styles.slot}>
              <View
                style={[
                  styles.slotHead,
                  {
                    backgroundColor: on ? wash(accent, theme) : "transparent",
                    borderColor: on ? accent : theme.hairline,
                  },
                ]}
              >
                <AppText color={on ? theme.ink : theme.muted}>{label}</AppText>
              </View>
              {/* Two scopes, side by side, so the choice is one tap and
                  never a second screen. The current slot still offers
                  both — moving Evening to Evening "from now on" is how
                  you make a temporary placement permanent. */}
              <View style={styles.scopes}>
                <View style={styles.grow}>
                  <Button
                    label={`Just ${dayLabel}`}
                    variant="secondary"
                    onPress={() => onPick(slot, "today")}
                    theme={theme}
                  />
                </View>
                <View style={styles.grow}>
                  <Button
                    label="From now on"
                    variant="quiet"
                    onPress={() => onPick(slot, "always")}
                    theme={theme}
                  />
                </View>
              </View>
            </View>
          );
        })}

        {placedToday && onClearPlacement ? (
          <Button
            label="Put it back where it usually goes"
            variant="quiet"
            onPress={onClearPlacement}
            theme={theme}
          />
        ) : null}
        <Button label="Cancel" variant="quiet" onPress={onClose} theme={theme} />
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
    gap: space.sm,
    maxHeight: "92%",
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  slot: { gap: space.xs, marginTop: space.xs },
  slotHead: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  scopes: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
});
