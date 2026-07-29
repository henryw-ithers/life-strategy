/**
 * Report a problem (ADR-0013 decision 5).
 *
 * Glide sends nothing on its own, so this screen is the whole reporting
 * pipeline: it shows what was recorded when something broke, shows the
 * exact text that would leave the device, and hands that text to the
 * share sheet if — and only if — the user taps send.
 *
 * **The payload is on screen before it is sent, verbatim.** That is the
 * point of the screen, not a detail of it: "we send nothing" is a claim
 * a tester has to take on faith everywhere else in the app, and here
 * they can read it. The preview and the payload are the same
 * `formatReport` call so they cannot drift.
 */
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/ui/AppText";
import { Backdrop, hueWash } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import {
  clearProblems,
  formatReport,
  readProblems,
  type ProblemEntry,
} from "../lib/problemLog";
import { getTheme } from "../theme/colors";
import { radius, space } from "../theme/tokens";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Plain words for the capture point. The log stores which layer
 *  caught the error because it narrows the cause; the user gets the
 *  version of that fact which is about their experience. */
const KIND_LABEL: Record<ProblemEntry["kind"], string> = {
  startup: "While opening the app",
  render: "While showing a screen",
  fatal: "In the background",
};

export default function ProblemScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();

  // Read once per mount. The log only changes when something breaks,
  // and re-reading a file on focus to find the same entries is work
  // for nobody.
  const [entries, setEntries] = useState<ProblemEntry[]>(() => readProblems());
  const [payloadShown, setPayloadShown] = useState(false);

  const report = formatReport(entries);

  const onSend = useCallback(async () => {
    try {
      await Share.share({ message: report });
    } catch {
      // A dismissed share sheet rejects on some platforms and is not an
      // error worth telling anyone about.
    }
  }, [report]);

  const onClear = useCallback(() => {
    clearProblems();
    setEntries([]);
    setPayloadShown(false);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={hueWash(theme.accent)} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + space.md,
            paddingBottom: insets.bottom + space.xl,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={styles.back}
        >
          <AppText variant="label" color={theme.muted}>
            ‹ Back
          </AppText>
        </Pressable>

        <AppText variant="display" color={theme.ink}>
          Report a problem
        </AppText>
        <AppText color={theme.ink} style={styles.lede}>
          When something goes wrong, Glide writes down where it happened
          and stops there. Nothing is sent unless you send it.
        </AppText>

        {entries.length === 0 ? (
          <View style={[styles.section, { borderTopColor: theme.hairline }]}>
            <AppText color={theme.ink}>Nothing recorded.</AppText>
            <AppText variant="caption" color={theme.muted}>
              If the app did something odd without breaking, this page
              won't know about it — that one's worth describing in your
              own words.
            </AppText>
          </View>
        ) : (
          <>
            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                {entries.length === 1
                  ? "1 problem recorded"
                  : `${entries.length} problems recorded`}
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                The most recent ten, newest first. Older ones are dropped
                as new ones arrive.
              </AppText>
            </View>

            {entries.map((entry, index) => (
              <View
                key={`${entry.at}-${index}`}
                style={[styles.entry, { borderColor: theme.hairline }]}
              >
                <AppText color={theme.ink}>{KIND_LABEL[entry.kind]}</AppText>
                <AppText variant="caption" color={theme.muted} tabular>
                  {formatWhen(entry.at)}
                  {entry.route ? ` · ${entry.route}` : ""} · {entry.build}
                </AppText>
                <AppText variant="footnote" color={theme.muted}>
                  {entry.name}: {entry.message}
                </AppText>
              </View>
            ))}

            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                Send it on
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                Sending opens the share sheet, so you choose where it
                goes. It's plain text — technical details about the app,
                this build, and this phone's model. Nothing you've
                written, rated, or photographed is in it.
              </AppText>

              <Pressable
                onPress={() => setPayloadShown((shown) => !shown)}
                accessibilityRole="button"
                accessibilityHint="Shows the exact text that would be sent"
                style={({ pressed }) => [
                  styles.disclosure,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <AppText variant="label" color={theme.accent}>
                  {payloadShown
                    ? "Hide what gets sent"
                    : "See exactly what gets sent"}
                </AppText>
              </Pressable>

              {payloadShown ? (
                <View
                  style={[
                    styles.payload,
                    { borderColor: theme.hairline, backgroundColor: theme.surface },
                  ]}
                >
                  <AppText variant="footnote" color={theme.ink} selectable>
                    {report}
                  </AppText>
                </View>
              ) : null}

              <Button label="Send report" onPress={() => void onSend()} theme={theme} />
              <Button
                label="Clear these"
                variant="quiet"
                onPress={onClear}
                theme={theme}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  container: { paddingHorizontal: space.screen },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  lede: { marginTop: space.sm },
  section: {
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  entry: {
    marginTop: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  disclosure: { minHeight: 44, justifyContent: "center" },
  payload: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.md,
  },
});
