/**
 * The nav-bar buttons on a tab's root (ADR-0043 §1, spec §2.1): a `+`
 * that opens a native pull-down menu, and Settings on Home and Life.
 *
 * The menu is the same on every tab: Task, Event and Log something,
 * plus Goal on Life (Windows arrive with Phase 8). Each tab opens what
 * it owns in place; anything another tab owns switches to that tab and
 * opens it there (`openAdd`), until Phases 8 to 10 let every tab open
 * every sheet (Henry, 2026-10-16).
 *
 * A header toolbar draws no view of its own; it only sets the nav bar,
 * so it can sit anywhere in a screen.
 */
import { router, Stack, type Href } from "expo-router";

/** What another tab's `+` asked this tab to open. */
export type AddRequest = "task" | "event" | "activity";

/** Switch to the tab that owns an add, asking it to open the sheet. */
export function openAdd(what: AddRequest) {
  const tab = what === "activity" ? "/" : "/plan";
  router.navigate(`${tab}?add=${what}` as Href);
}

interface TabToolbarProps {
  onTask: () => void;
  onEvent: () => void;
  onLog: () => void;
  /** Life only. */
  onGoal?: () => void;
  /** Home and Life show Settings here. */
  settings?: boolean;
}

export function TabToolbar({ onTask, onEvent, onLog, onGoal, settings }: TabToolbarProps) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="plus" accessibilityLabel="Add">
        <Stack.Toolbar.MenuAction icon="checkmark.circle" onPress={onTask}>
          Task
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction icon="calendar" onPress={onEvent}>
          Event
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction icon="square.and.pencil" onPress={onLog}>
          Log something
        </Stack.Toolbar.MenuAction>
        {onGoal ? (
          <Stack.Toolbar.MenuAction icon="flag" onPress={onGoal}>
            Goal
          </Stack.Toolbar.MenuAction>
        ) : null}
      </Stack.Toolbar.Menu>
      {settings ? (
        <Stack.Toolbar.Button
          icon="gearshape"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings" as Href)}
        />
      ) : null}
    </Stack.Toolbar>
  );
}
