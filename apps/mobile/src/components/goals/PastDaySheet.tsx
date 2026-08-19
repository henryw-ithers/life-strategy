/**
 * When did this actually happen? (ADR-0015 §5.)
 *
 * Milestones are frequently noticed late — "I passed 185 a few weeks
 * ago" — and recording one on the day it was *typed* would put a false
 * entry in the log of a life, which is the one thing that log is for.
 *
 * Past days only. There is no future half and no time of day: this
 * records something that already happened, and the app owns no clocks
 * (ADR-0024 §1).
 */
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { wash, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `'YYYY-MM-DD'` for a year/month/day, without constructing a local
 *  Date — the same positional-read rule `local_date` exists to enforce
 *  (ADR-0002). */
function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

interface PastDaySheetProps {
  visible: boolean;
  title: string;
  /** Today, `'YYYY-MM-DD'`. Nothing after this is selectable. */
  today: string;
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  onPick: (localDate: string) => void;
}

export function PastDaySheet({
  visible,
  title,
  today,
  accent,
  theme,
  onClose,
  onPick,
}: PastDaySheetProps) {
  const insets = useSafeAreaInsets();
  const ty = Number(today.slice(0, 4));
  const tm = Number(today.slice(5, 7));
  const td = Number(today.slice(8, 10));

  // This month and the two before it. Far enough for "a few weeks
  // ago", which is the case this exists for; anything older is a
  // different kind of record and can keep today's date.
  const months = [0, 1, 2].map((back) => {
    const raw = tm - back;
    return raw > 0 ? { y: ty, m: raw } : { y: ty - 1, m: raw + 12 };
  });

  const [sel, setSel] = useState<{ y: number; m: number }>(months[0]!);
  const [day, setDay] = useState<number>(td);

  const isCurrentMonth = sel.y === ty && sel.m === tm;
  const lastDay = isCurrentMonth ? td : daysInMonth(sel.y, sel.m);
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);

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
        <View style={styles.head}>
          <AppText variant="title" color={theme.ink}>
            When did this happen?
          </AppText>
          <AppText variant="footnote" color={theme.muted} numberOfLines={2}>
            {title}
          </AppText>
        </View>

        <Button
          label="Today"
          color={accent}
          onPress={() => {
            onPick(today);
            onClose();
          }}
          theme={theme}
        />

        <View style={styles.monthRow}>
          {months.map((mo) => {
            const on = mo.y === sel.y && mo.m === sel.m;
            return (
              <Pressable
                key={`${mo.y}-${mo.m}`}
                onPress={() => {
                  setSel(mo);
                  // Clamp: 31 is not a day in every month, and today
                  // is the ceiling in the current one.
                  const max =
                    mo.y === ty && mo.m === tm ? td : daysInMonth(mo.y, mo.m);
                  setDay((d) => Math.min(d, max));
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${MONTH_SHORT[mo.m - 1]} ${mo.y}`}
                style={({ pressed }) => [
                  styles.monthChip,
                  pressed && { opacity: 0.7 },
                  {
                    backgroundColor: on ? wash(accent, theme) : theme.surface,
                    borderColor: on ? accent : theme.hairline,
                  },
                ]}
              >
                <AppText variant="caption" color={theme.ink}>
                  {MONTH_SHORT[mo.m - 1]}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView style={styles.dayScroller} showsVerticalScrollIndicator={false}>
          <View style={styles.dayGrid}>
            {days.map((d) => {
              const on = d === day;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDay(d)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${d} ${MONTH_SHORT[sel.m - 1]}`}
                  style={({ pressed }) => [
                    styles.dayChip,
                    pressed && { opacity: 0.7 },
                    {
                      backgroundColor: on ? wash(accent, theme) : theme.surface,
                      borderColor: on ? accent : "transparent",
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    color={theme.ink}
                    tabular
                  >
                    {d}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Button
          label={`Use ${day} ${MONTH_SHORT[sel.m - 1]}`}
          variant="quiet"
          onPress={() => {
            onPick(iso(sel.y, sel.m, day));
            onClose();
          }}
          theme={theme}
        />
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
    gap: space.lg,
    maxHeight: "86%",
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  head: { gap: 2 },
  monthRow: { flexDirection: "row", gap: space.sm },
  monthChip: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayScroller: { flexGrow: 0, maxHeight: 200 },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  dayChip: {
    // Seven across at any phone width, without a breakpoint.
    flexGrow: 1,
    flexBasis: "11%",
    minWidth: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
