/**
 * Where your data lives — the full statement onboarding points at
 * (ADR-0011 decision 4, ADR-0013's crash-log paragraph).
 *
 * **Its own screen since 2026-08-19.** This was four paragraphs sitting
 * inside a group on the Settings list, between a switch and a
 * destructive button. Two things were wrong with that. A settings list
 * is scanned, and two hundred words of prose in the middle of it stops
 * the scan dead — the rows below it were effectively hidden. And prose
 * set at list width, in a list rhythm, reads like fine print, which is
 * the opposite of what this text is for: it is the strongest thing the
 * app can say about itself, and it was buried.
 *
 * Here it gets a reading measure, real paragraph spacing, and a title.
 * Settings keeps a one-line summary and a row.
 *
 * Plain facts, no reassurance voice (docs/design/copy-guide.md). The
 * point is that a reader can check each sentence, not that they feel
 * comforted by it.
 */
import { router } from "expo-router";
import { ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import { AppText } from "../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import { getTheme } from "../theme/colors";
import { space } from "../theme/tokens";

/** One entry per paragraph, so the spacing rhythm is the list's job
 *  rather than eight hand-placed margins. */
const STATEMENT: readonly { heading: string; body: string }[] = [
  {
    heading: "It stays on this phone",
    body:
      "Everything you enter is stored only on this device: your priorities, events, tasks, grades, journal entries, photos, and contentment check-ins. Life Strategy has no account and no server, and sends nothing anywhere.",
  },
  {
    heading: "When something breaks",
    body:
      "The technical details are written down here too: which screen, which version. The problem log shows you that text in full, and it only goes anywhere if you send it.",
  },
  {
    heading: "When you send feedback",
    body:
      "Send feedback hands what you typed to your own mail app, and you send it. The log notes that you sent something, never what you wrote. Neither one carries anything from inside the app with it.",
  },
  {
    heading: "Backups",
    body:
      "A backup is one file with everything you’ve written in it, and it goes wherever you choose to put it. It isn’t locked with a passphrase, so anyone who has the file can read it. Keep it somewhere private. We never see it.",
  },
];

export default function PrivacyScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.body}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.container,
          { paddingTop: space.md, paddingBottom: space.xxl },
        ]}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />

        {STATEMENT.map((part) => (
          <View key={part.heading} style={styles.part}>
            <AppText variant="headline" color={theme.ink}>
              {part.heading}
            </AppText>
            <AppText color={theme.ink} style={styles.prose}>
              {part.body}
            </AppText>
          </View>
        ))}

        <AppText variant="caption" color={theme.muted} style={styles.prose}>
          Deleting Life Strategy deletes its data with it. Export a backup
          first if you want to keep it.
        </AppText>

        <View style={styles.action}>
          <Button
            label="Done"
            variant="secondary"
            onPress={() => router.back()}
            theme={theme}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, gap: space.xl },
  part: { gap: space.xs },
  /** A reading measure, not a list width. Prose is why this screen
   *  exists; DESIGN.md caps running text at 65–75 characters. */
  prose: { maxWidth: 460 },
  action: { marginTop: space.md },
});
