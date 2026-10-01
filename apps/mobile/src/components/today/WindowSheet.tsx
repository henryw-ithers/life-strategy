/**
 * What might go in this window (ADR-0033 §2).
 *
 * **Options, not an assignment.** The whole reason pools exist is that
 * planning one exact task into a window and then paying nothing when
 * you did a different one is a punishment for a plan that was only ever
 * a guess. So this picks a few things that would all count, and every
 * one of them is worth the same.
 *
 * **Three at most**, which is the cap the write path enforces and the
 * number Henry set: past three, choosing is its own chore and the point
 * of the window is lost. The limit says so rather than letting taps
 * stop working — a control that silently refuses reads as broken.
 *
 * **Planned count is a separate question**, and it is the honest one:
 * "how many of these do you mean to get through". A window big enough
 * for two is a window you should be paid twice for, and completing a
 * second member pays again (§3) — so the count divides the window's
 * share rather than capping what it can earn.
 *
 * Nothing here fills a window for you, ranks the options, or suggests
 * one. The app shows the gap; what goes in it is yours.
 */
import { formatMinutes, type Window } from "@glide/scoring";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MAX_POOL_MEMBERS } from "../../db/commitmentPlan";
import type { TodayTask } from "../../db/today";
import { wash, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";
import { formatLength, formatSpan } from "./dayGridLayout";

interface WindowSheetProps {
  visible: boolean;
  window: Window;
  /** Everything that could go in a window — this day's open tasks. */
  candidates: TodayTask[];
  /** Currently chosen, in order. */
  chosen: string[];
  /**
   * Unfinished options carried in from windows that have ended
   * (ADR-0033 §2). Shown, not chosen: they belong to the window they
   * were planned for, and appear here because this is now where they
   * can be done.
   */
  carried?: TodayTask[];
  plannedCount: number;
  hueFor: (task: TodayTask) => string;
  theme: ThemeTokens;
  accent: string;
  onToggle: (taskId: string) => void;
  onPlannedCountChange: (count: number) => void;
  onClose: () => void;
  onSave: () => void;
  /** Only offered once the window holds something to clear. */
  onClear?: () => void;
}

export function WindowSheet({
  visible,
  window,
  candidates,
  chosen,
  carried = [],
  plannedCount,
  hueFor,
  theme,
  accent,
  onToggle,
  onPlannedCountChange,
  onClose,
  onSave,
  onClear,
}: WindowSheetProps) {
  const insets = useSafeAreaInsets();
  const full = chosen.length >= MAX_POOL_MEMBERS;
  // Never more slots than there are options: a count above the members
  // would divide the window's share by slots the pool cannot fill.
  const maxCount = Math.max(1, chosen.length);
  const count = Math.min(plannedCount, maxCount);

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
              borderColor: theme.hairline,
              paddingBottom: insets.bottom + space.lg,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.hairline }]} />
          <AppText variant="title" color={theme.ink}>
            {formatSpan(window.start, window.end, formatMinutes)}
          </AppText>
          <AppText variant="caption" color={theme.muted}>
            {/* The cue, where there is one — "after the lecture" survives
                the lecture moving, where a clock time silently would
                not (ADR-0036 §3). */}
            {formatLength(window.end - window.start)} free. Pick what might
            go here; any of them counts.
          </AppText>

          {carried.length > 0 ? (
            // Stated as where the work is now, never as what was missed.
            <View style={[styles.carried, { backgroundColor: theme.surface }]}>
              <AppText variant="caption" color={theme.muted}>
                Also here from earlier today
              </AppText>
              {carried.map((t) => (
                <View key={t.id} style={styles.carriedRow}>
                  <View style={[styles.pip, { backgroundColor: hueFor(t) }]} />
                  <AppText color={theme.ink} numberOfLines={1} style={styles.grow}>
                    {t.title}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.list}>
            {candidates.length === 0 ? (
              <AppText variant="caption" color={theme.muted}>
                Nothing open to put here yet.
              </AppText>
            ) : (
              candidates.map((t) => {
                const on = chosen.includes(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => onToggle(t.id)}
                    // Disabled only for the ones you *cannot* add, and
                    // the line below says why — never a dead tap with
                    // no explanation.
                    disabled={!on && full}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: !on && full }}
                    accessibilityLabel={t.title}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: on ? wash(accent, theme) : theme.surface,
                        borderColor: on ? accent : "transparent",
                        opacity: pressed ? 0.6 : !on && full ? 0.4 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[styles.pip, { backgroundColor: hueFor(t) }]}
                    />
                    <AppText
                      color={theme.ink}
                      style={styles.grow}
                      numberOfLines={1}
                    >
                      {t.title}
                    </AppText>
                    <AppText variant="caption" color={theme.muted} tabular>
                      {t.pointValue}
                    </AppText>
                  </Pressable>
                );
              })
            )}
          </View>

          <AppText variant="footnote" color={theme.muted}>
            {full
              ? `Three is the most one window holds. Take one out to swap it.`
              : `${chosen.length} of ${MAX_POOL_MEMBERS} chosen.`}
          </AppText>

          {/* Only worth asking once there is more than one thing to
              choose between. On a single option it has one answer. */}
          {chosen.length > 1 ? (
            <View style={styles.countRow}>
              <View style={styles.grow}>
                <AppText color={theme.ink}>How many will you do?</AppText>
                <AppText variant="footnote" color={theme.muted}>
                  Doing another still pays — this only says what you are
                  planning for.
                </AppText>
              </View>
              <View style={[styles.stepper, { backgroundColor: theme.surface }]}>
                <Pressable
                  onPress={() => onPlannedCountChange(Math.max(1, count - 1))}
                  disabled={count <= 1}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Fewer"
                  accessibilityState={{ disabled: count <= 1 }}
                  style={styles.stepButton}
                >
                  <AppText
                    variant="headline"
                    color={count <= 1 ? theme.hairline : theme.accent}
                  >
                    −
                  </AppText>
                </Pressable>
                <AppText variant="headline" color={theme.ink} tabular>
                  {count}
                </AppText>
                <Pressable
                  onPress={() =>
                    onPlannedCountChange(Math.min(maxCount, count + 1))
                  }
                  disabled={count >= maxCount}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="More"
                  accessibilityState={{ disabled: count >= maxCount }}
                  style={styles.stepButton}
                >
                  <AppText
                    variant="headline"
                    color={count >= maxCount ? theme.hairline : theme.accent}
                  >
                    +
                  </AppText>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Button
            label="Save"
            color={accent}
            disabled={chosen.length === 0}
            onPress={onSave}
            theme={theme}
          />
          {onClear ? (
            <Button
              label="Leave this window open"
              variant="quiet"
              onPress={onClear}
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
  list: { gap: space.sm, marginTop: space.xs },
  carried: {
    gap: space.xs,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginTop: space.xs,
  },
  carriedRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 32 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  pip: { width: 8, height: 8, borderRadius: 4 },
  grow: { flex: 1 },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.xs,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    paddingHorizontal: space.xs,
  },
  stepButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
