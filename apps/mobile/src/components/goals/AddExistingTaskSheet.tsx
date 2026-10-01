/**
 * Pull a task you already have into a goal, or into one of its
 * conditions (ADR-0030 §§1–2).
 *
 * **The half that was missing.** A goal could only ever gain a task by
 * creating a new one from inside it, which quietly assumed the work
 * did not already exist. It usually does: you write "Lights out by
 * eleven" under Sleep & recovery in week one, and in week three you
 * decide your goal leans on it. Making people retype it — or send them
 * to the Plan screen to change a goal field they would have to know
 * about — is the app asking them to understand its schema.
 *
 * **Any unit, not just the goal's** (ADR-0030 §2). That is the whole
 * point of conditions: a career goal can lean on sleep. The pip and
 * unit name on every row say where each task counts, because attaching
 * it here does not move a single point — it still earns from its own
 * unit's weight.
 *
 * A task already serving another goal is offered, marked. Moving work
 * between goals is a legitimate thing to want, and hiding those rows
 * would leave a person hunting for a task the app could see perfectly
 * well.
 */
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { wash, type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { SheetFrame } from "../ui/SheetFrame";
import { formatFrequency } from "../plan/frequency";

export interface AttachableTask {
  id: string;
  title: string;
  timesPerWeek: number;
  unitId: string;
  unitName: string;
  areaId: string;
  /** The goal it currently serves, if any — shown so moving work
   *  between goals is a visible act rather than a silent one. */
  servingGoalTitle: string | null;
}

interface AddExistingTaskSheetProps {
  visible: boolean;
  tasks: AttachableTask[];
  /** Where it will land. Null means the goal itself, outside any
   *  condition — the sheet says which, so the tap is unambiguous. */
  conditionTitle: string | null;
  areaColors: Record<string, string>;
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  onPick: (taskId: string) => void;
}

export function AddExistingTaskSheet({
  visible,
  tasks,
  conditionTitle,
  areaColors,
  accent,
  theme,
  onClose,
  onPick,
}: AddExistingTaskSheetProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  // A full plan runs to a few dozen tasks across eighteen units, which
  // is past the point where scanning beats typing.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || t.unitName.toLowerCase().includes(q),
    );
  }, [tasks, query]);

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
            Add a task you already have
          </AppText>
          <AppText variant="caption" color={theme.muted}>
            {conditionTitle
              ? `It joins “${conditionTitle}”, and keeps earning from its own unit.`
              : "It joins this goal, and keeps earning from its own unit."}
          </AppText>

          {tasks.length > 0 ? (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your plan"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Search your tasks"
              autoCorrect={false}
              returnKeyType="search"
              style={[
                styles.search,
                { backgroundColor: theme.surface, color: theme.ink },
              ]}
            />
          ) : null}

          <ScrollView
            style={styles.scroller}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {tasks.length === 0 ? (
              <AppText variant="caption" color={theme.muted}>
                Every task in your plan already serves this goal. Adding a new
                one is the move now.
              </AppText>
            ) : matches.length === 0 ? (
              <AppText variant="caption" color={theme.muted}>
                Nothing in your plan matches “{query.trim()}”.
              </AppText>
            ) : null}

            {matches.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => onPick(t.id)}
                accessibilityRole="button"
                accessibilityLabel={`${t.title}, ${t.unitName}, ${formatFrequency(
                  t.timesPerWeek,
                )}${t.servingGoalTitle ? `, currently serving ${t.servingGoalTitle}` : ""}`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: pressed ? wash(accent, theme) : theme.surface,
                    borderColor: theme.hairline,
                  },
                ]}
              >
                <AppText color={theme.ink} numberOfLines={2}>
                  {t.title}
                </AppText>
                <View style={styles.meta}>
                  <View
                    style={[
                      styles.pip,
                      { backgroundColor: areaColors[t.areaId] ?? theme.muted },
                    ]}
                  />
                  <AppText variant="footnote" color={theme.muted}>
                    {t.unitName} · {formatFrequency(t.timesPerWeek)}
                  </AppText>
                </View>
                {t.servingGoalTitle ? (
                  <AppText variant="footnote" color={theme.muted}>
                    Currently under “{t.servingGoalTitle}” — it will move here.
                  </AppText>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
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
    maxHeight: "88%",
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  search: {
    ...typeScale.body,
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    marginTop: space.xs,
  },
  scroller: { flexGrow: 0 },
  body: { gap: space.sm, paddingVertical: space.md },
  /** Tappable in full, like the library's own cards: the whole row is
   *  the button, so a task costs one tap wherever the thumb lands. */
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.xs,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs },
  pip: { width: 7, height: 7, borderRadius: 4 },
});
