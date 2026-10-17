/**
 * The day's record, and one activity row.
 *
 * Split out of the Today screen (2026-08-19), which had grown to 1,526
 * lines. These two were already separate functions sharing that file's
 * stylesheet and nothing else — the only real coupling was three style
 * keys, which are small enough to state here rather than reach for.
 *
 * The record is the half of the day that is *not* the checklist:
 * journal entries and photos, shown only once there is something to
 * show.
 *
 * **Editing used to be long-press only, and that was unfindable.** The
 * argument for it still holds — a row of edit and delete glyphs beside
 * every note turns a record into a list of chores — but the conclusion
 * was wrong: a feature nobody can discover is not a quiet feature, it
 * is an absent one. The tell was that VoiceOver users had it better
 * than sighted ones, since the same two actions were already exposed as
 * accessibility actions and announced.
 *
 * Each answers it in the way its own medium expects:
 *
 * - **A note** gets one recessive overflow glyph at its right edge.
 *   Muted, not Ink, so a column of notes still reads as writing rather
 *   than as rows with controls on them.
 * - **A photo** gets nothing on the thumbnail. Tapping already opens it
 *   full screen, which is where every photo app on the phone puts its
 *   options, so the control lives in the viewer and the grid stays a
 *   grid.
 *
 * Long press still works everywhere it did. It is now the shortcut
 * rather than the only door.
 *
 * Since Phase 3c both open a native iOS menu (`ActionMenu`), the same
 * kind as the + menu, in place of the app's own card.
 */
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AppText } from "../ui/AppText";
import type { DayData, TodayActivity } from "../../db/today";
import { type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { ActionMenu } from "../ui/ActionMenu";
import { PhotoViewer } from "../ui/PhotoViewer";

export function DayRecord({
  day,
  theme,
  onEditNote,
  onDeleteNote,
  onDeletePhoto,
}: {
  day: DayData;
  theme: ThemeTokens;
  onEditNote: (note: { id: string; body: string }) => void;
  onDeleteNote: (id: string) => void;
  onDeletePhoto: (id: string) => void;
}) {
  const [viewing, setViewing] = useState<string | null>(null);
  const [missingPhotos, setMissingPhotos] = useState<Set<string>>(new Set());
  if (day.journal.length === 0 && day.photos.length === 0) return null;
  return (
    <View style={[styles.band, { borderTopColor: theme.hairline }]}>
      <AppText variant="caption" color={theme.muted}>
        {day.date === day.today ? "Today's notes" : "From this day"}
      </AppText>
      {day.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.photoRow}>
            {day.photos.map((p) => (
              // Tap opens it full screen, where Delete also lives; a
              // long press opens the native menu (ADR-0043 §1).
              <ActionMenu
                key={p.id}
                sizing="content"
                more={false}
                label={p.caption ?? "Photo from this day"}
                hint="Opens it full screen"
                moreColor={theme.muted}
                onPress={() => setViewing(p.uri)}
                actions={[
                  {
                    label: "Delete",
                    icon: "trash",
                    destructive: true,
                    onPress: () => onDeletePhoto(p.id),
                  },
                ]}
              >
                <View accessibilityLabel={p.caption ?? "Photo from this day"}>
                  <Image
                    source={{ uri: p.uri }}
                    style={styles.photoThumb}
                    contentFit="cover"
                    // Backups are database-only for now (ADR-0002), so a
                    // restore onto a fresh device leaves these rows
                    // pointing at files that no longer exist. Say what
                    // happened instead of showing a broken frame.
                    placeholder={null}
                    onError={() => setMissingPhotos((m) => new Set(m).add(p.id))}
                  />
                  {missingPhotos.has(p.id) ? (
                    <View style={[styles.photoMissing, { borderColor: theme.hairline }]}>
                      <AppText variant="caption" color={theme.muted} style={styles.centerText}>
                        Photo not in this backup
                      </AppText>
                    </View>
                  ) : null}
                </View>
              </ActionMenu>
            ))}
          </View>
        </ScrollView>
      ) : null}
      {/* A tap edits the note; a long press or the ••• opens the native
          menu, Edit and Delete, in the same style as the + menu
          (Henry, 2026-10-16). */}
      {day.journal.map((j) => (
        <ActionMenu
          key={j.id}
          label={j.body}
          hint="Edits the note"
          moreColor={theme.muted}
          onPress={() => onEditNote({ id: j.id, body: j.body })}
          actions={[
            {
              label: "Edit",
              icon: "pencil",
              onPress: () => onEditNote({ id: j.id, body: j.body }),
            },
            {
              label: "Delete",
              icon: "trash",
              destructive: true,
              onPress: () => onDeleteNote(j.id),
            },
          ]}
        >
          <View style={styles.noteRow}>
            <AppText color={theme.ink} style={styles.noteText}>
              {j.body}
            </AppText>
          </View>
        </ActionMenu>
      ))}

      <PhotoViewer
        uri={viewing}
        onClose={() => setViewing(null)}
        onDelete={() => {
          const id = day.photos.find((p) => p.uri === viewing)?.id;
          if (id) onDeletePhoto(id);
        }}
      />
    </View>
  );
}

export function ActivityRow({
  activity,
  dayKind,
  disabled,
  onPress,
  theme,
}: {
  activity: TodayActivity;
  dayKind: DayData["kind"];
  disabled: boolean;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}${
        activity.creditedPoints > 0 ? `, ${activity.creditedPoints} points` : ""
      }. Opens to edit.`}
      style={({ pressed }) => [styles.activityRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.tagDots}>
        {(activity.tags.length > 0 ? activity.tags : [null]).map((tag, i) => (
          <View
            key={tag ? tag.unitId : `plain-${i}`}
            style={[
              styles.tagDot,
              {
                backgroundColor: tag
                  ? theme.areas[tag.areaId] ?? theme.muted
                  : theme.hairline,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.activityText}>
        <AppText color={theme.ink} numberOfLines={1}>
          {activity.title}
        </AppText>
        {activity.note ? (
          <AppText variant="footnote" color={theme.muted} numberOfLines={1}>
            {activity.note}
          </AppText>
        ) : null}
      </View>
      {activity.creditedPoints > 0 && dayKind === "normal" ? (
        <AppText variant="footnote" color={theme.accent} tabular>
          +{activity.creditedPoints}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  band: {
    marginTop: space.xl,
    paddingTop: space.md,
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  centerText: { textAlign: "center" },
  photoRow: { flexDirection: "row", gap: space.sm },
  photoThumb: { width: 110, height: 110, borderRadius: radius.lg },
  photoMissing: {
    ...StyleSheet.absoluteFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xs,
  },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  noteText: { flex: 1 },
  /** Shared with the Today screen's own drop confirmation; small enough
   *  that stating it twice beats a shared style module. */
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
  },
  activityText: { flex: 1, gap: 1 },
  tagDots: { flexDirection: "row", gap: 3 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
});
