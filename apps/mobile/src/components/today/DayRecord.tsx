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
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../ui/AppText";
import type { DayData, TodayActivity } from "../../db/today";
import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";

/** What a long press is targeting: a journal entry or a photo. */
type RecordTarget =
  | { kind: "note"; id: string; body: string }
  | { kind: "photo"; id: string };

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
  const insets = useSafeAreaInsets();
  const [viewing, setViewing] = useState<string | null>(null);
  const [missingPhotos, setMissingPhotos] = useState<Set<string>>(new Set());
  /** Long-press target. Press-and-hold rather than a visible control
   *  per item: the record is meant to read as a record, and a row of
   *  edit/delete glyphs beside every note would make it read as a
   *  list of things to manage. */
  const [target, setTarget] = useState<RecordTarget | null>(null);
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
              <Pressable
                key={p.id}
                onPress={() => setViewing(p.uri)}
                onLongPress={() => {
                  void Haptics.selectionAsync();
                  setTarget({ kind: "photo", id: p.id });
                }}
                delayLongPress={350}
                accessibilityRole="imagebutton"
                accessibilityLabel={p.caption ?? "Photo from this day. Opens full screen."}
                accessibilityHint="Opens full screen, where you can delete it"
                accessibilityActions={[{ name: "magicTap", label: "Delete photo" }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === "magicTap") onDeletePhoto(p.id);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
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
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
      {day.journal.map((j) => (
        <Pressable
          key={j.id}
          onPress={() => setTarget({ kind: "note", id: j.id, body: j.body })}
          onLongPress={() => {
            void Haptics.selectionAsync();
            setTarget({ kind: "note", id: j.id, body: j.body });
          }}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={j.body}
          accessibilityHint="Opens options for this note"
          // Screen readers cannot long-press, so the same two actions
          // are exposed as accessibility actions.
          accessibilityActions={[
            { name: "activate", label: "Edit note" },
            { name: "magicTap", label: "Delete note" },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "activate") {
              onEditNote({ id: j.id, body: j.body });
            }
            if (e.nativeEvent.actionName === "magicTap") onDeleteNote(j.id);
          }}
          style={({ pressed }) => [styles.noteRow, { opacity: pressed ? 0.6 : 1 }]}
        >
          <AppText color={theme.ink} style={styles.noteText}>
            {j.body}
          </AppText>
          {/* Visible, but the quietest thing in the row. `importantFor
              Accessibility` is off because the parent already exposes
              both actions; announcing a third control would make one
              note read as two. */}
          <View
            style={styles.noteMore}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={theme.muted} />
          </View>
        </Pressable>
      ))}

      {/* Options for whatever was held. Deliberately a plain sheet
          rather than a destructive-action confirm: deleting one note
          is small and the alternative is a two-step flow on the most
          common case. */}
      <Modal
        visible={target !== null}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setTarget(null)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setTarget(null)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <View
            style={[
              styles.menuCard,
              { backgroundColor: theme.canvas, borderColor: theme.hairline },
            ]}
          >
            {target?.kind === "note" ? (
              <Pressable
                onPress={() => {
                  const t = target;
                  setTarget(null);
                  onEditNote({ id: t.id, body: t.body });
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
              >
                <AppText color={theme.ink}>Edit</AppText>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                const t = target;
                setTarget(null);
                if (!t) return;
                if (t.kind === "note") onDeleteNote(t.id);
                else onDeletePhoto(t.id);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
            >
              <AppText color={theme.danger}>Delete</AppText>
            </Pressable>
            <Pressable
              onPress={() => setTarget(null)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
            >
              <AppText color={theme.muted}>Cancel</AppText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
          {viewing ? (
            <Image
              source={{ uri: viewing }}
              style={styles.photoFull}
              contentFit="contain"
            />
          ) : null}
          {/* Where a photo's options belong: on the photo, full screen,
              the way every camera roll on the phone does it. Absolute so
              it sits over the image without changing how it fits, and
              inset by the safe area because a viewer is edge to edge. */}
          {viewing ? (
            <Pressable
              onPress={() => {
                const id = day.photos.find((p) => p.uri === viewing)?.id;
                setViewing(null);
                if (id) onDeletePhoto(id);
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Delete this photo"
              style={({ pressed }) => [
                styles.photoDelete,
                { top: insets.top + space.lg, opacity: pressed ? 0.5 : 1 },
              ]}
            >
              <Ionicons name="trash-outline" size={22} color="#ffffff" />
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
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
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xs,
  },
  photoViewer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoFull: { width: "100%", height: "100%" },
  photoDelete: { position: "absolute", right: space.screen, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  noteText: { flex: 1 },
  /** 44pt of target around a 16pt glyph, aligned to the note's first
   *  line rather than centred on a paragraph that may run long. */
  noteMore: { minWidth: 32, minHeight: 24, alignItems: "flex-end", justifyContent: "center" },
  /** Shared with the Today screen's own drop confirmation; small enough
   *  that stating it twice beats a shared style module. */
  menuBackdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.screen,
  },
  menuCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.xs,
  },
  menuRow: { minHeight: 48, alignItems: "center", justifyContent: "center" },
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
