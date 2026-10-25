/**
 * Onboarding's commitments step (ADR-0045 §1 step 3, spec §5.11):
 * "Anything with set hours?" Pick Student, 9–5 job, Shift work or
 * Nothing fixed, then add up to three commitments with their events.
 *
 * The choice fills in the hours step and, for shift work, makes new
 * events one-time (`events_default_once`, as Settings → Your days sets
 * it). It creates nothing itself. Events default to weekly for 12 weeks
 * (`RepeatLength`), and each one is saved as it's added, so leaving
 * and coming back shows what's already there.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { createCommitment } from "../../db/commitmentWrites";
import type { PlanCommitment } from "../../db/tasks";
import { useRetained } from "../../hooks/useRetained";
import { SCHEDULE_TEMPLATES, type TemplateId } from "../../lib/onboardingTemplates";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { CommitmentSheet } from "../commitments/CommitmentSheet";
import { EventSheet } from "../plan/EventSheet";
import { eventWhen, ItemRow } from "../plan/ItemRow";
import { savedOrSaid, saveNewEvent } from "../plan/saveEvent";
import { AppText } from "../ui/AppText";
import { Group } from "../ui/Group";
import { OutlineAction } from "../ui/OutlineAction";

/** ADR-0035 §1. */
const MAX_COMMITMENTS = 3;

/** Which sheet is open: a new commitment, or a new event for one. */
type Sheet = { kind: "commitment" } | { kind: "event"; commitment: PlanCommitment };

export function CommitmentsStep({
  template,
  onTemplate,
  commitments,
  save,
  reload,
  theme,
}: {
  template: TemplateId | null;
  onTemplate: (id: TemplateId) => void;
  commitments: readonly PlanCommitment[];
  /** Writes, then reloads the flow's data. */
  save: (write: () => Promise<unknown>) => Promise<unknown>;
  /** Reload after a sheet saved on its own. */
  reload: () => void;
  theme: ThemeTokens;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [shown, gone] = useRetained(sheet);

  return (
    <>
      <AppText variant="display" color={theme.ink}>
        Anything with set hours?
      </AppText>
      <AppText color={theme.ink} style={styles.lead}>
        For example: School, Work, a club.
      </AppText>

      <View style={styles.choices} accessibilityRole="radiogroup">
        {SCHEDULE_TEMPLATES.map((t) => {
          const on = t.id === template;
          return (
            <Pressable
              key={t.id}
              onPress={() => onTemplate(t.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${t.label}. ${t.detail}`}
              style={({ pressed }) => [
                styles.choice,
                {
                  backgroundColor: theme.surface,
                  borderColor: on ? theme.accent : theme.hairline,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <View style={styles.grow}>
                <AppText variant="label" color={theme.ink}>
                  {t.label}
                </AppText>
                <AppText variant="caption" color={theme.muted}>
                  {t.detail}
                </AppText>
              </View>
              {on ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}
            </Pressable>
          );
        })}
      </View>

      {commitments.map((c) => (
        <Group
          key={c.id}
          theme={theme}
          title={c.name}
          footnote={
            c.tasks.some((t) => t.kind === "event")
              ? undefined
              : "Its events are the times you turn up: a lecture, a shift."
          }
          flush
        >
          {c.tasks
            .filter((t) => t.kind === "event")
            .map((e) => (
              <ItemRow key={e.id} item={e} detail={eventWhen(e)} theme={theme} />
            ))}
          <OutlineAction
            label="Add an event"
            accessibilityLabel={`Add an event to ${c.name}`}
            onPress={() => setSheet({ kind: "event", commitment: c })}
            theme={theme}
          />
        </Group>
      ))}

      {commitments.length < MAX_COMMITMENTS ? (
        <OutlineAction
          label={commitments.length === 0 ? "Add a commitment" : "Add another commitment"}
          onPress={() => setSheet({ kind: "commitment" })}
          theme={theme}
        />
      ) : (
        <AppText variant="caption" color={theme.muted}>
          Three is the most. Split one into parts later, from Life.
        </AppText>
      )}

      {shown?.kind === "commitment" ? (
        <CommitmentSheet
          visible={sheet?.kind === "commitment"}
          mode={{ kind: "commitment" }}
          askSplit={false}
          onClose={() => setSheet(null)}
          onDismissed={gone}
          onSave={({ name }) => {
            setSheet(null);
            void save(() => createCommitment({ name }));
          }}
          theme={theme}
        />
      ) : null}

      {shown?.kind === "event" ? (
        <EventSheet
          visible={sheet?.kind === "event"}
          unitName={shown.commitment.name}
          accent={theme.accent}
          theme={theme}
          onClose={() => setSheet(null)}
          onDismissed={gone}
          onSave={async (input, bounds) => {
            // A commitment split on an earlier run keeps its work in
            // its parts, never on itself (ADR-0035 §1).
            const c = shown.commitment;
            const home = c.split ? c.parts[0]?.id : c.id;
            if (!home) return;
            const saved = await savedOrSaid(async () => {
              await saveNewEvent([home], input, bounds);
              return true;
            });
            if (!saved) return;
            setSheet(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  lead: { maxWidth: 340 },
  choices: { gap: space.sm },
  /** 44pt and up: each is a real target. */
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  grow: { flex: 1 },
});
