/**
 * The Log: what actually happened, newest first.
 *
 * **The product's third horizon, and until now the missing one.**
 * Daily execution had Home; monthly reflection has Portfolio; the
 * "record of a life" that PRODUCT.md names as the long view had no
 * screen at all. Journals and photos were readable only on the day
 * they were written, and achievements were insert-only — earned, then
 * gone. This is where they come back.
 *
 * It took Settings' place in the tab bar. Settings is the one
 * destination here that was never part of the product's loop, and no
 * app this wants to stand beside — Instagram, Apple Music, Netflix,
 * Uber — spends a primary tab on it; it now sits behind the gear in
 * this screen's header, for the reason given at that control.
 *
 * **Memories lead, metrics follow** (design principle 5). A day's
 * score is a small trailing figure, never the headline: what you wrote
 * and what you reached come first, and a day with only a number does
 * not appear at all. That is the ranking the principle asks for, made
 * literal in the layout.
 *
 * Empty is the normal state for a new user, so the empty copy says what
 * will fill it rather than apologising for being blank.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import { AppText } from "../../components/ui/AppText";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { Group } from "../../components/ui/Group";
import { LoadFailure, useScreenLoad } from "../../components/ui/ScreenLoad";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { loadLog, type LogEntry, type LogMonth } from "../../db/log";
import { getTheme, type ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";

/** "2026-08" → "August 2026". Written out rather than abbreviated: this
 *  is a section title in a record, not a chart axis. */
function monthName(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return `${date.toLocaleString(undefined, { month: "long" })} ${year}`;
}

/** "2026-08-19" → "Wed 19". The month is already the section header, so
 *  repeating it on every row would be noise. */
function dayLabel(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  return `${date.toLocaleString(undefined, { weekday: "short" })} ${d}`;
}

/** One line naming what a month holds, so a collapsed month still says
 *  something. Only the kinds actually present are mentioned. */
function monthSummary(totals: LogMonth["totals"]): string {
  const parts = [
    totals.notes > 0 ? `${totals.notes} note${totals.notes === 1 ? "" : "s"}` : null,
    totals.photos > 0 ? `${totals.photos} photo${totals.photos === 1 ? "" : "s"}` : null,
    totals.achievements > 0
      ? `${totals.achievements} reached`
      : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export default function LogScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [months, setMonths] = useState<LogMonth[] | null>(null);

  const reload = useCallback(async () => {
    setMonths(await loadLog());
  }, []);
  const { error, retry } = useScreenLoad(reload);

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      {/* Settings lives here rather than in the tab bar. Of the five
          screens, this is the one that is *yours* — your record — which
          makes it the nearest thing the app has to the profile surface
          Instagram and Netflix hang settings from. Home's header is not
          the place: the grade is its hero and a gear beside it competes. */}
      <ScreenHeader
        title="Log"
        theme={theme}
        right={
          <Pressable
            onPress={() => router.push("/settings" as Href)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={({ pressed }) => [styles.gear, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="settings-outline" size={22} color={theme.muted} />
          </Pressable>
        }
      />
      <ScrollView style={styles.body} contentContainerStyle={styles.container}>
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : months === null ? null : months.length === 0 ? (
          <View style={styles.empty}>
            <AppText color={theme.ink} style={styles.emptyText}>
              Your notes, photos, and the goals you reach collect here, newest
              first.
            </AppText>
            <AppText variant="caption" color={theme.muted} style={styles.emptyText}>
              Add a note or a photo to a day on Home and it will show up here.
            </AppText>
          </View>
        ) : (
          months.map((m) => (
            <Group
              key={m.month}
              theme={theme}
              title={monthName(m.month)}
              footnote={monthSummary(m.totals)}
            >
              {m.entries.map((entry) => (
                <DayEntry key={entry.localDate} entry={entry} theme={theme} />
              ))}
            </Group>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/**
 * One day of the record.
 *
 * The date is a quiet caption on the left and everything else is the
 * content, so a month reads as a column of things that happened rather
 * than a column of dates.
 */
function DayEntry({ entry, theme }: { entry: LogEntry; theme: ThemeTokens }) {
  return (
    <View style={styles.day}>
      <View style={styles.dayHead}>
        <AppText variant="caption" color={theme.muted} tabular>
          {dayLabel(entry.localDate)}
        </AppText>
        {entry.title ? (
          <AppText variant="label" color={theme.ink} style={styles.grow}>
            {entry.title}
          </AppText>
        ) : (
          <View style={styles.grow} />
        )}
        {/* The score trails, deliberately small. Principle 5: over time
            the memory matters more than the number beside it. */}
        {entry.score !== null ? (
          <AppText variant="footnote" color={theme.muted} tabular>
            {entry.score}
          </AppText>
        ) : null}
      </View>

      {entry.achievements.map((title) => (
        <AppText key={title} color={theme.accent}>
          {title}
        </AppText>
      ))}

      {entry.notes.map((body, i) => (
        <AppText
          key={`${entry.localDate}-note-${i}`}
          color={theme.ink}
          numberOfLines={4}
          style={styles.note}
        >
          {body}
        </AppText>
      ))}

      {entry.photos.length > 0 ? (
        <AppText variant="caption" color={theme.muted}>
          {entry.photos.length} photo{entry.photos.length === 1 ? "" : "s"}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  body: { flex: 1 },
  container: {
    paddingHorizontal: space.screen,
    paddingTop: space.sm,
    paddingBottom: space.xxxl,
  },
  day: { gap: space.xs, paddingVertical: space.sm },
  dayHead: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  grow: { flex: 1 },
  /** A reading measure for journal text, which is the only real prose
   *  on this screen. */
  note: { maxWidth: 460 },
  /** 44pt target around a 22pt glyph, per HIG. */
  gear: { minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
  empty: { marginTop: space.xxxl, gap: space.sm },
  emptyText: { maxWidth: 340 },
});
