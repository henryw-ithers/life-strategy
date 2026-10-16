/**
 * One commitment — or one of its sub-commitments, which open the same
 * screen (Henry, 2026-10-02: "you should be able to click on a sub
 * commitment to open its own window").
 *
 * **What it holds depends on whether it is split** (ADR-0035 §1 as
 * amended 2026-10-02). A commitment split into sub-commitments lists
 * them, and holds no events or tasks of its own; one that is not split
 * lists its own. A sub-commitment always lists its own. Turning the
 * split on or off says what moves before it moves anything.
 *
 * **Events and tasks are listed apart** because they are planned apart:
 * an event is a time you turn up for, a task is work you fit in
 * (ADR-0038). Each has its own add row, opening its own sheet.
 *
 * **What you do to the whole thing lives in the ••• menu** in the nav
 * bar (Henry, 2026-10-02): using sub-commitments or not,
 * **archiving** — what happens to a commitment you actually held; the
 * share returns to the pool, the log keeps the term, and unarchiving
 * brings it back — and deleting, for the mistyped one, behind a confirm
 * that says what survives (ADR-0007's deletion amendment). The page
 * itself is left to what is in it. A sub-commitment's only option is
 * delete: archiving belongs to the commitment as a whole. Renaming is
 * the Name row, on every kind of page.
 *
 * Every row is a target; there is no row here that looks live and is
 * not.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

import {
  CommitmentSheet,
  type CommitmentSheetMode,
} from "../../../../components/commitments/CommitmentSheet";
import { ColourSheet } from "../../../../components/commitments/ColourSheet";
import { CommitmentToolbar } from "../../../../components/commitments/CommitmentToolbar";
import { AddTaskModal } from "../../../../components/plan/AddTaskModal";
import { applyTaskEdit, editableFrom } from "../../../../components/plan/applyTaskEdit";
import { EventSheet } from "../../../../components/plan/EventSheet";
import { TaskEditSheet } from "../../../../components/plan/TaskEditSheet";
import { eventWhen, ItemRow, taskWhen } from "../../../../components/plan/ItemRow";
import {
  pickableUnits,
  type PickableUnit,
} from "../../../../components/plan/unitSelection";
import { ActionMenu, type MenuAction } from "../../../../components/ui/ActionMenu";
import { AppText } from "../../../../components/ui/AppText";
import { hueWash, ScrollBackdrop } from "../../../../components/ui/Backdrop";
import { Group } from "../../../../components/ui/Group";
import {
  LoadFailure,
  useScreenLoad,
} from "../../../../components/ui/ScreenLoad";
import { UndoBar } from "../../../../components/ui/UndoBar";
import { GENERAL_SUB_NAME } from "../../../../db/commitmentPlan";
import {
  loadCommitmentUnit,
  readCommitmentHeading,
  type CommitmentHeading,
  type CommitmentUnitScreen,
  type UnitItem,
} from "../../../../db/commitments";
import {
  archiveCommitment,
  createSubCommitment,
  deleteCommitment,
  setUnitColour,
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
import { getTheme, unitHue } from "../../../../theme/colors";
import { PALETTE, isPaletteKey } from "../../../../theme/palette";
import { space } from "../../../../theme/tokens";
import { useFirstRead } from "../../../../hooks/useFirstRead";
import { useUndoDelete } from "../../../../hooks/useUndoDelete";
import { useRetained } from "../../../../hooks/useRetained";

export default function CommitmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");

  const [loaded, setData] = useState<CommitmentUnitScreen | null>(null);
  const firstHeading = useFirstRead(() => readCommitmentHeading(id));
  const [colourOpen, setColourOpen] = useState(false);
  const [sheet, setSheet] = useState<CommitmentSheetMode | null>(null);
  /** The sub-commitment being renamed from that menu. */
  const [renamingSubId, setRenamingSubId] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  /** null closed; "new" adding; an item editing it. */
  const [eventSheet, setEventSheet] = useState<"new" | UnitItem | null>(null);
  /** Everything a task can be filed under, for the add sheet. */
  const [units, setUnits] = useState<PickableUnit[]>([]);
  /** The plan, for the task being edited here — the same row the Tasks
   *  tab edits, so the same sheet and the same save apply. */
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [editingTask, setEditingTask] = useState<PlanTask | null>(null);
  const [addingTaskShown, addingTaskGone] = useRetained(addingTask ? true : null);
  const [editingTaskShown, editingTaskGone] = useRetained(editingTask);
  const [eventSheetShown, eventSheetGone] = useRetained(eventSheet);
  const [sheetShown, sheetGone] = useRetained(sheet);

  const reload = useCallback(async () => {
    const [screen, next] = await Promise.all([loadCommitmentUnit(id), loadPlan()]);
    setData(screen);
    setPlan(next);
    setUnits(pickableUnits(next));
  }, [id]);

  /** A task on this screen, as the plan holds it. */
  const planTask = (taskId: string): PlanTask | null =>
    plan?.commitments.flatMap((c) => c.tasks).find((t) => t.id === taskId) ?? null;

  const { error, retry, save } = useScreenLoad(reload);
  const undo = useUndoDelete(save);
  /** The page as shown: a sub-commitment, event or task waiting on Undo
   *  is already gone from it. */
  const data = withoutItem(loaded, undo.hidden);
  /** Its own colour, or its commitment's, or its area's (ADR-0043 §4). */
  const accent = data
    ? unitHue(theme, { areaId: data.areaId, colour: data.colour ?? data.parentColour })
    : theme.accent;
  const archived = data !== null && data.archivedAt !== null;
  const isSub = data?.parent != null;

  /** Turning the switch says what will move, then moves it. */
  const toggleSubs = (on: boolean) => {
    if (!data) return;
    const own = data.events.length + data.tasks.length;
    const subCount = data.subs.length;
    const apply = () => void setUsesSubCommitments(data.id, on).then(reload);
    if (on && (own > 0 || data.archivedSubCount > 0)) {
      const restoring =
        data.archivedSubCount > 0
          ? `Its ${countOf(data.archivedSubCount, "sub-commitment")} come back, and everything goes back where it was. `
          : "";
      const general =
        own > 0
          ? data.archivedSubCount > 0
            ? `Anything added since goes into “${GENERAL_SUB_NAME}”.`
            : `Its ${countOf(own, "event or task", "events and tasks")} move into its “${GENERAL_SUB_NAME}” sub-commitment, which you can rename or delete.`
          : "";
      Alert.alert("Split into sub-commitments?", `${restoring}${general}`.trim(), [
        { text: "Cancel", style: "cancel" },
        { text: "Split", onPress: apply },
      ]);
    } else if (!on && subCount > 0) {
      Alert.alert(
        "Stop using sub-commitments?",
        `Everything in its ${countOf(subCount, "sub-commitment")} moves onto ${data.name} itself. The sub-commitments are put away, and come back — with their work — if you turn this on again.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Move everything up", onPress: apply },
        ],
      );
    } else {
      apply();
    }
  };

  /** The Name row opens this (ADR-0043 §5). */
  const openRename = () => {
    if (!data) return;
    setSheet(
      isSub
        ? { kind: "sub", parentName: data.parent!.name, name: data.name }
        : { kind: "commitment", name: data.name, percent: data.sharePercent },
    );
  };

  /** Deleting this page's own commitment or sub-commitment: it takes
   *  history with it and the page goes too, so it asks, in a native
   *  alert (ADR-0043 §1), and the copy says what survives. */
  const deleteThis = () => {
    if (!data) return;
    const { id: unitId, name, events, tasks } = data;
    Alert.alert(
      `Delete ${name}?`,
      isSub
        ? `It goes for good, with its ${countOf(events.length, "event")} and ${countOf(tasks.length, "task")}. Days you have already scored keep their grades and everything in your log stays.`
        : "It goes for good, with everything inside it. Days you have already scored keep their grades and everything in your log stays. To keep it and stop scoring it, archive it instead.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          // Anything still waiting on Undo goes first, so nothing reloads
          // a page that's gone.
          onPress: () =>
            void undo.settle().then(() =>
              save(
                () => deleteCommitment(unitId),
                () => router.back(),
              ),
            ),
        },
      ],
    );
  };
  /** A sub-commitment's menu in the list: open, rename, delete. Deleting
   *  from here gets Undo, like any everyday delete. */
  const subActions = (sub: CommitmentUnitScreen["subs"][number]): MenuAction[] => [
    {
      label: "Rename",
      icon: "pencil",
      onPress: () => {
        setRenamingSubId(sub.id);
        setSheet({ kind: "sub", parentName: data?.name ?? "", name: sub.name });
      },
    },
    {
      label: "Delete",
      icon: "trash",
      destructive: true,
      onPress: () =>
        undo.remove({
          id: sub.id,
          message: `Deleted “${sub.name}”`,
          run: () => deleteCommitment(sub.id),
        }),
    },
  ];
  const archiveThis = () => {
    if (!data) return;
    Alert.alert(
      `Archive ${data.name}?`,
      "It keeps everything and stops scoring. You can unarchive it from this menu whenever.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Archive", onPress: () => void archiveCommitment(data.id).then(reload) },
      ],
    );
  };

  /** The nav bar's title and menu, from the first frame of the push
   *  (`readCommitmentHeading`), then from the loaded page. */
  const heading: CommitmentHeading | null = data
    ? { name: data.name, sub: isSub, archived, subsOn: data.subsOn }
    : firstHeading;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: heading?.name ?? "" }} />
      {heading ? (
        <CommitmentToolbar
          heading={heading}
          onToggleSubs={() => data && toggleSubs(!data.subsOn)}
          onArchive={archiveThis}
          onUnarchive={() => data && void unarchiveCommitment(data.id).then(reload)}
          onDelete={deleteThis}
        />
      ) : null}
      <ScrollView
        // First in the screen, so the nav bar's title collapses on
        // scroll; automatic insets keep it and the tab bar clear.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.container,
          { paddingTop: space.sm, paddingBottom: space.xxxl },
        ]}
      >
        <ScrollBackdrop circles={hueWash(accent)} />

        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : data === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : (
          <>
            <AppText variant="label" color={accent} style={styles.status}>
              {archived
                ? "Archived"
                : isSub
                  ? `Part of ${data.parent!.name}`
                  : data.others.length > 0
                    ? `${data.sharePercent}% of commitment points`
                    : "Takes all of the commitment band"}
            </AppText>

            {archived ? (
              <AppText variant="caption" color={theme.muted} style={styles.bannerNote}>
                Its tasks are paused and it takes no share of a day. Its
                history is untouched. Unarchive it from the ••• menu at the
                top right.
              </AppText>
            ) : null}

            <Group theme={theme} flush>
              <ActionRow
                label="Name"
                value={data.name}
                theme={theme}
                onPress={openRename}
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
              <ActionRow
                label="Colour"
                value={isPaletteKey(data.colour) ? PALETTE[data.colour].name : "Automatic"}
                theme={theme}
                onPress={() => setColourOpen(true)}
                last
              />
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
                    // Rename and delete, one hold or the ••• away (Henry,
                    // 2026-10-02).
                    menu={archived ? undefined : subActions(sub)}
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

            {addingTaskShown ? (
              <AddTaskModal
                visible={addingTask}
                onDismissed={addingTaskGone}
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

            {editingTaskShown !== null ? (
              <TaskEditSheet
                visible={editingTask !== null}
                onDismissed={editingTaskGone}
                task={editableFrom(editingTaskShown)}
                units={units}
                goals={[]}
                areaColors={theme.areas}
                accent={accent}
                theme={theme}
                onClose={() => setEditingTask(null)}
                onSave={async (next) => {
                  const t = editingTaskShown;
                  setEditingTask(null);
                  await applyTaskEdit(t, next);
                  await reload();
                }}
                onDelete={() => {
                  const t = editingTaskShown;
                  setEditingTask(null);
                  undo.remove({
                    id: t.id,
                    message: `Deleted “${t.title}”`,
                    run: () => archiveTask(t.id),
                  });
                }}
              />
            ) : null}

            {eventSheetShown !== null ? (
              <EventSheet
                visible={eventSheet !== null}
                onDismissed={eventSheetGone}
                unitName={data.name}
                initial={
                  eventSheetShown === "new"
                    ? undefined
                    : {
                        title: eventSheetShown.title,
                        plannedWeekdays: eventSheetShown.plannedWeekdays,
                        oneOffDate: eventSheetShown.oneOffDate,
                        startMinute: eventSheetShown.startMinute,
                        endMinute: eventSheetShown.endMinute,
                        notes: eventSheetShown.notes,
                      }
                }
                accent={accent}
                theme={theme}
                onClose={() => setEventSheet(null)}
                onSave={async (input) => {
                  if (eventSheetShown === "new") await addEvent([data.id], input);
                  else await updateEvent(eventSheetShown.id, input);
                  setEventSheet(null);
                  await reload();
                }}
                onDelete={
                  eventSheetShown === "new"
                    ? undefined
                    : () => {
                        const { id: eventId, title } = eventSheetShown;
                        setEventSheet(null);
                        undo.remove({
                          id: eventId,
                          message: `Deleted “${title}”`,
                          run: () => archiveTask(eventId),
                        });
                      }
                }
              />
            ) : null}

            {sheetShown !== null ? (
              <CommitmentSheet
                visible={sheet !== null}
                onDismissed={sheetGone}
                mode={sheetShown}
                others={data.others}
                theme={theme}
                onClose={() => {
                  setSheet(null);
                  setRenamingSubId(null);
                }}
                onSave={async ({ name, percent }) => {
                  if (sheetShown.kind === "commitment") {
                    await updateCommitment(data.id, { name, percent });
                  } else if (renamingSubId !== null) {
                    await updateCommitment(renamingSubId, { name });
                  } else if (sheetShown.name !== undefined) {
                    await updateCommitment(data.id, { name });
                  } else {
                    await createSubCommitment(data.id, name);
                  }
                  setSheet(null);
                  setRenamingSubId(null);
                  await reload();
                }}
              />
            ) : null}

            <ColourSheet
              visible={colourOpen}
              value={data.colour}
              // Automatic is what it shows with no colour of its own: a
              // sub-commitment's parent's colour, else its area's.
              automaticHue={unitHue(theme, { areaId: data.areaId, colour: data.parentColour })}
              automaticFrom={data.parent ? data.parent.name : "its area"}
              theme={theme}
              onClose={() => setColourOpen(false)}
              onPick={async (colour) => {
                // Save first, close after: closing first made a failed
                // save look like a successful one.
                try {
                  await setUnitColour(data.id, colour);
                  setColourOpen(false);
                  await reload();
                } catch {
                  Alert.alert("Couldn’t save the colour", "Try again.");
                }
              }}
            />

          </>
        )}
      </ScrollView>
      <UndoBar undo={undo} theme={theme} />
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

function ActionRow({
  label,
  value,
  onPress,
  menu,
  theme,
  last,
  accent,
  icon,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  /** A native menu, from a hold or the ••• at the end (`ActionMenu`). */
  menu?: MenuAction[];
  theme: ReturnType<typeof getTheme>;
  last?: boolean;
  accent?: string;
  icon?: "add";
}) {
  const divider =
    last === true
      ? null
      : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline };
  const spoken = value === undefined ? label : `${label}, ${value}`;
  const content = (
    <>
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
    </>
  );
  if (menu) {
    return (
      <View style={divider}>
        <ActionMenu
          actions={menu}
          onPress={onPress}
          label={spoken}
          hint="Opens it"
          moreColor={theme.muted}
        >
          <View style={styles.row}>{content}</View>
        </ActionMenu>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={spoken}
    >
      {content}
    </Pressable>
  );
}

/** The page without the sub-commitments, events and tasks whose delete
 *  is waiting or landing (`useUndoDelete`). */
function withoutItem(
  page: CommitmentUnitScreen | null,
  hidden: ReadonlySet<string>,
): CommitmentUnitScreen | null {
  if (page === null || hidden.size === 0) return page;
  return {
    ...page,
    subs: page.subs.filter((s) => !hidden.has(s.id)),
    events: page.events.filter((e) => !hidden.has(e.id)),
    tasks: page.tasks.filter((t) => !hidden.has(t.id)),
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: space.screen },
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
});
