/**
 * The Life tab: Priorities and your commitments.
 *
 * Commitments are what you're in the middle of: a course, a job, a
 * team, with a schedule and its own share of a scheduled day
 * (ADR-0035, ADR-0044).
 *
 * **Goals are hidden until Phase 10** rebuilds them as the four kinds
 * the app can count (ADR-0042), with templates. The old goal screens
 * went with the old goals in Phase 5c, and nothing stands in for them
 * meanwhile, so this tab shows no goals and offers none.
 */
import { router, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import {
  CommitmentSheet,
  type CommitmentSheetMode,
} from "../../../components/commitments/CommitmentSheet";
import { CommitmentsList } from "../../../components/commitments/CommitmentsList";
import { openAdd, TabToolbar } from "../../../components/nav/TabToolbar";
import { AppText } from "../../../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../../../components/ui/Backdrop";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { Button } from "../../../components/ui/Button";
import { Group } from "../../../components/ui/Group";
import { SettingsRow } from "../../../components/ui/SettingsRow";
import {
  loadCommitmentsScreen,
  type CommitmentsScreenData,
} from "../../../db/commitments";
import { createCommitment } from "../../../db/commitmentWrites";
import { getTheme } from "../../../theme/colors";
import { space } from "../../../theme/tokens";
import { useRetained } from "../../../hooks/useRetained";

export default function LifeScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [commitments, setCommitments] = useState<CommitmentsScreenData | null>(
    null,
  );
  const [sheetMode, setSheetMode] = useState<CommitmentSheetMode | null>(null);

  const reload = useCallback(async () => {
    setCommitments(await loadCommitmentsScreen());
  }, []);

  const { error, retry } = useScreenLoad(reload);
  const [sheetModeShown, sheetModeGone] = useRetained(sheetMode);

  return (
    <View style={styles.root}>
      {/* The scroll view comes first so the large title and the tab bar
          follow it, so the backdrop goes inside it. */}
      <ScrollView
        style={styles.body}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        {/* Priorities until Phase 6 rebuilds it as tiers: today's ranking
            screen, which used to be the Portfolio tab (spec §5, Life). */}
        <Group theme={theme} flush>
          <SettingsRow
            label="Priorities"
            hint="Opens your priority order"
            onPress={() => router.push("/priorities" as Href)}
            theme={theme}
          />
        </Group>

        <AppText variant="headline" color={theme.ink} style={styles.heading}>
          Commitments
        </AppText>

        {commitments !== null ? (
          <View style={styles.addBar}>
            {commitments.canAddMore ? (
              <Button
                variant="tonal"
                icon="add"
                label="Add commitment"
                onPress={() => setSheetMode({ kind: "commitment" })}
                theme={theme}
              />
            ) : (
              /* The cap says why rather than showing a dead control.
                 A disabled button with no explanation is the version of
                 this that makes people tap twice and give up. */
              <AppText variant="caption" color={theme.muted}>
                Three commitments is the most at once. Archive one to add
                another.
              </AppText>
            )}
          </View>
        ) : null}
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : commitments === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : (
          <CommitmentsList
            commitments={commitments.commitments}
            archived={commitments.archived}
            hue={theme.areas["work-money"] ?? theme.accent}
            theme={theme}
            onOpen={(id) => router.push(`/goals/commitment/${id}` as Href)}
          />
        )}
      </ScrollView>

      <TabToolbar
        onTask={() => openAdd("task")}
        onEvent={() => openAdd("event")}
        onLog={() => openAdd("activity")}
        settings
      />

      {sheetModeShown !== null ? (
        <CommitmentSheet
          visible={sheetMode !== null}
          onDismissed={sheetModeGone}
          mode={sheetModeShown}
          theme={theme}
          onClose={() => setSheetMode(null)}
          onSave={async ({ name, usesSubCommitments }) => {
            await createCommitment({ name, usesSubCommitments });
            setSheetMode(null);
            await reload();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { paddingTop: space.lg, paddingBottom: space.sm },
  addBar: { paddingBottom: space.sm },
  root: { flex: 1 },
  /** Takes the space between the fixed header and the tab bar; the
   *  list scrolls inside it while both stay put. */
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xl },
});
