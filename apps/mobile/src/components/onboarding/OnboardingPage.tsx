/**
 * One onboarding screen: the progress track, Skip where the step allows
 * it, the copy, and one action pinned at the bottom.
 *
 * The copy scrolls when it doesn't fit and centres when it does, so the
 * longer steps stay whole on a small phone without the short ones
 * drifting to the top of the page.
 */
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SHOWN_STEPS, type OnboardingStep } from "../../lib/onboardingFlow";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { Backdrop, constellation } from "../ui/Backdrop";
import { Button } from "../ui/Button";

/**
 * Where you are in the flow. Bars rather than dots because they carry
 * the sense of a track being filled; the filled ones use the accent so
 * the row reads as progress rather than decoration.
 */
function Progress({ index, theme }: { index: number; theme: ThemeTokens }) {
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: SHOWN_STEPS.length, now: index + 1 }}
      accessibilityLabel={`Step ${index + 1} of ${SHOWN_STEPS.length}`}
    >
      {SHOWN_STEPS.map((step, i) => (
        <View
          key={step}
          style={[
            styles.progressBar,
            {
              backgroundColor: i <= index ? theme.accent : theme.hairline,
              flex: i === index ? 1.6 : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

export interface OnboardingPageProps {
  theme: ThemeTokens;
  /** Drives the progress track. */
  step: OnboardingStep;
  action: string;
  onPress: () => void;
  /** Shown as a quiet Skip under the action when the step allows it. */
  onSkip?: () => void;
  busy?: boolean;
  /** Long steps (a list to work through) start at the top. */
  top?: boolean;
  circles?: React.ComponentProps<typeof Backdrop>["circles"];
  /** Drawn over the whole screen, as an Undo bar is. */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}

export function OnboardingPage({
  theme,
  step,
  action,
  onPress,
  onSkip,
  busy,
  top,
  circles,
  overlay,
  children,
}: OnboardingPageProps) {
  const insets = useSafeAreaInsets();
  const index = SHOWN_STEPS.indexOf(step);

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={circles ?? constellation(theme.areas, { faint: true })} />
      <View
        style={[
          styles.body,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg },
        ]}
      >
        {index >= 0 ? <Progress index={index} theme={theme} /> : null}
        <ScrollView
          style={styles.scroller}
          contentContainerStyle={[styles.copy, top ? styles.copyTop : null]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Deliberately not an entrance animation. Reanimated's
              `entering` gates the content on the animation running, and
              when it doesn't run (a hidden tab, a paused compositor) the
              screen shows its button over an empty page. */}
          <View style={styles.copyInner}>{children}</View>
        </ScrollView>
        <View style={styles.actions}>
          <Button label={action} onPress={onPress} disabled={busy === true} theme={theme} />
          {onSkip ? (
            <Button label="Skip" variant="quiet" onPress={onSkip} disabled={busy === true} theme={theme} />
          ) : null}
        </View>
      </View>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  body: { flex: 1, paddingHorizontal: space.screen, justifyContent: "space-between" },
  scroller: { flex: 1 },
  /** `flexGrow` rather than `flex`, so short copy still centres while
   *  long copy is free to run past the fold and scroll. */
  copy: { flexGrow: 1, justifyContent: "center", paddingBottom: space.lg },
  copyTop: { justifyContent: "flex-start" },
  copyInner: { gap: space.md },
  /** Above the copy, not inside the scroller: it belongs to the flow,
   *  not to the words. */
  progress: { flexDirection: "row", gap: 4, height: 3, marginBottom: space.xl },
  progressBar: { height: 3, borderRadius: 2 },
  actions: { gap: space.xs },
});
