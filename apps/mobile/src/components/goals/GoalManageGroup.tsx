/**
 * Things you do *to* a goal (ADR-0007): pause, revise, set aside,
 * delete. A quiet group at the foot of the screen, where the settings
 * screen keeps its own equivalents, so the substance of the goal opens
 * above the fold.
 */
import type { GoalDetail } from "../../db/goals";
import type { ThemeTokens } from "../../theme/colors";
import { Group, GroupDivider } from "../ui/Group";
import { SettingsRow } from "../ui/SettingsRow";

export function GoalManageGroup({
  status,
  onPause,
  onRevise,
  onSetAside,
  onDelete,
  theme,
}: {
  status: GoalDetail["status"];
  onPause: () => void;
  onRevise: () => void;
  onSetAside: () => void;
  onDelete: () => void;
  theme: ThemeTokens;
}) {
  const setAside = (
    <SettingsRow
      label="Set aside"
      detail="The honest ending for a goal you tried. Revivable any time."
      onPress={onSetAside}
      theme={theme}
    />
  );
  return (
    <Group theme={theme} title="Manage" flush>
      {status === "active" ? (
        <>
          <SettingsRow
            label="Pause"
            detail="Stops for now. Its tasks stay in your plan."
            onPress={onPause}
            theme={theme}
          />
          <GroupDivider theme={theme} />
          <SettingsRow
            label="Revise"
            detail="Rewrite it as a new goal, linked back to this one."
            onPress={onRevise}
            theme={theme}
          />
          <GroupDivider theme={theme} />
          {setAside}
          <GroupDivider theme={theme} />
        </>
      ) : null}
      {status === "paused" ? (
        <>
          {setAside}
          <GroupDivider theme={theme} />
        </>
      ) : null}
      {/* Below every lifecycle action and quieter than all of them: for a
          goal you actually tried, "Set aside" is the honest end and this
          is not (ADR-0007 §1). This is for the goal you mistyped or never
          meant — anything it achieved survives it. */}
      <SettingsRow
        label="Delete goal"
        detail="For a goal you never meant to make."
        destructive
        hint="Asks before deleting"
        onPress={onDelete}
        theme={theme}
      />
    </Group>
  );
}
