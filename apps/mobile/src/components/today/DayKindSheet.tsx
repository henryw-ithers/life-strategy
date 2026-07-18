import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DayKind } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { NumberDial } from "../number-dial/NumberDial";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

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

const KIND_OPTIONS: { kind: DayKind; label: string; detail: string }[] = [
  { kind: "normal", label: "Normal day", detail: "Graded on your tasks." },
  {
    kind: "rest",
    label: "Rest day",
    detail: "Nothing counts today; anything you do still logs.",
  },
  {
    kind: "special",
    label: "Special day",
    detail: "The day gets its own story, and you rate how it was.",
  },
];

/** Declare what a day is (ADR-0004 §3): normal, rest, or special —
 *  special days carry a title and a 1–10 satisfaction rating. */
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
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
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
