/**
 * The app's date and time controls (ADR-0043 §1).
 *
 * **A time opens inline, like iOS Calendar.** The field is a pill
 * showing the time; tapping it slides a wheel open under its row, and
 * the wheel stays open while you turn it. It closes when you tap the
 * pill again, open another time, or tap anywhere else in the same
 * `FieldScope`, sliding shut the same way. The compact popover this
 * replaced closed itself whenever the sheet re-rendered under it, which
 * was every time the wheel settled (Henry, 2026-11-02).
 *
 * Wrap a time's row in `TimeFieldRow`: the wheel opens below the whole
 * row, full width, whichever of the row's fields is open. `NativeSheet`
 * is a `FieldScope` already; a screen with times wraps its content in
 * one so a tap elsewhere closes the wheel.
 *
 * It holds the app's stored forms, never a `Date`: minutes from the
 * start of the day for a time, `YYYY-MM-DD` for a day. The crossing
 * lives in `lib/pickerValues.ts`. A time a day or more on reads "+1".
 *
 * The browser preview gets `DateTimeField.web.tsx`, a plain input,
 * because SwiftUI doesn't render there.
 */
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { accessibilityLabel, datePickerStyle, labelsHidden } from "@expo/ui/swift-ui/modifiers";
import { formatMinutes } from "@glide/scoring";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  dateToLocalDate,
  dateToMinutes,
  localDateToDate,
  minutesToDate,
} from "../../lib/pickerValues";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space, weight } from "../../theme/tokens";
import { AppText } from "./AppText";

interface Common {
  /** What VoiceOver reads; the row shows its own label beside it. */
  label: string;
  accent: string;
  theme: ThemeTokens;
}

// ── Scope: which time is open, and taps elsewhere ───────────────────

interface Scope {
  open: string | null;
  setOpen: (id: string | null) => void;
  /** A touch began on a field or its wheel, so it isn't "elsewhere". */
  markInside: () => void;
}

const ScopeContext = createContext<Scope | null>(null);

/** A tap that moved less than this is a tap, not a scroll. */
const TAP_SLOP = 10;

/**
 * Where one time can be open at once, and a tap anywhere else closes
 * it. Scrolling doesn't: only a touch that lifts where it landed.
 */
export function FieldScope({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [open, setOpen] = useState<string | null>(null);
  const inside = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const scope = useMemo<Scope>(() => ({ open, setOpen, markInside: () => (inside.current = true) }), [open]);
  return (
    <ScopeContext.Provider value={scope}>
      <View
        style={style}
        // Touch events bubble, so a field marks itself before this runs.
        onTouchStart={(e) => {
          start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        }}
        onTouchEnd={(e: GestureResponderEvent) => {
          const from = start.current;
          const wasInside = inside.current;
          inside.current = false;
          start.current = null;
          if (open === null || wasInside || !from) return;
          const moved = Math.hypot(e.nativeEvent.pageX - from.x, e.nativeEvent.pageY - from.y);
          if (moved < TAP_SLOP) setOpen(null);
        }}
      >
        {children}
      </View>
    </ScopeContext.Provider>
  );
}

/** The scope a field is in, or one of its own when it has none. */
function useScope(): Scope {
  const outer = useContext(ScopeContext);
  const [open, setOpen] = useState<string | null>(null);
  const own = useMemo<Scope>(() => ({ open, setOpen, markInside: () => {} }), [open]);
  return outer ?? own;
}

// ── Row: where the wheel opens ──────────────────────────────────────

const RowContext = createContext<((owner: string, wheel: ReactNode | null) => void) | null>(null);

/**
 * A row holding one or two times. Its children are laid out with
 * `style` as before; the open field's wheel slides out beneath them.
 */
export function TimeFieldRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [wheel, setWheel] = useState<{ owner: string; node: ReactNode } | null>(null);
  const place = useCallback((owner: string, node: ReactNode | null) => {
    setWheel((w) => (node !== null ? { owner, node } : w?.owner === owner ? null : w));
  }, []);
  return (
    <RowContext.Provider value={place}>
      <View>
        <View style={style}>{children}</View>
        <Reveal>{wheel?.node ?? null}</Reveal>
      </View>
    </RowContext.Provider>
  );
}

/** The iOS wheel's own height. */
const WHEEL_HEIGHT = 216;

/**
 * Slides its child open and shut: height and fade together, on a soft
 * spring opening and a quicker ease closing. The last child is kept
 * on screen while it closes.
 */
function Reveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [kept, setKept] = useState<ReactNode>(children);
  const progress = useSharedValue(children ? 1 : 0);
  const shown = children !== null;

  // Kept in step during render: the newest wheel while open, and
  // nothing at once when closing without motion.
  if (shown && kept !== children) setKept(children);
  if (!shown && reduce && kept !== null) setKept(null);

  useEffect(() => {
    if (shown) {
      progress.value = reduce ? 1 : withSpring(1, { damping: 22, stiffness: 220, mass: 0.9 });
    } else if (reduce) {
      progress.value = 0;
    } else {
      progress.value = withTiming(0, { duration: 200 }, (done) => {
        if (done) runOnJS(setKept)(null);
      });
    }
  }, [shown, reduce, progress]);

  const animated = useAnimatedStyle(() => ({
    height: progress.value * WHEEL_HEIGHT,
    opacity: Math.min(1, progress.value * 1.4),
  }));

  if (kept === null) return null;
  return <Animated.View style={[styles.reveal, animated]}>{kept}</Animated.View>;
}

// ── The fields ──────────────────────────────────────────────────────

export function TimeField({
  minutes,
  min,
  onChange,
  label,
  accent,
  theme,
}: Common & {
  /** Minutes from the start of the day; 1440 or more is the next day. */
  minutes: number;
  /** The earliest time the wheel offers. */
  min?: number;
  /** The time picked, 0–1439: the caller decides which day it is. */
  onChange: (minutes: number) => void;
}) {
  const id = useId();
  const scope = useScope();
  const place = useContext(RowContext);
  const open = scope.open === id;
  const latest = useRef(onChange);
  useLayoutEffect(() => {
    latest.current = onChange;
  });

  // One Date per value, so a re-render hands SwiftUI the same props
  // and the wheel isn't rebuilt under your finger.
  const selection = useMemo(() => minutesToDate(minutes % 1440), [minutes]);
  const floor = useMemo(() => (min !== undefined ? { start: minutesToDate(min % 1440) } : undefined), [min]);
  const modifiers = useMemo(() => [datePickerStyle("wheel"), labelsHidden(), accessibilityLabel(label)], [label]);

  const wheel = useMemo(
    () => (
      <View onTouchStart={scope.markInside} style={styles.wheel}>
        <Host colorScheme={theme.name} seedColor={accent} style={styles.wheelHost}>
          <DatePicker
            title={label}
            selection={selection}
            range={floor}
            displayedComponents={["hourAndMinute"]}
            onDateChange={(at) => latest.current(dateToMinutes(at))}
            modifiers={modifiers}
          />
        </Host>
      </View>
    ),
    [scope.markInside, theme.name, accent, label, selection, floor, modifiers],
  );

  useLayoutEffect(() => {
    place?.(id, open ? wheel : null);
  }, [place, id, open, wheel]);
  useEffect(() => () => place?.(id, null), [place, id]);

  const nextDay = minutes >= 1440;
  return (
    <>
      <Pressable
        onTouchStart={scope.markInside}
        onPress={() => scope.setOpen(open ? null : id)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatMinutes(minutes)}${nextDay ? ", next day" : ""}`}
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? "Closes the time wheel" : "Opens the time wheel"}
        hitSlop={6}
        style={({ pressed }) => [
          styles.pill,
          { backgroundColor: theme.fill, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <AppText color={open ? accent : theme.ink} style={styles.time}>
          {formatMinutes(minutes)}
        </AppText>
        {nextDay ? (
          <AppText variant="footnote" color={open ? accent : theme.muted}>
            +1
          </AppText>
        ) : null}
      </Pressable>
      {/* Outside a TimeFieldRow, the wheel opens right under the pill. */}
      {place === null ? <Reveal>{open ? wheel : null}</Reveal> : null}
    </>
  );
}

export function DayField({
  date,
  onChange,
  label,
  accent,
  theme,
}: Common & { date: string; onChange: (date: string) => void }) {
  const selection = useMemo(() => localDateToDate(date), [date]);
  const modifiers = useMemo(() => [datePickerStyle("compact"), labelsHidden(), accessibilityLabel(label)], [label]);
  return (
    <Host matchContents colorScheme={theme.name} seedColor={accent} style={styles.host}>
      <DatePicker
        title={label}
        selection={selection}
        displayedComponents={["date"]}
        onDateChange={(at) => onChange(dateToLocalDate(at))}
        modifiers={modifiers}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  /** The compact picker's own size, held before SwiftUI measures it. A
   *  picker mounted after the screen (a new gap, a new range) measured
   *  zero at first and overlapped its row until something re-rendered
   *  it (Henry, 2026-10-25). */
  host: { minWidth: 88, minHeight: 36 },
  pill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
    minHeight: 36,
    minWidth: 72,
    justifyContent: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.sm,
  },
  time: { fontVariant: ["tabular-nums"], fontWeight: weight.medium },
  reveal: { overflow: "hidden" },
  wheel: { height: WHEEL_HEIGHT, justifyContent: "center" },
  wheelHost: { height: WHEEL_HEIGHT, width: "100%" },
});
