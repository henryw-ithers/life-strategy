import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { suggestTags } from "../../content/tagKeywords";
import type { ActivitySize } from "../../db/activityCredit";
import type { DayKind } from "../../db/today";
import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

export interface TagUnit {
  id: string;
  name: string;
  areaId: string;
}

export interface ExistingActivity {
  id: string;
  title: string;
  note: string | null;
  size: ActivitySize | null;
  tagUnitIds: string[];
}

interface ActivitySheetProps {
  visible: boolean;
  dayKind: DayKind;
  units: TagUnit[];
  /** When set, the sheet edits this activity instead of logging new. */
  existing?: ExistingActivity | null;
  theme: ThemeTokens;
  onClose: () => void;
  onCommit: (
    title: string,
    note: string | null,
    size: ActivitySize | null,
    unitIds: string[],
  ) => void;
  /** Edit mode only. */
  onDelete?: () => void;
}

/** Qualitative sizing (ADR-0009 amendment): felt significance, no
 *  clock. Credit rates unchanged: 25% / 50% / 100% of unit weight. */
const SIZE_OPTIONS: { size: ActivitySize | null; label: string }[] = [
  { size: "quick", label: "A little" },
  { size: "normal", label: "Fairly" },
  { size: "big", label: "Very" },
  { size: null, label: "Just log it" },
];

/**
 * Log or edit a spontaneous activity (ADR-0009): title, suggested unit
 * tags (up to 3), and how significant it was. On rest and special days
 * everything logs creditlessly. Keyboard handling runs on the UI
 * thread (useAnimatedKeyboard) — KeyboardAvoidingView inside a Modal
 * fought the slide-in animation and flickered on device.
 */
export function ActivitySheet({
  visible,
  dayKind,
  units,
  existing,
  theme,
  onClose,
  onCommit,
  onDelete,
}: ActivitySheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const keyboard = useAnimatedKeyboard();
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<ActivitySize | null>("normal");
  const [tags, setTags] = useState<string[]>([]);
  const tagsTouched = useRef(false);
  const titleRef = useRef<TextInput>(null);
  const creditless = dayKind !== "normal";
  const editing = existing != null;

  const keyboardStyle = useAnimatedStyle(() => ({
    paddingBottom:
      insets.bottom +
      space.lg +
      Math.max(keyboard.height.value - insets.bottom, 0),
  }));

  useEffect(() => {
    if (visible) {
      setTitle(existing?.title ?? "");
      setSize(existing ? existing.size : "normal");
      setTags(existing?.tagUnitIds ?? []);
      // Editing an activity must never auto-rewrite its tags.
      tagsTouched.current = editing;
    }
  }, [visible, existing, editing]);

  // Suggestions track the title until the user edits tags by hand.
  const onTitleChange = (next: string) => {
    setTitle(next);
    if (!tagsTouched.current) {
      setTags(suggestTags(next).filter((id) => units.some((u) => u.id === id)));
    }
  };

  const toggleTag = (unitId: string) => {
    tagsTouched.current = true;
    void Haptics.selectionAsync();
    setTags((prev) =>
      prev.includes(unitId)
        ? prev.filter((t) => t !== unitId)
        : prev.length >= 3
          ? prev
          : [...prev, unitId],
    );
  };

  const commit = () => {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    // Notes on activities are legacy data; edits pass them through.
    onCommit(trimmed, existing?.note ?? null, creditless ? null : size, tags);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
      // Focus after the slide-in settles; autoFocus mid-animation makes
      // the keyboard and sheet fight each other.
      onShow={() => {
        if (!editing) setTimeout(() => titleRef.current?.focus(), 80);
      }}
    >
      <SheetFrame onClose={onClose}>
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.canvas, borderColor: theme.hairline },
          keyboardStyle,
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.hairline }]} />
        <AppText variant="title" color={theme.ink}>
          {editing ? "Edit activity" : "Log an activity"}
        </AppText>

        <ScrollView
          style={{ maxHeight: Math.round(windowH * 0.5) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.fields}>
            <TextInput
              ref={titleRef}
              value={title}
              accessibilityLabel="What you did"
              onChangeText={onTitleChange}
              placeholder="e.g. Round of golf with Dad"
              placeholderTextColor={theme.muted}
              returnKeyType="done"
              style={[
                styles.input,
                { backgroundColor: theme.surface, color: theme.ink },
              ]}
            />

            <View style={styles.block}>
              <AppText variant="caption" color={theme.muted}>
                Where it counts · up to 3
              </AppText>
              <View style={styles.chips}>
                {units.map((u) => {
                  const selected = tags.includes(u.id);
                  const hue = theme.areas[u.areaId] ?? theme.accent;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => toggleTag(u.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={u.name}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? `${hue}1f` : theme.surface,
                          borderColor: selected ? hue : "transparent",
                        },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        color={selected ? theme.ink : theme.muted}
                      >
                        {u.name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.block}>
              <AppText variant="caption" color={theme.muted}>
                {creditless
                  ? dayKind === "rest"
                    ? "Day off. This logs without credit."
                    : "Special day. This logs as part of the story."
                  : "How significant was it?"}
              </AppText>
              {!creditless ? (
                <View style={styles.chips}>
                  {SIZE_OPTIONS.map((opt) => {
                    const selected = size === opt.size;
                    return (
                      <Pressable
                        key={opt.label}
                        onPress={() => setSize(opt.size)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected
                              ? `${theme.accent}1f`
                              : theme.surface,
                            borderColor: selected ? theme.accent : "transparent",
                          },
                        ]}
                      >
                        <AppText
                          variant="caption"
                          color={selected ? theme.ink : theme.muted}
                        >
                          {opt.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>

        <Button
          label={editing ? "Save changes" : "Log it"}
          disabled={title.trim().length === 0}
          onPress={commit}
          theme={theme}
        />
        {editing && onDelete ? (
          <Pressable
            onPress={() => {
              // Deleting erases a line of the life log — same stakes as
              // archiving a task, so it gets the same confirm.
              Alert.alert("Delete this activity?", "It leaves the day's record.", [
                { text: "Keep", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    onDelete();
                    onClose();
                  },
                },
              ]);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.delete, { opacity: pressed ? 0.5 : 1 }]}
          >
            <AppText variant="label" color={theme.danger}>
              Delete activity
            </AppText>
          </Pressable>
        ) : (
          <Button label="Cancel" variant="quiet" onPress={onClose} theme={theme} />
        )}
      </Animated.View>
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
  fields: { gap: space.lg },
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  block: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.md,
    minHeight: 34,
    justifyContent: "center",
  },
  delete: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
