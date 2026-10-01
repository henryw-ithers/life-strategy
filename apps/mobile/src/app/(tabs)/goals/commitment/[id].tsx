/**
 * One commitment: what is inside it, and how it ends.
 *
 * **Two endings, and the screen leads with the right one.** Finishing
 * is what happens to a commitment you actually held — the share returns
 * to the pool, the log keeps the term, and it can come back. Deleting
 * is for the mistyped one, and it sits last, quieter than everything
 * above it, behind a confirm that says what survives rather than only
 * what goes. That is the shape ADR-0007's deletion amendment settled
 * for goals, and a commitment holds more than a goal does, so it
 * matters more here.
 *
 * Laid out as the goal detail screen is — a back control, the name in
 * Display, then grouped rows — because it is the same kind of object
 * reached the same way, and a pushed screen that frames itself
 * differently reads as a different app.
 *
 * Every row is a target. Tapping a part renames it; tapping the share
 * opens the weight; there is no row here that looks live and is not.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CommitmentSheet,
  type CommitmentSheetMode,
} from "../../../../components/commitments/CommitmentSheet";
import { AddTaskModal } from "../../../../components/plan/AddTaskModal";
import {
  pickableUnits,
  type PickableUnit,
} from "../../../../components/plan/unitSelection";
import { AppText } from "../../../../components/ui/AppText";
import { Backdrop, hueWash } from "../../../../components/ui/Backdrop";
import { Button } from "../../../../components/ui/Button";
import { Group } from "../../../../components/ui/Group";
import {
  LoadFailure,
  useScreenLoad,
} from "../../../../components/ui/ScreenLoad";
import {
  loadCommitmentsScreen,
  type CommitmentDetail,
} from "../../../../db/commitments";
import {
  archiveCommitment,
  createSubCommitment,
  deleteCommitment,
  unarchiveCommitment,
  updateCommitment,
} from "../../../../db/commitmentWrites";
import { addTask, loadPlan } from "../../../../db/tasks";
import { getTheme, SCRIM } from "../../../../theme/colors";
import { radius, space } from "../../../../theme/tokens";

export default function CommitmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const accent = theme.areas["work-money"] ?? theme.accent;

  const [data, setData] = useState<CommitmentDetail | null>(null);
  const [others, setOthers] = useState<number[]>([]);
  const [sheet, setSheet] = useState<CommitmentSheetMode | null>(null);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  /** Everything a task can be filed under, for the add sheet. */
  const [units, setUnits] = useState<PickableUnit[]>([]);

  const reload = useCallback(async () => {
    const [screen, plan] = await Promise.all([loadCommitmentsScreen(), loadPlan()]);
    const all = [...screen.commitments, ...screen.archived];
    setData(all.find((c) => c.id === id) ?? null);
    setOthers(screen.commitments.filter((c) => c.id !== id).map((c) => c.share));
    setUnits(pickableUnits(plan));
  }, [id]);

  const { error, retry } = useScreenLoad(reload);
  const archived = data !== null && data.archivedAt !== null;

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={hueWash(accent)} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          // Pushed inside the Goals tab, so the bar still owns the
          // bottom inset and Back stays — a detail screen, not a
          // destination.
          { paddingTop: insets.top + space.md, paddingBottom: space.xxxl },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={styles.back}
        >
          <AppText variant="label" color={theme.muted}>
            ‹ Commitments
          </AppText>
        </Pressable>

        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : data === null ? (
          <ActivityIndicator
            color={theme.muted}
            style={{ marginTop: space.xxl }}
          />
        ) : (
          <>
            <AppText variant="display" color={theme.ink}>
              {data.name}
            </AppText>
            <AppText variant="label" color={accent} style={styles.status}>
              {archived
                ? "Finished"
                : `${data.sharePercent}% of what commitments are worth`}
            </AppText>

            {archived ? (
              <AppText
                variant="caption"
                color={theme.muted}
                style={styles.bannerNote}
              >
                Its tasks are paused and it takes no share of a day. Its
                history is untouched.
              </AppText>
            ) : null}

            <Group theme={theme} flush>
              <ActionRow
                label="Name"
                value={data.name}
                theme={theme}
                onPress={() =>
                  setSheet({
                    kind: "commitment",
                    name: data.name,
                    share: data.share,
                  })
                }
                last={archived}
              />
              {!archived ? (
                <ActionRow
                  label="Weight"
                  value={`${data.sharePercent}% of commitments`}
                  theme={theme}
                  onPress={() =>
                    setSheet({
                      kind: "commitment",
                      name: data.name,
                      share: data.share,
                    })
                  }
                  last
                />
              ) : null}
            </Group>

            <Group
              theme={theme}
              title="Parts"
              footnote={
                data.subCommitments.length === 0
                  ? "Classes, shifts, teams — whatever this splits into. They group your work; they do not change what it is worth."
                  : "They group your work. The day's share is split across your tasks, not across these."
              }
              flush
            >
              {data.subCommitments.length === 0 && archived ? (
                <View style={styles.emptyRow}>
                  <AppText variant="caption" color={theme.muted}>
                    Nothing inside it.
                  </AppText>
                </View>
              ) : null}
              {data.subCommitments.map((sub, i) => (
                <ActionRow
                  key={sub.id}
                  label={sub.name}
                  value={
                    sub.taskCount > 0
                      ? `${sub.taskCount} ${sub.taskCount === 1 ? "task" : "tasks"}`
                      : "No tasks"
                  }
                  theme={theme}
                  onPress={() => {
                    setEditingSubId(sub.id);
                    setSheet({
                      kind: "sub",
                      parentName: data.name,
                      name: sub.name,
                    });
                  }}
                  last={archived && i === data.subCommitments.length - 1}
                />
              ))}
              {!archived ? (
                <ActionRow
                  label="Add a part"
                  theme={theme}
                  accent={accent}
                  icon="add"
                  onPress={() => {
                    setEditingSubId(null);
                    setSheet({ kind: "sub", parentName: data.name });
                  }}
                  last
                />
              ) : null}
            </Group>

            {/* The way in that was missing: until this, a commitment
                could hold parts but there was nowhere in the app to put
                a single task in one. */}
            {!archived ? (
              <Group
                theme={theme}
                title="Tasks"
                footnote="Anything that repeats needs its days. It is paid from this share on the days it is scheduled."
                flush
              >
                {data.taskCount > 0 ? (
                  <ActionRow
                    label="See its tasks"
                    value={`${data.taskCount} ${data.taskCount === 1 ? "task" : "tasks"}`}
                    theme={theme}
                    onPress={() => router.push("/plan" as Href)}
                  />
                ) : null}
                <ActionRow
                  label="Add a task"
                  theme={theme}
                  accent={accent}
                  icon="add"
                  onPress={() => setAddingTask(true)}
                  last
                />
              </Group>
            ) : null}

            {data.directTaskCount > 0 ? (
              <AppText
                variant="footnote"
                color={theme.muted}
                style={styles.aside}
              >
                {data.directTaskCount}{" "}
                {data.directTaskCount === 1 ? "task sits" : "tasks sit"} on{" "}
                {data.name} itself, outside any part.
              </AppText>
            ) : null}

            <View style={styles.ending}>
              {archived ? (
                <Button
                  label="Start it again"
                  variant="secondary"
                  onPress={() => void unarchiveCommitment(data.id).then(reload)}
                  theme={theme}
                />
              ) : (
                <Button
                  label="Finish"
                  variant="secondary"
                  onPress={() => void archiveCommitment(data.id).then(reload)}
                  theme={theme}
                />
              )}
              <AppText variant="footnote" color={theme.muted}>
                {archived
                  ? "Its tasks come back and it takes a share of your day again."
                  : "Keeps everything and stops scoring it. You can start it again whenever."}
              </AppText>

              {/* Quieter than finishing, because for a commitment you
                  actually held, finishing is the honest end and this is
                  not. This is for the one you mistyped. */}
              <Button
                label="Delete commitment"
                variant="quiet"
                onPress={() => setDeleting(true)}
                theme={theme}
              />
            </View>

            {addingTask ? (
              <AddTaskModal
                visible
                onClose={() => setAddingTask(false)}
                units={units}
                homeUnitId={data.id}
                areaColors={theme.areas}
                theme={theme}
                onCommit={async (
                  title,
                  timesPerWeek,
                  unitIds,
                  plannedWeekdays,
                  partOfDay,
                  oneOff,
                  detail,
                ) => {
                  await addTask(
                    unitIds,
                    title,
                    timesPerWeek,
                    plannedWeekdays,
                    partOfDay,
                    null,
                    oneOff,
                    null,
                    detail,
                  );
                  await reload();
                }}
              />
            ) : null}

            {sheet !== null ? (
              <CommitmentSheet
                visible
                mode={sheet}
                otherShares={others}
                theme={theme}
                onClose={() => {
                  setSheet(null);
                  setEditingSubId(null);
                }}
                onSave={async ({ name, share }) => {
                  if (sheet.kind === "commitment") {
                    await updateCommitment(data.id, { name, share });
                  } else if (editingSubId !== null) {
                    await updateCommitment(editingSubId, { name });
                  } else {
                    await createSubCommitment(data.id, name);
                  }
                  setSheet(null);
                  setEditingSubId(null);
                  await reload();
                }}
              />
            ) : null}

            {/* The one irreversible act here, so the one that asks —
                and the copy says what survives, since a month of scored
                days is the thing a person is actually afraid for. */}
            <Modal
              visible={deleting}
              transparent
              statusBarTranslucent
              animationType="fade"
              onRequestClose={() => setDeleting(false)}
            >
              <View style={styles.confirmBackdrop}>
                <View
                  style={[
                    styles.confirmCard,
                    {
                      backgroundColor: theme.canvas,
                      borderColor: theme.hairline,
                    },
                  ]}
                >
                  <AppText variant="title" color={theme.ink}>
                    Delete {data.name}?
                  </AppText>
                  <AppText color={theme.muted}>
                    It goes for good, with its{" "}
                    {countOf(data.subCommitments.length, "part")} and{" "}
                    {countOf(data.taskCount, "task")}. Days you have already
                    scored keep their grades and everything in your log stays.
                    To keep it and stop scoring it, finish it instead.
                  </AppText>
                  <View style={styles.confirmActions}>
                    <View style={styles.grow}>
                      <Button
                        label="Cancel"
                        variant="quiet"
                        onPress={() => setDeleting(false)}
                        theme={theme}
                      />
                    </View>
                    <View style={styles.grow}>
                      <Button
                        label="Delete"
                        color={theme.danger}
                        onPress={() => {
                          setDeleting(false);
                          void deleteCommitment(data.id).then(() =>
                            router.back(),
                          );
                        }}
                        theme={theme}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** "3 parts", "1 task" — plural agreement in one place. */
function countOf(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`;
}

function ActionRow({
  label,
  value,
  onPress,
  theme,
  last,
  accent,
  icon,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  theme: ReturnType<typeof getTheme>;
  last?: boolean;
  accent?: string;
  icon?: "add";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        last === true
          ? null
          : {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.hairline,
            },
        { opacity: pressed ? 0.6 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={value === undefined ? label : `${label}, ${value}`}
    >
      {icon === "add" ? (
        <Ionicons
          name="add"
          size={20}
          color={accent ?? theme.accent}
          importantForAccessibility="no"
        />
      ) : null}
      <AppText
        color={icon === "add" ? (accent ?? theme.accent) : theme.ink}
        style={styles.grow}
        numberOfLines={1}
      >
        {label}
      </AppText>
      {value !== undefined ? (
        <AppText variant="caption" color={theme.muted} numberOfLines={1}>
          {value}
        </AppText>
      ) : null}
      {icon === undefined ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.muted}
          importantForAccessibility="no"
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  container: { paddingHorizontal: space.screen },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  status: { marginTop: space.xs },
  bannerNote: { marginTop: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    minHeight: 52,
  },
  emptyRow: { paddingVertical: space.md, minHeight: 52, justifyContent: "center" },
  grow: { flex: 1 },
  aside: { marginTop: space.md },
  ending: { gap: space.sm, marginTop: space.xxl },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.screen,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xl,
    gap: space.md,
  },
  confirmActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.sm,
  },
});
