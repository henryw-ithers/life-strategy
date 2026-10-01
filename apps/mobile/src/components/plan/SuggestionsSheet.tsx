/**
 * The content library, finally reachable (ADR-0006 §1).
 *
 * Eighteen units, seventy-one goals and a hundred and ten tasks were
 * written by hand and shipped in `content/library.ts` — and until now
 * **nothing in the app imported it.** It was dead code you could only
 * read in the repo, which is the same as not having written it.
 *
 * **Pull, not push** (ADR-0006 §3). This opens from a unit you already
 * chose to look at, and it never interrupts: no badge, no prompt, no
 * "you should add a task" anywhere. A tool, not a taskmaster.
 *
 * Suggestions the plan already has are filtered out by title — the
 * library's ids are not stored on what it creates, deliberately: a task
 * is yours the moment it exists, and keeping a provenance link would
 * invite the app to reason about "library tasks" as a class later.
 * Title matching is the honest approximation, and its failure mode
 * (you renamed it, so it offers again) is harmless.
 *
 * Ordering follows the unit's own profile, never filtering by it: a
 * *maintenance* unit leads with maintenance ideas and still shows the
 * rest below. Withholding content the user could have browsed would
 * make a library into a recommender, which is a different product.
 */
import { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LIBRARY, type GoalTemplate, type TaskTemplate } from "../../content/library";
import { wash, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";
import { formatFrequency } from "./frequency";
import type { Profile } from "@glide/scoring";

interface SuggestionsSheetProps {
  visible: boolean;
  unitId: string;
  unitName: string;
  /** Null before the first diagnostic, when nothing has a profile yet. */
  profile: Profile | null;
  /** Titles already in the plan for this unit, so nothing is offered twice. */
  existingTaskTitles: string[];
  /** Goal titles already in this unit, same reason. */
  existingGoalTitles: string[];
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  onAddTask: (t: TaskTemplate) => void;
  onAddGoal: (g: GoalTemplate) => void;
}

/** Profile-matching entries first, everything else after, each group
 *  keeping the library's own order (tasks arrive pre-ranked). */
function byProfile<T extends { profiles: Profile[] }>(
  items: T[],
  profile: Profile | null,
): T[] {
  if (profile === null) return items;
  const matches = items.filter((i) => i.profiles.includes(profile));
  return [...matches, ...items.filter((i) => !matches.includes(i))];
}

const PROFILE_LABEL: Record<Profile, string> = {
  "gap-closing": "for closing a gap",
  maintenance: "for keeping it going",
  light: "light touch",
};

export function SuggestionsSheet({
  visible,
  unitId,
  unitName,
  profile,
  existingTaskTitles,
  existingGoalTitles,
  accent,
  theme,
  onClose,
  onAddTask,
  onAddGoal,
}: SuggestionsSheetProps) {
  const insets = useSafeAreaInsets();
  const entry = LIBRARY[unitId];

  const has = useMemo(
    () => new Set(existingTaskTitles.map((t) => t.trim().toLowerCase())),
    [existingTaskTitles],
  );
  const hasGoal = useMemo(
    () => new Set(existingGoalTitles.map((t) => t.trim().toLowerCase())),
    [existingGoalTitles],
  );

  const tasks = useMemo(
    () =>
      byProfile(
        (entry?.tasks ?? []).filter((t) => !has.has(t.title.trim().toLowerCase())),
        profile,
      ),
    [entry, has, profile],
  );
  const goals = useMemo(
    () =>
      byProfile(
        (entry?.goals ?? []).filter(
          (g) => !hasGoal.has(g.title.trim().toLowerCase()),
        ),
        profile,
      ),
    [entry, hasGoal, profile],
  );

  const nothingLeft = tasks.length === 0 && goals.length === 0;

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
        <AppText variant="title" color={theme.ink}>
          Ideas for {unitName}
        </AppText>
        <AppText variant="caption" color={theme.muted}>
          {profile
            ? `Written for this part of life, ${PROFILE_LABEL[profile]} first. Nothing is added until you pick it.`
            : "Written for this part of life. Nothing is added until you pick it."}
        </AppText>

        <ScrollView
          style={styles.scroller}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {nothingLeft ? (
            <AppText variant="caption" color={theme.muted}>
              {entry
                ? "You already have everything the library suggests here. Adding your own is the better move now."
                : "No suggestions written for this one yet."}
            </AppText>
          ) : null}

          {goals.length > 0 ? (
            <AppText variant="caption" color={theme.muted}>
              Goals
            </AppText>
          ) : null}
          {goals.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => onAddGoal(g)}
              accessibilityRole="button"
              accessibilityLabel={`Add goal: ${g.title}`}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: pressed ? wash(accent, theme) : theme.surface,
                  borderColor: theme.hairline,
                },
              ]}
            >
              <AppText color={theme.ink}>{g.title}</AppText>
              {g.description ? (
                <AppText variant="footnote" color={theme.muted}>
                  {g.description}
                </AppText>
              ) : null}
            </Pressable>
          ))}

          {tasks.length > 0 ? (
            <AppText variant="caption" color={theme.muted} style={styles.groupGap}>
              Tasks
            </AppText>
          ) : null}
          {tasks.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onAddTask(t)}
              accessibilityRole="button"
              accessibilityLabel={`Add task: ${t.title}, ${formatFrequency(t.timesPerWeek)}`}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: pressed ? wash(accent, theme) : theme.surface,
                  borderColor: theme.hairline,
                },
              ]}
            >
              <View style={styles.cardHead}>
                <AppText color={theme.ink} style={styles.grow}>
                  {t.title}
                </AppText>
                <AppText variant="caption" color={theme.muted}>
                  {formatFrequency(t.timesPerWeek)}
                </AppText>
              </View>
              {t.description ? (
                <AppText variant="footnote" color={theme.muted}>
                  {t.description}
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>

        <Button label="Done" variant="secondary" onPress={onClose} theme={theme} />
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
  scroller: { flexGrow: 0 },
  body: { gap: space.sm, paddingVertical: space.md },
  groupGap: { marginTop: space.md },
  /** Tappable in full: the whole card is the button, so a suggestion
   *  costs one tap wherever the thumb lands on it. */
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.xs,
  },
  cardHead: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  grow: { flex: 1 },
});
