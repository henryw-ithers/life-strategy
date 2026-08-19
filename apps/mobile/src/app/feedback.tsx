/**
 * Send feedback.
 *
 * Built for the TestFlight round: a few friends, each of whom will
 * notice something different and none of whom will file a ticket. The
 * screen's whole job is to make "this bit is annoying" a thirty-second
 * action instead of a thing they mean to mention next time they see you.
 *
 * It follows [ADR-0013](../../../../docs/adr/0013-crash-reporting-and-telemetry.md)
 * exactly: the app transmits nothing. This composes a `mailto:` and
 * hands it to the mail app; the user presses send there. The one thing
 * that differs from the problem log is that the payload is a sentence
 * they wrote on purpose, so it is passed through verbatim rather than
 * redacted.
 *
 * Copy follows docs/design/copy-guide.md. Nothing here is conditioned on
 * how the user's weeks have gone, and asking for feedback is never
 * framed as the user owing anything.
 */
import * as Linking from "expo-linking";
import { router, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/ui/AppText";
import { Backdrop, hueWash } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import {
  clearFeedbackDraft,
  loadFeedbackDraft,
  saveFeedbackDraft,
} from "../db/settings";
import {
  FEEDBACK_KINDS,
  KIND_LABEL,
  MAX_FEEDBACK_LENGTH,
  composeFeedback,
  hasFeedback,
  mailtoUrl,
  type FeedbackKind,
} from "../lib/feedback";
import {
  buildLabel,
  deviceLabel,
  recordFeedbackSent,
} from "../lib/problemLog";
import { getTheme } from "../theme/colors";
import { radius, space, type as typeScale } from "../theme/tokens";

/**
 * Where feedback lands: a dedicated inbox, deliberately not a personal
 * one, since this string is compiled into every distributed binary.
 *
 * Changing it needs a new build, and old TestFlight builds stay
 * installable for 90 days — so a stale address keeps collecting mail
 * nobody reads. Worth moving to an address on the app's own domain if the
 * app ever gets a store listing; it is one constant, and
 * [docs/release.md](../../../../docs/release.md) carries the note.
 */
const FEEDBACK_ADDRESS = "henrywithersfeedback@gmail.com";

type Stage =
  | { kind: "writing" }
  | { kind: "opening" }
  /** The mail app (or share sheet) has it. Not sent — see below. */
  | { kind: "handed-off"; via: "mail" | "share" };

export default function FeedbackScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "writing" });
  const [error, setError] = useState<string | null>(null);

  /**
   * The draft is written on the way out, not on every keystroke — a
   * database round trip per character to save something the user is
   * still typing is work nobody asked for. The ref exists because the
   * unmount cleanup would otherwise close over the first render's empty
   * string.
   *
   * `ready` guards the save against the one ordering that loses data:
   * an unmount before the load resolves would otherwise write the
   * initial empty state over a draft that was already there. That is
   * the exact sequence a double-invoked effect produces, and a
   * feedback box that eats what you wrote is worse than no box.
   */
  const draft = useRef({ kind, text, ready: false });
  draft.current = { kind, text, ready: loaded };

  useEffect(() => {
    void loadFeedbackDraft().then((saved) => {
      setKind(saved.kind);
      setText(saved.text);
      setLoaded(true);
    });
  }, []);

  useEffect(
    () => () => {
      const { kind: savedKind, text: savedText, ready } = draft.current;
      if (!ready) return;
      // Fire-and-forget on unmount: nothing is left to render, and a
      // failed save costs a draft rather than anything of the user's.
      void saveFeedbackDraft({ kind: savedKind, text: savedText });
    },
    [],
  );

  const onSend = useCallback(async () => {
    setError(null);
    setStage({ kind: "opening" });

    const composed = composeFeedback({
      kind,
      text,
      build: buildLabel(),
      device: deviceLabel(),
    });

    try {
      await Linking.openURL(mailtoUrl(FEEDBACK_ADDRESS, composed));
      recordFeedbackSent(kind, "mail");
      setStage({ kind: "handed-off", via: "mail" });
      return;
    } catch {
      // No mail app configured — deleted, or a fresh device nobody has
      // signed into yet. Falling back beats a dead button, and the
      // share sheet reaches Messages, which most people do have.
    }

    try {
      await Share.share({ message: composed.body, title: composed.subject });
      recordFeedbackSent(kind, "share");
      setStage({ kind: "handed-off", via: "share" });
    } catch {
      setStage({ kind: "writing" });
      setError(
        `This phone wouldn't open its mail app. Your note is saved here. Send it to ${FEEDBACK_ADDRESS} any way you like.`,
      );
    }
  }, [kind, text]);

  const onClear = useCallback(() => {
    setText("");
    setStage({ kind: "writing" });
    void clearFeedbackDraft();
  }, []);

  const remaining = MAX_FEEDBACK_LENGTH - text.length;

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
        keyboardShouldPersistTaps="handled"
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
          Send feedback
        </AppText>
        <AppText color={theme.ink} style={styles.lede}>
          Anything you’d change, anything that didn’t make sense, anything
          you wish it did. Half a sentence is plenty. There’s no wrong way
          to say it.
        </AppText>

        {error !== null ? (
          <View style={[styles.notice, { borderColor: theme.hairline }]}>
            <AppText color={theme.ink} selectable>
              {error}
            </AppText>
          </View>
        ) : null}

        {!loaded ? (
          <ActivityIndicator color={theme.muted} style={styles.busy} />
        ) : stage.kind === "handed-off" ? (
          <View style={[styles.section, { borderTopColor: theme.hairline }]}>
            <AppText variant="headline" color={theme.ink}>
              {stage.via === "mail" ? "It's in your mail app" : "Ready to send"}
            </AppText>
            {/* Honest about the hand-off. `openURL` resolving means the
             *  draft opened, not that anyone sent it — and telling the
             *  user "sent!" when it's sitting unsent is how feedback
             *  quietly never arrives. The draft is kept for the same
             *  reason. */}
            <AppText color={theme.ink}>
              {stage.via === "mail"
                ? "It isn't sent until you send it there. Your note stays here in the meantime, so nothing is lost either way."
                : "Pick where it goes from the share sheet. It isn't sent until you send it, and your note stays here in the meantime."}
            </AppText>
            <Button
              label="Back to writing"
              variant="secondary"
              onPress={() => setStage({ kind: "writing" })}
              theme={theme}
            />
            <Button
              label="Clear my note"
              variant="quiet"
              onPress={onClear}
              theme={theme}
            />
          </View>
        ) : (
          <>
            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                What kind of thing is it?
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                Only so it’s easy to sort later. Pick whichever’s closest.
              </AppText>
              <View style={styles.chips}>
                {FEEDBACK_KINDS.map((option) => {
                  const selected = option === kind;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setKind(option)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          borderColor: selected ? theme.accent : theme.hairline,
                          backgroundColor: selected ? theme.accent : "transparent",
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <AppText
                        variant="label"
                        color={selected ? theme.onAccent : theme.ink}
                      >
                        {KIND_LABEL[option]}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="What would make this better?"
                placeholderTextColor={theme.muted}
                accessibilityLabel="Your feedback"
                multiline
                textAlignVertical="top"
                maxLength={MAX_FEEDBACK_LENGTH}
                style={[
                  styles.input,
                  {
                    borderColor: theme.hairline,
                    color: theme.ink,
                    backgroundColor: theme.surface,
                  },
                ]}
              />
              {/* Only near the ceiling. A counter that watches every
               *  character makes a comment box feel like an exam. */}
              {remaining < 200 ? (
                <AppText variant="caption" color={theme.muted} tabular>
                  {remaining} characters left
                </AppText>
              ) : null}

              <Button
                label="Send feedback"
                onPress={() => void onSend()}
                disabled={!hasFeedback(text) || stage.kind === "opening"}
                theme={theme}
              />
              <AppText variant="caption" color={theme.muted}>
                Opens your mail app with this written out, addressed to
                Henry. Only what you typed goes in it, plus which version
                you’re on and what kind of phone this is. Nothing from inside
                the app.
              </AppText>
            </View>

            <Pressable
              onPress={() => router.replace("/problem" as Href)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.section,
                styles.crossLink,
                { borderTopColor: theme.hairline, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <AppText color={theme.ink}>
                Did something break?
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                The problem log has the technical details, which saves a
                lot of guessing. It’s where your sent notes are listed too. ›
              </AppText>
            </Pressable>
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
  crossLink: { gap: space.xs },
  busy: { marginTop: space.xxl },
  notice: {
    marginTop: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
  input: {
    // Same reasoning as the backup screen's passphrase fields: a bare
    // TextInput renders in the system face, which is the one way to get
    // two typefaces onto a screen by accident.
    ...typeScale.body,
    minHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.md,
  },
});
