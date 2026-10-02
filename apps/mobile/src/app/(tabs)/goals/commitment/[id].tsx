/**
 * One commitment — or one of its sub-commitments, which open the same
 * screen (Henry, 2026-10-02: "you should be able to click on a sub
 * commitment to open its own window").
 *
 * **What it holds depends on whether it is split** (ADR-0035 §1 as
 * amended 2026-10-02). A commitment split into sub-commitments lists
 * them, and holds no events or tasks of its own; one that is not split
 * lists its own. A sub-commitment always lists its own. The switch sits
 * with the name and share, and turning it either way says what moves
 * before it moves anything.
 *
 * **Events and tasks are listed apart** because they are planned apart:
 * an event is a time you turn up for, a task is work you fit in
 * (ADR-0038). Each has its own add row, opening its own sheet.
 *
 * **Two endings, and the screen leads with the right one.** Finishing
 * is what happens to a commitment you actually held — the share returns
 * to the pool, the log keeps the term, and it can come back. Deleting
 * is for the mistyped one, quieter and behind a confirm that says what
 * survives (ADR-0007's deletion amendment). A sub-commitment has only
 * delete: finishing belongs to the commitment as a whole.
 *
 * Every row is a target; there is no row here that looks live and is
 * not.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatMinutes } from "@glide/scoring";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CommitmentSheet,
  type CommitmentSheetMode,
} from "../../../../components/commitments/CommitmentSheet";
import { AddTaskModal } from "../../../../components/plan/AddTaskModal";
import { applyTaskEdit, editableFrom } from "../../../../components/plan/applyTaskEdit";
import { EventSheet } from "../../../../components/plan/EventSheet";
import { TaskEditSheet } from "../../../../components/plan/TaskEditSheet";
import { formatFrequencyShort } from "../../../../components/plan/frequency";
import {
  formatWeekdaySummary,
  parseWeekdays,
} from "../../../../components/plan/planning";
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
import { generalSubName } from "../../../../db/commitmentPlan";
import {
  loadCommitmentUnit,
  type CommitmentUnitScreen,
  type UnitItem,
} from "../../../../db/commitments";
import {
  archiveCommitment,
  createSubCommitment,
  deleteCommitment,
  setUsesSubCommitments,
  unarchiveCommitment,
  updateCommitment,
} from "../../../../db/commitmentWrites";
import {
  addEvent,
  addTask,
  archiveTask,
  loadPlan,
  updateEvent,
  type PlanData,
  type PlanTask,
} from "../../../../db/tasks";
import { spokenDate } from "../../../../lib/format";
import { getTheme, SCRIM } from "../../../../theme/colors";
import { radius, space } from "../../../../theme/tokens";

export default function CommitmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const accent = theme.areas["work-money"] ?? theme.accent;

  const [data, setData] = useState<CommitmentUnitScreen | null>(null);
  const [sheet, setSheet] = useState<CommitmentSheetMode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  /** null closed; "new" adding; an item editing it. */
  const [eventSheet, setEventSheet] = useState<"new" | UnitItem | null>(null);
  /** Everything a task can be filed under, for the add sheet. */
  const [units, setUnits] = useState<PickableUnit[]>([]);
  /** The plan, for the task being edited here — the same row the Tasks
   *  tab edits, so the same sheet and the same save apply. */
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [editingTask, setEditingTask] = useState<PlanTask | null>(null);

  const reload = useCallback(async () => {
    const [screen, next] = await Promise.all([loadCommitmentUnit(id), loadPlan()]);
    setData(screen);
    setPlan(next);
    setUnits(pickableUnits(next));
  }, [id]);

  /** A task on this screen, as the plan holds it. */
  const planTask = (taskId: string): PlanTask | null =>
    plan?.commitments.flatMap((c) => c.tasks).find((t) => t.id === taskId) ?? null;

  const { error, retry } = useScreenLoad(reload);
  const archived = data !== null && data.archivedAt !== null;
  const isSub = data?.parent != null;

  /** Turning the switch says what will move, then moves it. */
  const toggleSubs = (on: boolean) => {
    if (!data) return;
    const own = data.events.length + data.tasks.length;
    const subCount = data.subs.length;
    const apply = () => void setUsesSubCommitments(data.id, on).then(reload);
    if (on && own > 0) {
      Alert.alert(
        "Split into sub-commitments?",
        `Its ${countOf(own, "event or task", "events and tasks")} move into a new sub-commitment, “${generalSubName(data.name)}”, which you can rename.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Split", onPress: apply },
        ],
      );
    } else if (!on && subCount > 0) {
      Alert.alert(
        "Stop using sub-commitments?",
        `Everything in its ${countOf(subCount, "sub-commitment")} moves onto ${data.name} itself, and the sub-commitments are archived, not deleted.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Move everything up", onPress: apply },
        ],
      );
    } else {
      apply();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={hueWash(accent)} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
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
            ‹ {data?.parent ? data.parent.name : "Commitments"}
          </AppText>
        </Pressable>

        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : data === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : (
          <>
            <AppText variant="display" color={theme.ink}>
              {data.name}
            </AppText>
            <AppText variant="label" color={accent} style={styles.status}>
              {archived
                ? "Finished"
                : isSub
                  ? `Part of ${data.parent!.name}`
                  : data.others.length > 0
                    ? `${data.sharePercent}% of commitment points`
                    : "Takes all of the commitment band"}
            </AppText>

            {archived ? (
              <AppText variant="caption" color={theme.muted} style={styles.bannerNote}>
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
                  setSheet(
                    isSub
                      ? { kind: "sub", parentName: data.parent!.name, name: data.name }
                      : { kind: "commitment", name: data.name, percent: data.sharePercent },
                  )
                }
                last={archived || isSub}
              />
              {/* Only worth a row when there is something to share
                  with: a lone commitment takes the whole band. */}
              {!archived && !isSub && data.others.length > 0 ? (
                <ActionRow
                  label="Share"
                  value={`${data.sharePercent}% of commitment points`}
                  theme={theme}
                  onPress={() =>
                    setSheet({ kind: "commitment", name: data.name, percent: data.sharePercent })
                  }
                />
              ) : null}
              {!archived && !isSub ? (
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <AppText color={theme.ink}>Sub-commitments</AppText>
                    <AppText variant="footnote" color={theme.muted}>
                      Split it into classes, shifts or teams, each with its
                      own events and tasks.
                    </AppText>
                  </View>
                  <Switch
                    value={data.subsOn}
                    onValueChange={toggleSubs}
                    trackColor={{ true: accent }}
                    accessibilityLabel="Sub-commitments"
                  />
                </View>
              ) : null}
            </Group>

            {data.subsOn ? (
              <Group
                theme={theme}
                title="Sub-commitments"
                footnote="Each holds its own events and tasks. The day's share is split across those, not across these."
                flush
              >
                {data.subs.map((sub, i) => (
                  <ActionRow
                    key={sub.id}
                    label={sub.name}
                    value={summaryOf(sub.eventCount, sub.taskCount)}
                    theme={theme}
                    onPress={() => router.push(`/goals/commitment/${sub.id}` as Href)}
                    last={archived && i === data.subs.length - 1}
                  />
                ))}
                {!archived ? (
                  <ActionRow
                    label="Add a sub-commitment"
                    theme={theme}
                    accent={accent}
                    icon="add"
                    onPress={() => setSheet({ kind: "sub", parentName: data.name })}
                    last
                  />
                ) : null}
              </Group>
            ) : (
              <>
                <Group
                  theme={theme}
                  title="Events"
                  footnote="Times you turn up for — a lecture, a shift. Tick one when you have been."
                  flush
                >
                  {data.events.map((e) => (
                    <ItemRow
                      key={e.id}
                      item={e}
                      detail={eventWhen(e)}
                      theme={theme}
                      onPress={archived ? undefined : () => setEventSheet(e)}
                    />
                  ))}
                  {!archived ? (
                    <ActionRow
                      label="Add an event"
                      theme={theme}
                      accent={accent}
                      icon="add"
                      onPress={() => setEventSheet("new")}
                      last
                    />
                  ) : null}
                </Group>

                <Group
                  theme={theme}
                  title="Tasks"
                  footnote="Work you fit in around them. Paid from this share on the days it is scheduled."
                  flush
                >
                  {data.tasks.map((t) => (
                    <ItemRow
                      key={t.id}
                      item={t}
                      detail={taskWhen(t)}
                      theme={theme}
                      // Edited here, in place (Henry, 2026-10-02).
                      onPress={
                        archived
                          ? undefined
                          : () => {
                              const found = planTask(t.id);
                              if (found) setEditingTask(found);
                            }
                      }
                    />
                  ))}
                  {!archived ? (
                    <ActionRow
                      label="Add a task"
                      theme={theme}
                      accent={accent}
                      icon="add"
                      onPress={() => setAddingTask(true)}
                      last
                    />
                  ) : null}
                </Group>
              </>
            )}

            <View style={styles.ending}>
              {isSub ? null : archived ? (
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
              {isSub ? null : (
                <AppText variant="footnote" color={theme.muted}>
                  {archived
                    ? "Its tasks come back and it takes a share of your day again."
                    : "Keeps everything and stops scoring it. You can start it again whenever."}
                </AppText>
              )}
              <Button
                label={isSub ? "Delete sub-commitment" : "Delete commitment"}
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

            {editingTask !== null ? (
              <TaskEditSheet
                visible
                task={editableFrom(editingTask)}
                units={units}
                goals={[]}
                areaColors={theme.areas}
                accent={accent}
                theme={theme}
                onClose={() => setEditingTask(null)}
                onSave={async (next) => {
                  const t = editingTask;
                  setEditingTask(null);
                  await applyTaskEdit(t, next);
                  await reload();
                }}
                onDelete={async () => {
                  const t = editingTask;
                  setEditingTask(null);
                  await archiveTask(t.id);
                  await reload();
                }}
              />
            ) : null}

            {eventSheet !== null ? (
              <EventSheet
                visible
                unitName={data.name}
                initial={
                  eventSheet === "new"
                    ? undefined
                    : {
                        title: eventSheet.title,
                        plannedWeekdays: eventSheet.plannedWeekdays,
                        oneOffDate: eventSheet.oneOffDate,
                        startMinute: eventSheet.startMinute,
                        endMinute: eventSheet.endMinute,
                        location: eventSheet.location,
                        notes: eventSheet.notes,
                      }
                }
                accent={accent}
                theme={theme}
                onClose={() => setEventSheet(null)}
                onSave={async (input) => {
                  if (eventSheet === "new") await addEvent([data.id], input);
                  else await updateEvent(eventSheet.id, input);
                  setEventSheet(null);
                  await reload();
                }}
                onDelete={
                  eventSheet === "new"
                    ? undefined
                    : async () => {
                        await archiveTask(eventSheet.id);
                        setEventSheet(null);
                        await reload();
                      }
                }
              />
            ) : null}

            {sheet !== null ? (
              <CommitmentSheet
                visible
                mode={sheet}
                others={data.others}
                theme={theme}
                onClose={() => setSheet(null)}
                onSave={async ({ name, percent }) => {
                  if (sheet.kind === "commitment") {
                    await updateCommitment(data.id, { name, percent });
                  } else if (sheet.name !== undefined) {
                    await updateCommitment(data.id, { name });
                  } else {
                    await createSubCommitment(data.id, name);
                  }
                  setSheet(null);
                  await reload();
                }}
              />
            ) : null}

            {/* The one irreversible act here, so the one that asks —
                and the copy says what survives. */}
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
                    { backgroundColor: theme.canvas, borderColor: theme.hairline },
                  ]}
                >
                  <AppText variant="title" color={theme.ink}>
                    Delete {data.name}?
                  </AppText>
                  <AppText color={theme.muted}>
                    {isSub
                      ? `It goes for good, with its ${countOf(data.events.length, "event")} and ${countOf(data.tasks.length, "task")}. Days you have already scored keep their grades and everything in your log stays.`
                      : `It goes for good, with everything inside it. Days you have already scored keep their grades and everything in your log stays. To keep it and stop scoring it, finish it instead.`}
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
                          void deleteCommitment(data.id).then(() => router.back());
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

/** "3 tasks", "1 task" — plural agreement in one place. */
function countOf(n: number, noun: string, plural = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : plural}`;
}

/** "2 events · 3 tasks", or "Empty". */
function summaryOf(events: number, tasks: number): string {
  const parts = [
    events > 0 ? countOf(events, "event") : null,
    tasks > 0 ? countOf(tasks, "task") : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Empty";
}

/** "Mon, Wed · 9:00–11:00", or "Tuesday, 4 November · 9:00–11:00". */
function eventWhen(e: UnitItem): string {
  const day = e.oneOffDate
    ? spokenDate(e.oneOffDate)
    : (formatWeekdaySummary(parseWeekdays(e.plannedWeekdays)) ?? "");
  const time =
    e.startMinute !== null && e.endMinute !== null
      ? `${formatMinutes(e.startMinute)}–${formatMinutes(e.endMinute)}`
      : "";
  return [day, time].filter(Boolean).join(" · ");
}

/** "3×/wk", "Mon, Thu", or a one-off's date. */
function taskWhen(t: UnitItem): string {
  if (t.oneOffSize !== null) return t.oneOffDate ? spokenDate(t.oneOffDate) : "Any day";
  return formatWeekdaySummary(parseWeekdays(t.plannedWeekdays)) ?? formatFrequencyShort(t.timesPerWeek);
}

/** A listed event or task: its name, when, and where. */
function ItemRow({
  item,
  detail,
  onPress,
  theme,
}: {
  item: UnitItem;
  detail: string;
  onPress?: () => void;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline },
        { opacity: pressed ? 0.6 : 1 },
      ]}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={[item.title, detail, item.location].filter(Boolean).join(", ")}
    >
      <View style={styles.grow}>
        <AppText color={theme.ink} numberOfLines={1}>
          {item.title}
        </AppText>
        <AppText variant="footnote" color={theme.muted} numberOfLines={1}>
          {[detail, item.location].filter(Boolean).join(" · ")}
        </AppText>
      </View>
      {onPress ? (
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
          : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline },
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
  grow: { flex: 1 },
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
