/**
 * The Log: what actually happened, newest first.
 *
 * **The product's third horizon.** Daily execution had Home; monthly
 * reflection has Portfolio; the "record of a life" that PRODUCT.md names
 * as the long view had no screen at all. Journals and photos were
 * readable only on the day they were written, and achievements were
 * insert-only — earned, then gone. This is where they come back.
 *
 * It took Settings' place in the tab bar. Settings is the one
 * destination here that was never part of the product's loop, and no
 * app this wants to stand beside — Instagram, Apple Music, Netflix,
 * Uber — spends a primary tab on it; it now sits behind the gear in
 * this screen's header, for the reason given at that control.
 *
 * **Memories lead, metrics follow** (design principle 5). A day's score
 * is a small trailing figure, never the headline: what you wrote and
 * what you reached come first.
 *
 * **Photos are photos** (2026-08-26). This screen used to render them as
 * the words "1 photo" — a count of memories, on the one surface whose
 * whole job is to give them back. `loadLog` had returned each photo's
 * `uri` since it was written; nothing was missing but the `<Image>`.
 *
 * **A day is a list of things that happened** (2026-08-26). Notes,
 * achievements and photos used to stack as undifferentiated lines, so a
 * month read as a wall of text with dates in it. Each kind now sits in a
 * glyph gutter that says what it is, and days separate with a hairline
 * instead of running together.
 *
 * **Each month opens with its review**, the same block Portfolio shows
 * for the current one — including the portfolio graph, which no longer
 * appears anywhere else.
 *
 * Empty is the normal state for a new user, so the empty copy says what
 * will fill it rather than apologising for being blank.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MonthReview, monthName } from "../../components/log/MonthReview";
import type { GraphSnapshot } from "../../components/portfolio-graph";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { Group, GroupDivider } from "../../components/ui/Group";
import { LoadFailure, useScreenLoad } from "../../components/ui/ScreenLoad";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { loadGraphSnapshots } from "../../db/graph";
import { loadLog, type LogEntry, type LogMonth } from "../../db/log";
import { currentLocalDate } from "../../db/today";
import { getTheme, SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";

/** "2026-08-19" → "Wed 19". The month is already the section header, so
 *  repeating it on every row would be noise. */
function dayLabel(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  return `${date.toLocaleString(undefined, { weekday: "short" })} ${d}`;
}

/**
 * What a filter chip narrows to.
 *
 * Deliberately five, not a builder. A record is browsed by "show me the
 * photos" or "show me what I reached", which is a handful of named
 * questions — a query UI would be a heavier control answering fewer of
 * them.
 */
type Kind = "all" | "notes" | "photos" | "reached" | "flagged";
const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "notes", label: "Notes" },
  { id: "photos", label: "Photos" },
  { id: "reached", label: "Reached" },
  { id: "flagged", label: "Kept" },
];

/**
 * How far back to look.
 *
 * Chips rather than a from–to picker: the app owns no clocks and has
 * avoided date pickers everywhere else (ADR-0015 §4 plans at month
 * granularity), and "recent enough to remember" is the question people
 * actually bring to a log.
 */
type Range = "month" | "quarter" | "year" | "all";
const RANGES: { id: Range; label: string; months: number | null }[] = [
  { id: "month", label: "This month", months: 1 },
  { id: "quarter", label: "3 months", months: 3 },
  { id: "year", label: "This year", months: 12 },
  { id: "all", label: "All time", months: null },
];

/** Does this day hold anything of the kind being asked for? */
function matches(entry: LogEntry, kind: Kind): boolean {
  switch (kind) {
    case "all":
      return true;
    case "notes":
      return entry.notes.length > 0;
    case "photos":
      return entry.photos.length > 0;
    case "reached":
      return entry.achievements.length > 0;
    case "flagged":
      return entry.flagged;
  }
}

/** `YYYY-MM` of the oldest month a range admits, or null for all. */
function cutoff(range: Range, today: string): string | null {
  const months = RANGES.find((r) => r.id === range)?.months ?? null;
  if (months === null) return null;
  const [y, m] = today.split("-").map(Number);
  const back = new Date(y!, m! - 1 - (months - 1), 1);
  return `${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, "0")}`;
}

