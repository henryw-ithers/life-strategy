/**
 * How much of a scheduled day belongs to commitments (ADR-0032 §2).
 *
 * One number, 10 up to 60, 70 or 80 in fives — the ceiling rises with
 * each commitment (ADR-0032 §2) — and it is the most consequential setting
 * in the app — so the sheet **shows what it costs** rather than making
 * a person infer it from a percentage. Moving the stepper moves the
 * sentence underneath it, in real points, for a real task.
 *
 * A stepper rather than a slider: eleven stops is few enough that
 * discrete taps are faster and exact, a slider on a phone cannot be
 * driven to a precise value with a thumb, and the value is not a
 * continuous quantity — it snaps to fives either way (`normalizeBand`).
 *
 * The ceiling is the app having a mild opinion and the copy says so
 * plainly instead of letting the control just stop. A limit that
 * refuses without explaining reads as a bug.
 *
 * Since formula v10 a task's points are a property of the day (ADR-0029
 * §4), so the sheet shows what the *bands* become rather than what one
 * sample habit is worth: the band is that share of the day, and the
 * planned and unplanned bands are scaled into the rest.
 */
import {
  COMMITMENT_BAND_MIN,
  COMMITMENT_BAND_STEP,
  commitmentBandMax,
  PLANNED_BAND,
  UNPLANNED_BAND,
} from "@glide/scoring";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

const MIN = COMMITMENT_BAND_MIN;
const STEP = COMMITMENT_BAND_STEP;

/** A band's size on a day the commitment band has taken `band` of. */
function scaled(size: number, band: number): number {
  return Math.round((size * (100 - band)) / 100);
}

interface BandSheetProps {
  visible: boolean;
  /** Null when no band is set — every day is an ordinary two-band day. */
  band: number | null;
  /** How many commitments there are — the ceiling grows with them:
   *  60, 70, 80 for one, two, three (ADR-0032 §2). */
  commitments: number;
  onClose: () => void;
  onSave: (band: number | null) => void;
  theme: ThemeTokens;
}

export function BandSheet({
  visible,
  band,
  commitments,
  onClose,
  onSave,
  theme,
}: BandSheetProps) {
  const MAX = commitmentBandMax(commitments);
  const [value, setValue] = useState(Math.min(band ?? 40, MAX));
  const insets = useSafeAreaInsets();

  const step = (by: number) => {
    const next = Math.min(MAX, Math.max(MIN, value + by));
    if (next === value) return;
    void Haptics.selectionAsync();
    setValue(next);
  };

  const life = 100 - value;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SheetFrame onClose={onClose}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.canvas,
              paddingBottom: insets.bottom + space.lg,
            },
          ]}
        >
          <AppText variant="title" color={theme.ink}>
            Commitments
          </AppText>
          <AppText variant="body" color={theme.muted} style={styles.lede}>
            On a day with something scheduled, this much of the day belongs
            to your commitments. Days with nothing scheduled are unchanged.
          </AppText>

          <View style={[styles.stepper, { backgroundColor: theme.surface }]}>
            <Pressable
              onPress={() => step(-STEP)}
              disabled={value <= MIN}
              hitSlop={12}
              style={styles.stepButton}
              accessibilityRole="button"
              accessibilityLabel="Less"
              accessibilityState={{ disabled: value <= MIN }}
            >
              <AppText
                variant="title"
                color={value <= MIN ? theme.hairline : theme.accent}
              >
                −
              </AppText>
            </Pressable>

            <View style={styles.readout}>
              <AppText variant="display" color={theme.ink}>
                {value}%
              </AppText>
            </View>

            <Pressable
              onPress={() => step(STEP)}
              disabled={value >= MAX}
              hitSlop={12}
              style={styles.stepButton}
              accessibilityRole="button"
              accessibilityLabel="More"
              accessibilityState={{ disabled: value >= MAX }}
            >
              <AppText
                variant="title"
                color={value >= MAX ? theme.hairline : theme.accent}
              >
                +
              </AppText>
            </Pressable>
          </View>

          {/* What it costs, in points, for something the person owns.
              A percentage alone asks them to do this arithmetic in
              their head, and most will not. */}
          <View style={[styles.effect, { borderColor: theme.hairline }]}>
            <Row
              label="The rest of your life keeps"
              value={`${life}%`}
              theme={theme}
            />
            <Row
              label="Your own plan pays"
              value={`${scaled(PLANNED_BAND, value)} pts`}
              detail={`${PLANNED_BAND} pts on a free day`}
              theme={theme}
            />
            <Row
              label="Activities can add"
              value={`${scaled(UNPLANNED_BAND, value)} pts`}
              detail={`${UNPLANNED_BAND} pts on a free day`}
              theme={theme}
              last
            />
          </View>

          <AppText variant="caption" color={theme.muted} style={styles.note}>
            {value >= MAX
              ? commitments >= 3
                ? `${MAX}% is the most commitments can take, so the rest of your life always keeps at least ${100 - MAX}%.`
                : `${MAX}% is the most with ${commitments <= 1 ? "one commitment" : "two commitments"}, so the rest of your life keeps at least ${100 - MAX}%. Each commitment you add raises it by 10.`
              : "Nothing is scored differently on a day with no commitment work."}
          </AppText>

          <Button label="Save" onPress={() => onSave(value)} theme={theme} />
          {band !== null ? (
            <Button
              label="Turn off commitments scoring"
              variant="quiet"
              onPress={() => onSave(null)}
              theme={theme}
            />
          ) : null}
        </View>
      </SheetFrame>
    </Modal>
  );
}

function Row({
  label,
  value,
  detail,
  theme,
  last,
}: {
  label: string;
  value: string;
  detail?: string;
  theme: ThemeTokens;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        last === true ? null : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline },
      ]}
    >
      <View style={styles.grow}>
        <AppText variant="label" color={theme.ink}>
          {label}
        </AppText>
        {detail !== undefined ? (
          <AppText variant="caption" color={theme.muted}>
            {detail}
          </AppText>
        ) : null}
      </View>
      <AppText variant="headline" color={theme.ink}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.screen,
    paddingTop: space.xl,
    gap: space.md,
  },
  lede: { marginBottom: space.xs },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    paddingVertical: space.sm,
  },
  stepButton: {
    width: 64,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  readout: { flex: 1, alignItems: "center" },
  effect: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  grow: { flex: 1 },
  note: { marginTop: -space.xs },
});
