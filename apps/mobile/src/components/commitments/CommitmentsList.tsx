/**
 * The Commitments surface: the band, what holds it, and a way in.
 *
 * **The band leads.** It is the number that decides what every
 * commitment task is worth, it is invisible everywhere else, and a
 * setting that consequential should not be buried behind a gear. So it
 * is the first row, it states its own effect in words, and it is
 * tappable — the shape Apple Music uses for the row that opens the
 * thing the screen is about.
 *
 * Every row here goes somewhere. A row that looks like a list item and
 * does nothing is the commonest small lie in an app, and the fastest
 * way to teach someone that tapping is not worth trying.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { commitmentBandMax } from "@glide/scoring";
import { Pressable, StyleSheet, View } from "react-native";

import type { CommitmentDetail } from "../../db/commitments";
import { type ThemeTokens, wash } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Group } from "../ui/Group";

interface CommitmentsListProps {
  band: number | null;
  commitments: CommitmentDetail[];
  archived: CommitmentDetail[];
  hue: string;
  theme: ThemeTokens;
  onOpenBand: () => void;
  onOpen: (id: string) => void;
}

export function CommitmentsList({
  band: setting,
  commitments,
  archived,
  hue,
  theme,
  onOpenBand,
  onOpen,
}: CommitmentsListProps) {
  // What the band actually is today: the setting, held to the cap for
  // how many commitments there are (ADR-0032 §2). A setting of 80 kept
  // from three commitments reads 70 once one is archived.
  const band = setting === null ? null : Math.min(setting, commitmentBandMax(commitments.length));
  return (
    <>
      {/* The band, stated as what it does rather than as a number
          needing interpretation. Off is a real state and says so. */}
      <Pressable
        onPress={onOpenBand}
        style={({ pressed }) => [
          styles.band,
          {
            backgroundColor: wash(hue, theme),
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          band === null
            ? "Commitments scoring is off. Turn it on."
            : `Commitments take ${band} percent of a scheduled day. Change.`
        }
      >
        <View style={styles.grow}>
          <AppText variant="caption" color={theme.muted}>
            {band === null ? "Not scoring yet" : "On a scheduled day"}
          </AppText>
          <AppText variant="title" color={theme.ink}>
            {band === null ? "Set a share" : `${band}% of the day`}
          </AppText>
          <AppText variant="caption" color={theme.muted}>
            {band === null
              ? "Choose how much of a day your commitments are worth."
              : `The rest of your life keeps ${100 - band}%. Free days are unchanged.`}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.muted} />
      </Pressable>

      {commitments.length === 0 ? (
        <View style={styles.empty}>
          <AppText color={theme.ink} style={styles.centred}>
            A commitment is something with a schedule that takes a real part
            of your week.
          </AppText>
          <AppText
            variant="caption"
            color={theme.muted}
            style={styles.centred}
          >
            School, a job, a team. Its classes or shifts live inside it, and
            its work is scored from its own share of the day rather than
            competing with the rest of your life.
          </AppText>
        </View>
      ) : (
        <Group theme={theme} flush>
          {commitments.map((c, i) => (
            <Row
              key={c.id}
              commitment={c}
              hue={hue}
              theme={theme}
              onPress={() => onOpen(c.id)}
              last={i === commitments.length - 1}
            />
          ))}
        </Group>
      )}

      {archived.length > 0 ? (
        <Group
          theme={theme}
          title="Finished"
          footnote="Their history stays in your log. Open one to bring it back."
          flush
        >
          {archived.map((c, i) => (
            <Row
              key={c.id}
              commitment={c}
              hue={hue}
              theme={theme}
              onPress={() => onOpen(c.id)}
              last={i === archived.length - 1}
              dimmed
            />
          ))}
        </Group>
      ) : null}
    </>
  );
}

function Row({
  commitment,
  hue,
  theme,
  onPress,
  last,
  dimmed,
}: {
  commitment: CommitmentDetail;
  hue: string;
  theme: ThemeTokens;
  onPress: () => void;
  last: boolean;
  dimmed?: boolean;
}) {
  const subs = commitment.subCommitments.length;
  // Says what is inside without making the reader count. Direct tasks
  // are folded into the total rather than listed separately — the
  // distinction matters to the scorer, not to someone scanning.
  const detail = [
    subs > 0 ? `${subs} ${subs === 1 ? "part" : "parts"}` : null,
    commitment.taskCount > 0
      ? `${commitment.taskCount} ${commitment.taskCount === 1 ? "task" : "tasks"}`
      : "No tasks yet",
  ]
    .filter((x): x is string => x !== null)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last
          ? {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.hairline,
            }
          : null,
        { opacity: pressed ? 0.6 : dimmed === true ? 0.55 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${commitment.name}. ${detail}.`}
    >
      <View style={[styles.pip, { backgroundColor: hue }]} />
      <View style={styles.grow}>
        <AppText variant="headline" color={theme.ink}>
          {commitment.name}
        </AppText>
        <AppText variant="caption" color={theme.muted}>
          {detail}
        </AppText>
      </View>
      {dimmed !== true ? (
        <AppText variant="label" color={theme.muted}>
          {commitment.sharePercent}%
        </AppText>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderRadius: radius.lg,
    padding: space.lg,
    // Nothing below it: a Group carries its own top margin, and the
    // empty state its own padding.
    marginTop: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 60,
  },
  pip: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
  empty: { gap: space.sm, paddingVertical: space.xxl },
  centred: { textAlign: "center" },
});
