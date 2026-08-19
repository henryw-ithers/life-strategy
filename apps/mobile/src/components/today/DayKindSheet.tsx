import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DayKind } from "../../db/today";
import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { NumberDial } from "../number-dial/NumberDial";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

interface DayKindSheetProps {
  visible: boolean;
  /** "today" or a spoken date, for the sheet title. */
  dayLabel: string;
  kind: DayKind;
  title: string | null;
  satisfactionRating: number | null;
  theme: ThemeTokens;
  reduceMotion: boolean;
  onClose: () => void;
  onCommit: (
    kind: DayKind,
    opts: { title?: string | null; satisfactionRating?: number | null },
  ) => void;
}

/**
 * The three kinds divide by the question each one asks (ADR-0023 §4),
 * not by scoring mechanics. "Day off" is the widest of them on
 * purpose: it covers rest, illness, travel, a wedding, a funeral —
 * anything where grading isn't a meaningful question. It carries the
 * load that special days used to, so its description names the range
 * rather than leaving "rest" to imply leisure.
 *
 * The stored value is still `rest`; the rename is a label
 * (ADR-0021's reasoning), so no migration.
 */
const KIND_OPTIONS: { kind: DayKind; label: string; detail: string }[] = [
  { kind: "normal", label: "Normal day", detail: "Graded on your tasks." },
  {
    kind: "special",
    label: "Special day",
    detail:
      "Still graded on your tasks, plus a bit for how the day was. It gets its own story.",
  },
  {
    kind: "rest",
    label: "Day off",
    detail:
      "Rest, illness, travel, a wedding, a funeral — no grade at all. Anything you do still logs.",
  },
];

/** Declare what a day is (ADR-0004 §3, ADR-0023 §4): normal, special,
 *  or a day off — special days carry a title and a 1–10 rating, which
 *  now tops up the day's grade rather than replacing it. */
export function DayKindSheet({
  visible,
  dayLabel,
  kind,
  title,
  satisfactionRating,
  theme,
  reduceMotion,
  onClose,
  onCommit,
}: DayKindSheetProps) {
  const insets = useSafeAreaInsets();
  const [chosen, setChosen] = useState<DayKind>(kind);
  const [specialTitle, setSpecialTitle] = useState(title ?? "");
  const [rating, setRating] = useState<number | null>(satisfactionRating);

  // Re-sync with the day each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setChosen(kind);
      setSpecialTitle(title ?? "");
      setRating(satisfactionRating);
    }
  }, [visible, kind, title, satisfactionRating]);

  const commit = () => {
    onCommit(chosen, {
      title: specialTitle.trim().length > 0 ? specialTitle.trim() : null,
      satisfactionRating: rating,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SheetFrame onClose={onClose} avoidsKeyboard>
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
          <AppText variant="title" color={theme.ink}>
            What kind of day is {dayLabel}?
          </AppText>

          <View style={styles.options}>
            {KIND_OPTIONS.map((opt) => {
              const selected = chosen === opt.kind;
              return (
                <Pressable
                  key={opt.kind}
                  onPress={() => setChosen(opt.kind)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: selected ? `${theme.accent}14` : theme.surface,
                      borderColor: selected ? theme.accent : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <AppText variant="headline" color={theme.ink}>
                    {opt.label}
                  </AppText>
                  <AppText variant="caption" color={theme.muted}>
                    {opt.detail}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {chosen === "special" ? (
            <View style={styles.special}>
              <TextInput
                value={specialTitle}
                accessibilityLabel="What made it special"
                onChangeText={setSpecialTitle}
                placeholder="What made it special?"
                placeholderTextColor={theme.muted}
                returnKeyType="done"
                style={[
                  styles.input,
                  { backgroundColor: theme.surface, color: theme.ink },
                ]}
              />
              <NumberDial
                label="How was it?"
                a11yName="Day satisfaction"
                value={rating}
                onChange={setRating}
                accent={theme.accent}
                theme={theme}
                reduceMotion={reduceMotion}
              />
            </View>
          ) : null}

          <Button label="Save" onPress={commit} theme={theme} />
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
    gap: space.lg,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  options: { gap: space.sm },
  option: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: 2,
    minHeight: 64,
    justifyContent: "center",
  },
  special: { gap: space.md },
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
});
