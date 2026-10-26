/**
 * The Commitments surface: what holds a share of your days, and a way
 * in.
 *
 * Each commitment's share of a day comes from that day (ADR-0044,
 * formula v11), so there is no band to set here. The first block says
 * how it's worked out, in words.
 *
 * Every row here goes somewhere. A row that looks like a list item and
 * does nothing is the commonest small lie in an app, and the fastest
 * way to teach someone that tapping is not worth trying.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import type { CommitmentDetail } from "../../db/commitments";
import { type ThemeTokens, unitHue } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Group } from "../ui/Group";

interface CommitmentsListProps {
  commitments: CommitmentDetail[];
  archived: CommitmentDetail[];
  theme: ThemeTokens;
  onOpen: (id: string) => void;
}

export function CommitmentsList({
  commitments,
  archived,
  theme,
  onOpen,
}: CommitmentsListProps) {
  return (
    <>
      {commitments.length === 0 ? (
        <AppText variant="caption" color={theme.muted}>
          None yet. For example: School, Work, Basketball club.
        </AppText>
      ) : (
        <Group theme={theme} flush>
          {commitments.map((c, i) => (
            <Row
              key={c.id}
              commitment={c}
              // Each commitment shows its own colour (ADR-0043 §4).
              hue={unitHue(theme, c)}
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
          title="Archived"
          footnote="Their history stays in your log. Open one to unarchive it."
          flush
        >
          {archived.map((c, i) => (
            <Row
              key={c.id}
              commitment={c}
              // Each commitment shows its own colour (ADR-0043 §4).
              hue={unitHue(theme, c)}
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
    subs > 0 ? `${subs} ${subs === 1 ? "sub-commitment" : "sub-commitments"}` : null,
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
      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
});
