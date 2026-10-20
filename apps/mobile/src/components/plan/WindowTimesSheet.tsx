/**
 * Add a window to one day, or change one's times (spec §3.5,
 * windows-and-pins.md §1.4). A day edit, never the weekly template:
 * that's the hours editor. An added window can sit outside your working
 * hours ("I'm free tonight after all"); one over an event is trimmed
 * around it.
 *
 * Windows have no names: a window is shown by its times.
 */
import { rangeError, type TimeRange } from "@glide/scoring";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { TimeField } from "../ui/DateTimeField";
import { NativeSheet } from "../ui/NativeSheet";

interface WindowTimesSheetProps {
  visible: boolean;
  /** The window being changed; absent when adding one. */
  initial?: TimeRange;
  /** "Wednesday" or "today", for the title. */
  dayLabel: string;
  theme: ThemeTokens;
  onClose: () => void;
  onDismissed?: () => void;
  /** Resolves to a problem to show, or null once saved. */
  onSave: (range: TimeRange) => Promise<string | null>;
}

/** An hour from 6 pm, a plain default for "add a window". */
const DEFAULT_ADD: TimeRange = { start: 18 * 60, end: 19 * 60 };

export function WindowTimesSheet({
  visible,
  initial,
  dayLabel,
  theme,
  onClose,
  onDismissed,
  onSave,
}: WindowTimesSheetProps) {
  const [range, setRange] = useState<TimeRange>(initial ?? DEFAULT_ADD);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-seed each time it opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setRange(initial ?? DEFAULT_ADD);
      setProblem(null);
      setSaving(false);
    }
  }

  const invalid = rangeError(range);
  const save = async () => {
    if (saving || invalid !== null) return;
    setSaving(true);
    const said = await onSave(range);
    setSaving(false);
    setProblem(said);
  };

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      dismissible={!saving}
      title={initial ? "Window times" : "Add a window"}
      confirm={{
        label: initial ? "Save" : "Add",
        onPress: () => void save(),
        disabled: saving || invalid !== null,
      }}
    >
      <AppText variant="caption" color={theme.muted}>
        For {dayLabel} only. Your weekly hours don&apos;t change.
      </AppText>
      <View style={styles.row}>
        <AppText variant="body" color={theme.ink} style={styles.grow}>
          Starts
        </AppText>
        <TimeField
          minutes={range.start}
          onChange={(start) => setRange((r) => ({ start, end: Math.max(r.end, start + 30) }))}
          label="Starts"
          accent={theme.accent}
          theme={theme}
        />
      </View>
      <View style={styles.row}>
        <AppText variant="body" color={theme.ink} style={styles.grow}>
          Ends
        </AppText>
        <TimeField
          minutes={range.end}
          min={range.start + 15}
          onChange={(end) => setRange((r) => ({ ...r, end }))}
          label="Ends"
          accent={theme.accent}
          theme={theme}
        />
      </View>
      {problem ?? invalid ? (
        <AppText
          variant="caption"
          color={theme.ink}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {problem ?? invalid}
        </AppText>
      ) : null}
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  grow: { flex: 1 },
});
