/**
 * The nav-bar buttons on a tab's root (ADR-0043 §1, spec §2.1): a `+`
 * that opens a native pull-down menu, and Settings on Home and Life.
 *
 * The menu is the same on every tab: Task, Event and Log something
 * (Windows arrive with Phase 8, and Goal on Life with Phase 10). Each tab opens what
 * it owns in place; anything another tab owns switches to that tab and
 * opens it there (`openAdd`), until Phases 8 to 10 let every tab open
 * every sheet (Henry, 2026-10-16).
 *
 * A header toolbar draws no view of its own; it only sets the nav bar,
 * so it can sit anywhere in a screen. Its buttons call the handlers
 * through `useLatest`, so new handlers don't rebuild the bar.
 */
import { router, Stack, type Href } from "expo-router";

import { useLatest } from "../../hooks/useLatest";

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
  /** Home and Life show Settings here. */
  settings?: boolean;
  /** A ⋯ menu of the tab's own actions: Home's Clear today and Day
   *  type (ADR-0040 §4). Omitted, there's no ⋯. */
  more?: readonly { label: string; icon: string; onPress: () => void }[];
}

export function TabToolbar(props: TabToolbarProps) {
  const latest = useLatest(props);
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="plus" accessibilityLabel="Add">
        <Stack.Toolbar.MenuAction icon="checkmark.circle" onPress={() => latest.current.onTask()}>
          Task
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction icon="calendar" onPress={() => latest.current.onEvent()}>
          Event
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction icon="square.and.pencil" onPress={() => latest.current.onLog()}>
          Log something
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
      {props.more && props.more.length > 0 ? (
        <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel="More">
          {props.more.map((m) => (
            <Stack.Toolbar.MenuAction
              key={m.label}
              icon={m.icon as never}
              onPress={() => latest.current.more?.find((x) => x.label === m.label)?.onPress()}
            >
              {m.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      ) : null}
      {props.settings === true ? (
        <Stack.Toolbar.Button
          icon="gearshape"
          accessibilityLabel="Settings"
          onPress={() => router.push("/settings" as Href)}
        />
      ) : null}
    </Stack.Toolbar>
  );
}