function Chip({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.surface,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <AppText
        variant="caption"
        color={selected ? theme.onAccent : theme.muted}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export default function LogScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();

  const [months, setMonths] = useState<LogMonth[] | null>(null);
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>([]);
  const [kind, setKind] = useState<Kind>("all");
  const [range, setRange] = useState<Range>("all");
  /** The photo open full screen. Held here rather than inside each day
   *  so the log renders one Modal, not one per entry. */
  const [viewing, setViewing] = useState<string | null>(null);
  /**
   * Photos whose file has gone.
   *
   * Backups are database-only (ADR-0002), so a restore onto a fresh
   * device leaves these rows pointing at files that no longer exist.
   * A log of a life is where an old photo is most likely to be the one
   * that vanished, so it says so rather than showing a broken frame.
   */
  const [missing, setMissing] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const [log, graph] = await Promise.all([loadLog(), loadGraphSnapshots()]);
    setMonths(log);
    setSnapshots(graph);
  }, []);
  const { error, retry } = useScreenLoad(reload);

  const today = currentLocalDate();

  /**
   * Filtering drops days, then drops months left holding nothing.
   *
   * **A month's review survives a range filter but not a kind filter.**
   * Narrowed to photos, a review of a month with no photos in it is an
   * answer to a question nobody asked; narrowed to the last three
   * months, the review is exactly what you came for.
   */
  const shown = useMemo(() => {
    if (months === null) return null;
    const from = cutoff(range, today);
    return months
      .filter((m) => from === null || m.month >= from)
      .map((m) => ({ ...m, entries: m.entries.filter((e) => matches(e, kind)) }))
      .filter((m) => m.entries.length > 0 || (kind === "all" && m.grade.base !== null));
  }, [months, kind, range, today]);

  const filtering = kind !== "all" || range !== "all";
  const multiMonth = (months?.length ?? 0) > 1;

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

      {/* Filters appear once there is something to filter. On a log with
          one month in it they would be five controls over three days. */}
      {months !== null && months.length > 0 ? (
        <View style={styles.filters}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {KINDS.map((k) => (
              <Chip
                key={k.id}
                label={k.label}
                selected={kind === k.id}
                onPress={() => setKind(k.id)}
                theme={theme}
              />
            ))}
          </ScrollView>
          {multiMonth ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {RANGES.map((r) => (
                <Chip
                  key={r.id}
                  label={r.label}
                  selected={range === r.id}
                  onPress={() => setRange(r.id)}
                  theme={theme}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <ScrollView style={styles.body} contentContainerStyle={styles.container}>
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : shown === null ? null : months?.length === 0 ? (
          <View style={styles.empty}>
            <AppText color={theme.ink} style={styles.emptyText}>
              Your notes, photos, and the goals you reach collect here, newest
              first.
            </AppText>
            <AppText variant="caption" color={theme.muted} style={styles.emptyText}>
              Add a note or a photo to a day on Home and it will show up here.
            </AppText>
          </View>
        ) : shown.length === 0 ? (
          /* A filter found nothing — which is information, not a fault,
             so it says what was asked for rather than "no results". */
          <View style={styles.empty}>
            <AppText color={theme.ink} style={styles.emptyText}>
              Nothing here matches that.
            </AppText>
            <Pressable
              onPress={() => {
                setKind("all");
                setRange("all");
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.clear, { opacity: pressed ? 0.5 : 1 }]}
            >
              <AppText variant="label" color={theme.accent}>
                Show everything
              </AppText>
            </Pressable>
          </View>
        ) : (
          shown.map((m) => (
            <View key={m.month} style={styles.month}>
              <AppText variant="title" color={theme.ink} style={styles.monthName}>
                {monthName(m.month)}
              </AppText>

              {/* Hidden while a kind filter is on — see `shown`. */}
              {kind === "all" ? (
                <MonthReview month={m} snapshots={snapshots} theme={theme} />
              ) : null}

              {m.entries.length > 0 ? (
                <Group theme={theme} flush>
                  {m.entries.map((entry, i) => (
                    <View key={entry.localDate}>
                      {i > 0 ? <GroupDivider theme={theme} /> : null}
                      <DayEntry
                        entry={entry}
                        theme={theme}
                        missing={missing}
                        onView={setViewing}
                        onMissing={(id) =>
                          setMissing((prev) => new Set(prev).add(id))
                        }
                      />
                    </View>
                  ))}
                </Group>
              ) : null}
            </View>
          ))
        )}
        {filtering && shown !== null && shown.length > 0 ? (
          <Pressable
            onPress={() => {
              setKind("all");
              setRange("all");
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.clear, { opacity: pressed ? 0.5 : 1 }]}
          >
            <AppText variant="caption" color={theme.muted}>
              Showing a slice of your log · show everything
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* View only. Deleting a photo belongs on the day it happened,
          where the rest of that day is around it for context — the log
          is a record, and a record you can edit in passing is a worse
          one. Tapping anywhere closes, the way a camera roll does. */}
      <Modal
        visible={viewing !== null}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <Pressable
          style={styles.photoViewer}
          onPress={() => setViewing(null)}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          {viewing !== null ? (
            <Image
              source={{ uri: viewing }}
              style={styles.photoFull}
              contentFit="contain"
            />
          ) : null}
          <View style={[styles.viewerClose, { top: insets.top + space.lg }]}>
            <Ionicons name="close" size={26} color="#ffffff" />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * One day of the record: a dated head, then the things that happened
 * under it in a glyph gutter.
 *
 * The gutter is what makes a day scannable. Without it a note, a goal
 * reached and a caption are three lines of text that differ only in
 * colour, and a month of them is a wall — which is what this looked
 * like before. With it, you can tell at a glance whether a day holds
 * writing or an achievement without reading either.
 */
function DayEntry({
  entry,
  theme,
  missing,
  onView,
  onMissing,
}: {
  entry: LogEntry;
  theme: ThemeTokens;
  missing: ReadonlySet<string>;
  onView: (uri: string) => void;
  onMissing: (id: string) => void;
}) {
  /**
   * One photo gets the width; several share it as a wrapping grid.
   *
   * A lone photo is the common case in a log and the one worth seeing
   * properly — shrinking it to a thumbnail for consistency with days
   * that have four would be consistency at the expense of the thing the
   * screen is for. The grid **wraps** rather than scrolling sideways
   * like the day record's row does: this list is already a vertical
   * scroll of many days, and a horizontal scroller inside each one
   * fights the gesture it sits in.
   */
  const single = entry.photos.length === 1;

  return (
    <View style={styles.day}>
      <View style={styles.dayHead}>
        <AppText variant="caption" color={theme.muted} tabular>
          {dayLabel(entry.localDate)}
        </AppText>
        {/* `flagged` has been in the data since the log was written and
            has never once been drawn. A day someone marked as worth
            keeping should look different from one they didn't. */}
        {entry.flagged ? (
          <Ionicons name="bookmark" size={13} color={theme.accent} />
        ) : null}
        {entry.title ? (
          <AppText variant="label" color={theme.ink} style={styles.grow} numberOfLines={1}>
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
        <View key={title} style={styles.item}>
          <View style={styles.gutter}>
            <Ionicons name="trophy-outline" size={14} color={theme.accent} />
          </View>
          <AppText color={theme.accent} style={styles.grow}>
            {title}
          </AppText>
        </View>
      ))}

      {entry.notes.map((body, i) => (
        <View key={`${entry.localDate}-note-${i}`} style={styles.item}>
          <View style={styles.gutter}>
            <Ionicons name="create-outline" size={14} color={theme.muted} />
          </View>
          <AppText color={theme.ink} numberOfLines={6} style={styles.note}>
            {body}
          </AppText>
        </View>
      ))}

      {entry.photos.length > 0 ? (
        <View style={single ? styles.photoSolo : styles.photoGrid}>
          {entry.photos.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => onView(p.uri)}
              accessibilityRole="imagebutton"
              accessibilityLabel={
                p.caption ?? `Photo from ${dayLabel(entry.localDate)}`
              }
              accessibilityHint="Opens full screen"
              style={({ pressed }) => [
                single ? styles.soloFrame : styles.gridFrame,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Image
                source={{ uri: p.uri }}
                style={styles.photoFill}
                contentFit="cover"
                placeholder={null}
                onError={() => onMissing(p.id)}
              />
              {missing.has(p.id) ? (
                <View style={[styles.photoMissing, { borderColor: theme.hairline }]}>
                  <AppText
                    variant="caption"
                    color={theme.muted}
                    style={styles.centerText}
                  >
                    Photo not in this backup
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Only under a lone photo, where there is room for it to read as
          a caption rather than as a label on a tile. */}
      {single && entry.photos[0]?.caption ? (
        <AppText variant="caption" color={theme.muted} style={styles.caption}>
          {entry.photos[0].caption}
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

  filters: { gap: space.sm, paddingBottom: space.sm },
  chipRow: { gap: space.sm, paddingHorizontal: space.screen },
  chip: {
    minHeight: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  month: { marginBottom: space.lg },
  /** The month owns its own title rather than borrowing the Group's, so
   *  the review and the days below it read as two parts of one month
   *  instead of two unrelated blocks. */
  monthName: { marginTop: space.xl, marginBottom: space.xs },

  day: { gap: space.xs, paddingVertical: space.md },
  dayHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },

  /** The glyph gutter: one column, so notes and achievements line up
   *  down the day whatever they are. */
  item: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  gutter: { width: 16, alignItems: "center", paddingTop: 3 },
  /** A reading measure for journal text, which is the only real prose
   *  on this screen. */
  note: { flex: 1, maxWidth: 460 },
  caption: { marginTop: space.xs },

  photoSolo: { marginTop: space.xs },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.xs,
  },
  /** Landscape-ish rather than square: most photos of a day are, and a
   *  square crop of one is the app choosing what to cut. */
  soloFrame: {
    width: "100%",
    height: 200,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  /** Fixed rather than a percentage: percentage bases plus `gap` round
   *  differently across widths and overflow the row at the third tile.
   *  104 fits three across the screen gutters on a 375pt phone and
   *  wraps to two on a 320. */
  gridFrame: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  photoFill: { width: "100%", height: "100%" },
  photoMissing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xs,
  },
  centerText: { textAlign: "center" },
  photoViewer: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
  },
  photoFull: { width: "100%", height: "100%" },
  viewerClose: { position: "absolute", right: space.xl },

  /** 44pt target around a 22pt glyph, per HIG. */
  gear: { minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
  empty: { marginTop: space.xxxl, gap: space.sm },
  emptyText: { maxWidth: 340 },
  clear: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
});
