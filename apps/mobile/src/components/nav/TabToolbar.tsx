/**
 * The nav-bar buttons on a tab's root (ADR-0043 §1, spec §2.1): a `+`
 * that opens a native pull-down menu, and Settings on Home and Life.
 *
 * The menu is the same on every tab: Task, Event and Log something,
 * and Window where the tab can add one (Home and Plan). Each tab opens
 * what it owns in place; anything another tab owns switches to that
 * tab and opens it there (`openAdd`).
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
  /** Adds a window to the day shown. Omitted, the menu has no Window. */
  onWindow?: () => void;
  onLog: () => void;
  /** Home and Life show Settings here. */
  settings?: boolean;
  /** Home on another day: back to today (spec §5.2). */
  onToday?: () => void;
  /** A ⋯ menu of the tab's own actions: Home's Clear today and Day
   *  type (ADR-0040 §4). Omitted, there's no ⋯. */
  more?: readonly { label: string; icon: string; onPress: () => void }[];
}

export function TabToolbar(props: TabToolbarProps) {
  const latest = useLatest(props);
  return (
    <Stack.Toolbar placement="right">
      {props.onToday ? (
        <Stack.Toolbar.Button onPress={() => latest.current.onToday?.()}>Today</Stack.Toolbar.Button>
      ) : null}
      <Stack.Toolbar.Menu icon="plus" accessibilityLabel="Add">
        <Stack.Toolbar.MenuAction icon="checkmark.circle" onPress={() => latest.current.onTask()}>
          Task
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction icon="calendar" onPress={() => latest.current.onEvent()}>
          Event
        </Stack.Toolbar.MenuAction>
        {props.onWindow ? (
          <Stack.Toolbar.MenuAction icon="rectangle.badge.plus" onPress={() => latest.current.onWindow?.()}>
            Window
          </Stack.Toolbar.MenuAction>
        ) : null}
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
