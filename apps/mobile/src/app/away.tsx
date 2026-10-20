/**
 * Settings → Time away (ADR-0040 §5; spec §4.7): date ranges of days
 * off, each with an optional label ("Japan"). Away days aren't graded,
 * have no windows and no events due, and flexible work is spread over
 * the other days of the week.
 *
 * A new range starts tomorrow (EC-31): today may already hold ticks,
 * and it's still graded. A range can reach back only into days that
 * haven't settled (EC-32); a settled day's grade stands.
 */
import { addDays } from "@glide/scoring";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import { AppText } from "../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import { DayField } from "../components/ui/DateTimeField";
import { Group, GroupDivider } from "../components/ui/Group";
import { NativeSheet } from "../components/ui/NativeSheet";
import { LoadFailure, useScreenLoad } from "../components/ui/ScreenLoad";
import { SettingsRow } from "../components/ui/SettingsRow";
import { TextField } from "../components/ui/TextField";
import { useRetained } from "../hooks/useRetained";
import { addAway, loadAwayRanges, removeAway, updateAway, type AwayRange } from "../db/skips";
import { currentLocalDate } from "../lib/calendar";
import { getTheme, type ThemeTokens } from "../theme/colors";
import { space } from "../theme/tokens";

/** "3 Nov – 14 Nov". */
function rangeLabel(r: { startDate: string; endDate: string }): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return r.startDate === r.endDate ? fmt(r.startDate) : `${fmt(r.startDate)} – ${fmt(r.endDate)}`;
}

type Editing = { kind: "new" } | { kind: "edit"; range: AwayRange };

export default function AwayScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [ranges, setRanges] = useState<AwayRange[] | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [editingShown, editingGone] = useRetained(editing);

  const load = useCallback(async () => {
    setRanges(await loadAwayRanges());
  }, []);
  const { error, retry } = useScreenLoad(load);

  const today = currentLocalDate();
  const upcoming = (ranges ?? []).filter((r) => r.endDate >= today);
  const past = (ranges ?? []).filter((r) => r.endDate < today);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.body}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : (
          <>
            <AppText variant="caption" color={theme.muted} style={styles.lead}>
              Days you&apos;re away aren&apos;t graded and have no windows or events. Anything
              flexible is spread over the rest of the week.
            </AppText>
            <Button
              variant="tonal"
              icon="add"
              label="Add time away"
              onPress={() => setEditing({ kind: "new" })}
              theme={theme}
            />
            {upcoming.length > 0 ? (
              <RangeGroup title="Coming up" ranges={upcoming} onOpen={(r) => setEditing({ kind: "edit", range: r })} theme={theme} />
            ) : null}
            {past.length > 0 ? (
              <RangeGroup title="Past" ranges={past} onOpen={(r) => setEditing({ kind: "edit", range: r })} theme={theme} />
            ) : null}
          </>
        )}
      </ScrollView>

      {editingShown ? (
        <AwaySheet
          key={editingShown.kind === "edit" ? editingShown.range.id : "new"}
          visible={editing !== null}
          onDismissed={editingGone}
          editing={editingShown}
          theme={theme}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </View>
  );
}

function RangeGroup({
  title,
  ranges,
  onOpen,
  theme,
}: {
  title: string;
  ranges: AwayRange[];
  onOpen: (r: AwayRange) => void;
  theme: ThemeTokens;
}) {
  return (
    <Group theme={theme} title={title} flush>
      {ranges.map((r, i) => (
        <View key={r.id}>
          {i > 0 ? <GroupDivider theme={theme} /> : null}
          <SettingsRow
            label={r.label ?? "Away"}
            detail={rangeLabel(r)}
            onPress={() => onOpen(r)}
            theme={theme}
          />
        </View>
      ))}
    </Group>
  );
}

function AwaySheet({
  visible,
  editing,
  theme,
  onClose,
  onDismissed,
  onSaved,
}: {
  visible: boolean;
  editing: Editing;
  theme: ThemeTokens;
  onClose: () => void;
  onDismissed: () => void;
  onSaved: () => void;
}) {
  const tomorrow = addDays(currentLocalDate(), 1);
  const existing = editing.kind === "edit" ? editing.range : null;
  const [start, setStart] = useState(existing?.startDate ?? tomorrow);
  const [end, setEnd] = useState(existing?.endDate ?? tomorrow);
  const [label, setLabel] = useState(existing?.label ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setProblem(null);
    setSaving(true);
    try {
      if (existing) await updateAway(existing.id, start, end, label);
      else await addAway(start, end, label);
      onSaved();
      onClose();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      title={existing ? "Time away" : "Add time away"}
      confirm={{ label: "Save", onPress: () => void save(), disabled: end < start || saving }}
    >
      <View style={styles.form}>
        <View style={styles.row}>
          <AppText color={theme.ink} style={styles.grow}>
            First day
          </AppText>
          <DayField
            date={start}
            onChange={(d) => {
              setStart(d);
              if (end < d) setEnd(d);
            }}
            label="First day"
            accent={theme.accent}
            theme={theme}
          />
        </View>
        <View style={styles.row}>
          <AppText color={theme.ink} style={styles.grow}>
            Last day
          </AppText>
          <DayField date={end} onChange={setEnd} label="Last day" accent={theme.accent} theme={theme} />
        </View>
        <TextField
          theme={theme}
          value={label}
          onChangeText={setLabel}
          placeholder="Label (optional)"
          accessibilityLabel="Label"
        />
        {problem ? (
          <AppText variant="footnote" color={theme.muted} accessibilityLiveRegion="polite">
            {problem}
          </AppText>
        ) : null}
        {existing ? (
          <Button
            variant="quiet"
            label="Remove"
            onPress={() =>
              Alert.alert("Remove this time away?", undefined, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () =>
                    void removeAway(existing.id)
                      .then(() => {
                        onSaved();
                        onClose();
                      })
                      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e))),
                },
              ])
            }
            theme={theme}
          />
        ) : null}
      </View>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingTop: space.md, paddingBottom: space.xxl, gap: space.md },
  lead: { marginBottom: space.xs },
  form: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md },
  grow: { flex: 1 },
});
