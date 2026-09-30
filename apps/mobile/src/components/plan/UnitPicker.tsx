/**
 * Choosing which units a task serves (ADR-0019).
 *
 * Chips rather than a nested list or a second modal: the whole point of
 * the change is that linking a second unit should cost one tap, and
 * anything that opens a new surface to do it has already lost. The
 * home unit — the one the task is listed under — is whichever chip is
 * selected first, and it's labelled so that isn't a hidden rule.
 *
 * Every chip carries its area's hue as a leading dot, and keeps it
 * whether or not it's selected. Eighteen identically-toned chips in a
 * horizontal scroller are unreadable at rest — with the dots you scroll
 * past six runs of colour and know roughly where you are.
 *
 * Selection reads as a **wash plus a hue border**, the same as the
 * weekday chips and the part-of-day segments below it: one selection
 * language for the whole sheet, and no caption text on a solid area
 * hue, which is under AA on four of the six in light theme (see
 * `wash`). Nothing about the chip's size changes when it's picked, so
 * selecting one never re-flows the row.
 *
 * When the sheet opens with a unit already chosen, the row scrolls that
 * chip into view: it sits fourteen chips along often enough that the
 * default view showed nothing selected and read as unset.
 */
import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { wash, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { COMMUNAL_TASK_NOTE } from "./planning";
import { canPick, selectUnit, type PickableUnit } from "./unitSelection";

export type { PickableUnit } from "./unitSelection";

interface UnitPickerProps {
  units: PickableUnit[];
  /** Selected ids, in selection order; index 0 is the home unit. */
  value: string[];
  onChange: (next: string[]) => void;
  theme: ThemeTokens;
  areaColors: Record<string, string>;
  /** Cap; a task serving everything is a task serving nothing. */
  max?: number;
}

const DEFAULT_MAX = 3;

export function UnitPicker({
  units,
  value,
  onChange,
  theme,
  areaColors,
  max = DEFAULT_MAX,
}: UnitPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  /** Only the unit the picker opened with; re-scrolling on every tap
   *  would move the row out from under the finger that just tapped. */
  const openedWith = useRef(value[0]);
  const revealed = useRef(false);

  const reveal = (id: string, x: number) => {
    if (revealed.current || id !== openedWith.current) return;
    revealed.current = true;
    // The chip's layout lands before the row can scroll; one frame on,
    // the ScrollView has its content and the offset takes.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: Math.max(0, x - space.lg), animated: false });
    });
  };

  /**
   * The last chip clears like any other. It used to be locked, on the
   * grounds that a task must live somewhere — but the sheet can now
   * open with nothing chosen, and a locked first pick means the wrong
   * tap can't be taken back. The rule it enforced still holds; it's
   * enforced where it belongs, on the button that commits.
   */
  const toggle = (id: string) => onChange(selectUnit(value, id, units, max));

  const atMax = value.length >= max;
  /** Listed under a commitment: everything else picked is a note. */
  const homeIsCommitment =
    units.find((u) => u.id === value[0])?.commitment === true;

  return (
    <View style={styles.root}>
      <View style={styles.headingRow}>
        <AppText variant="caption" color={theme.muted}>
          {homeIsCommitment
            ? "Commitment"
            : value.length > 1
              ? "Counts toward"
              : "Unit"}
        </AppText>
        {value.length === 0 ? (
          <AppText variant="footnote" color={theme.muted}>
            Pick where it’s listed
          </AppText>
        ) : homeIsCommitment && value.length > 1 ? (
          // Says what the other chips do, because it is not what they
          // do on a life task: they record where this touches your life
          // and earn nothing there (ADR-0029 §3).
          <AppText variant="footnote" color={theme.muted} style={styles.hint}>
            Paid from {nameOf(units, value[0])} · also noted in{" "}
            {value.slice(1).map((id) => nameOf(units, id)).join(", ")}
          </AppText>
        ) : homeIsCommitment ? (
          <AppText variant="footnote" color={theme.muted}>
            Paid from its share of a scheduled day
          </AppText>
        ) : value.length > 1 ? (
          <AppText variant="footnote" color={theme.muted}>
            Earns from each · listed under {nameOf(units, value[0])}
          </AppText>
        ) : null}
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {units.map((u) => {
          const index = value.indexOf(u.id);
          const selected = index >= 0;
          const hue = areaColors[u.areaId] ?? theme.accent;
          const blocked = !canPick(value, u.id, units, max);
          return (
            <Pressable
              key={u.id}
              onLayout={(e) => reveal(u.id, e.nativeEvent.layout.x)}
              onPress={() => toggle(u.id)}
              disabled={blocked}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: blocked }}
              accessibilityLabel={
                selected && index === 0
                  ? `${u.name}, listed under this ${u.commitment ? "commitment" : "unit"}`
                  : selected && homeIsCommitment
                    ? `${u.name}, noted only`
                    : u.name
              }
              style={({ pressed }) => [
                styles.chip,
                {
                  // A wash with an Ink label, matching the weekday and
                  // part-of-day chips beneath it — a solid hue behind
                  // caption text is under AA on four of the six area
                  // colours in light theme (see `wash`). The border is
                  // what carries "selected" at a glance.
                  backgroundColor: selected ? wash(hue, theme) : theme.surface,
                  borderColor: selected ? hue : theme.hairline,
                  borderWidth: selected ? 1 : StyleSheet.hairlineWidth,
                  opacity: blocked ? 0.35 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: hue }]} />
              <AppText
                variant="caption"
                color={selected ? theme.ink : theme.muted}
                numberOfLines={1}
                style={styles.chipLabel}
              >
                {u.name}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      {atMax ? (
        <AppText variant="footnote" color={theme.muted}>
          Up to {max} units — past that, it isn’t really one task.
        </AppText>
      ) : null}
      {/* A nudge, not a gate (ADR-0027 §4). Appears only once a
          communal unit is actually picked, so it reads as a response to
          the choice rather than a warning label on the control. */}
      {units.some(
        (u) => value.includes(u.id) && u.motivationKind === "communal",
      ) ? (
        <AppText variant="footnote" color={theme.muted}>
          {COMMUNAL_TASK_NOTE}
        </AppText>
      ) : null}
    </View>
  );
}

function nameOf(units: PickableUnit[], id: string | undefined): string {
  return units.find((u) => u.id === id)?.name ?? "";
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  headingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.sm,
  },
  chips: { gap: space.sm, paddingRight: space.sm },
  /** 32pt drawn, 44pt tappable — the chip carries `hitSlop` to make up
   *  the difference, so shrinking the row costs nothing at the finger. */
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 160,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { flexShrink: 1 },
  hint: { flexShrink: 1, textAlign: "right" },
});
