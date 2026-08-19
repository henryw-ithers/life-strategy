/**
 * Problem log (ADR-0013 decision 5, as amended).
 *
 * Two things in one list, because they are read together: crashes the
 * app caught on its own, and feedback the user sent. A crash next to a
 * message written four minutes later is usually the whole story, and
 * separating them would hide it.
 *
 * Life Strategy sends nothing on its own, so this screen is the entire reporting
 * pipeline: it shows what was recorded, shows the exact text that would
 * leave the device, and hands that text to the share sheet if — and only
 * if — the user taps send.
 *
 * **The payload is on screen before it is sent, verbatim.** That is the
 * point of the screen, not a detail of it: "we send nothing" is a claim
 * a tester has to take on faith everywhere else in the app, and here
 * they can read it. The preview and the payload are the same
 * `formatReport` call so they cannot drift.
 */
import { router, useFocusEffect, type Href } from "expo-router";
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
import { KIND_LABEL as FEEDBACK_LABEL } from "../lib/feedback";
import {
  clearLog,
  formatReport,
  isProblem,
  readLog,
  type LogEntry,
  type ProblemKind,
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

/** Plain words for the capture point. The log stores which layer caught
 *  the error because it narrows the cause; the user gets the version of
 *  that fact which is about their experience. */
const PROBLEM_LABEL: Record<ProblemKind, string> = {
  startup: "Wouldn't open",
  render: "A screen broke",
  fatal: "Something failed in the background",
  load: "A screen couldn’t load",
};

export default function ProblemLogScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<LogEntry[]>(() => readLog());
  const [payloadShown, setPayloadShown] = useState(false);

  /* Re-read on focus, not just on mount. Sending feedback adds an entry
   * and comes straight back here, so a mount-only read would show a log
   * that is already one behind — the exact case that makes the screen
   * look like it isn't working. */
  useFocusEffect(
    useCallback(() => {
      setEntries(readLog());
    }, []),
  );

  const report = formatReport(entries);
  const problemCount = entries.filter(isProblem).length;
  const feedbackCount = entries.length - problemCount;

  const onSend = useCallback(async () => {
    try {
      await Share.share({ message: report });
    } catch {
      // A dismissed share sheet rejects on some platforms and is not an
      // error worth telling anyone about.
    }
  }, [report]);

  const onClear = useCallback(() => {
    clearLog();
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
          Problem log
        </AppText>
        <AppText color={theme.ink} style={styles.lede}>
          Anything that went wrong, and any feedback you’ve sent. It’s all
          written down here on this phone and nowhere else.
        </AppText>

        {entries.length === 0 ? (
          <View style={[styles.section, { borderTopColor: theme.hairline }]}>
            <AppText color={theme.ink}>Nothing here yet.</AppText>
            <AppText variant="caption" color={theme.muted}>
              This fills in on its own. Crashes get written down as they
              happen, and sending feedback adds a line too. An empty list
              means nothing has gone wrong.
            </AppText>
            <Pressable
              onPress={() => router.replace("/feedback" as Href)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.crossLink,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <AppText variant="label" color={theme.accent}>
                Send feedback
              </AppText>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                {[
                  problemCount === 1
                    ? "1 problem"
                    : problemCount > 0
                      ? `${problemCount} problems`
                      : null,
                  feedbackCount === 1
                    ? "1 note sent"
                    : feedbackCount > 0
                      ? `${feedbackCount} notes sent`
                      : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                Newest first, up to ten of each. Older ones drop off as new
                ones arrive.
              </AppText>
            </View>

            {entries.map((entry, index) => (
              <View
                key={`${entry.at}-${index}`}
                style={[
                  styles.entry,
                  {
                    borderColor: theme.hairline,
                    // Feedback is the one thing in this list the user did
                    // on purpose, so it reads as a note rather than as
                    // another fault.
                    backgroundColor: isProblem(entry)
                      ? "transparent"
                      : theme.surface,
                  },
                ]}
              >
                {isProblem(entry) ? (
                  <>
                    <AppText color={theme.ink}>
                      {PROBLEM_LABEL[entry.kind]}
                    </AppText>
                    <AppText variant="caption" color={theme.muted} tabular>
                      {formatWhen(entry.at)}
                      {entry.route ? ` · ${entry.route}` : ""} · {entry.build}
                    </AppText>
                    <AppText variant="footnote" color={theme.muted}>
                      {entry.name}: {entry.message}
                    </AppText>
                  </>
                ) : (
                  <>
                    <AppText color={theme.ink}>
                      You sent feedback: {FEEDBACK_LABEL[entry.topic]}
                    </AppText>
                    <AppText variant="caption" color={theme.muted} tabular>
                      {formatWhen(entry.at)} · {entry.build}
                    </AppText>
                    {/* Honest about what was recorded, on both counts:
                     *  the words aren't kept here, and opening a draft
                     *  isn't the same as sending it. */}
                    <AppText variant="footnote" color={theme.muted}>
                      {entry.via === "mail"
                        ? "Opened in your mail app. What you wrote isn't kept here."
                        : "Handed to the share sheet. What you wrote isn't kept here."}
                    </AppText>
                  </>
                )}
              </View>
            ))}

            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                Send this log on
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                Sending opens the share sheet, so you choose where it
                goes. It’s plain text: technical details about the app, this
                build, and this phone’s model. Nothing you’ve written,
                rated, or photographed is in it.
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

              <Button label="Send log" onPress={() => void onSend()} theme={theme} />
              <Button
                label="Clear the log"
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
  crossLink: { minHeight: 44, justifyContent: "center" },
  disclosure: { minHeight: 44, justifyContent: "center" },
  payload: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.md,
  },
});
