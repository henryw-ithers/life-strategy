/**
 * Your data (ADR-0002 "Backup (v1)", as amended by ADR-0046). Manual,
 * local, database-only: Back up writes the database to one file and
 * hands it to the share sheet; Restore reads one back.
 *
 * A backup is a plain file with no passphrase (ADR-0046), so the
 * screen says plainly that anyone with the file can read it. Restore
 * replaces data, so it asks first, in a native alert that shows where
 * the file came from (ADR-0043 §1). Clarity about consequences is not
 * shame (docs/design/copy-guide.md).
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

import {
  describeBackupError,
  exportBackup,
  pickBackup,
  restoreBackup,
  type BackupPreview,
} from "../backup/backupFile";
import { AppText } from "../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import { getTheme } from "../theme/colors";
import { radius, space } from "../theme/tokens";

type Mode =
  | { kind: "idle" }
  | { kind: "exporting" }
  | { kind: "restoring" }
  | { kind: "done"; message: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const kilobytes = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default function BackupScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");

  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setError(null);
    setMode({ kind: "idle" });
  };

  const onExport = async () => {
    setError(null);
    setMode({ kind: "exporting" });
    try {
      const result = await exportBackup();
      setMode({
        kind: "done",
        message: `Saved ${result.fileName}, ${kilobytes(result.bytes)}. Keep it somewhere you’ll still have it if this phone doesn’t, and somewhere private.`,
      });
    } catch (e) {
      setError(describeBackupError(e) ?? "The backup couldn’t be written.");
      setMode({ kind: "idle" });
    }
  };

  const onRestore = async (preview: BackupPreview) => {
    setError(null);
    setMode({ kind: "restoring" });
    try {
      const outcome = await restoreBackup(preview);
      if (outcome.status === "refused") {
        setError(outcome.reason);
        setMode({ kind: "idle" });
        return;
      }
      setMode({
        kind: "done",
        message: `Restored from ${formatDate(outcome.restoredFrom)}. Close the app completely and open it again. It’s still running on the old data until you do.`,
      });
    } catch (e) {
      setError(describeBackupError(e) ?? "The backup couldn’t be restored.");
      setMode({ kind: "idle" });
    }
  };

  /** Pick a file, show where it came from, and ask before replacing. */
  const onPick = async () => {
    setError(null);
    try {
      const preview = await pickBackup();
      if (!preview) return;
      if (preview.tooNew) {
        setError("That backup came from a newer version of the app. Update first, then restore.");
        return;
      }
      const { createdAt, appVersion, payloadBytes } = preview.meta;
      Alert.alert(
        "Restore this backup?",
        `Backed up ${formatDate(createdAt)}, app version ${appVersion}, ${kilobytes(payloadBytes)}.\n\nEverything in the app now is replaced by what’s in this file. Anything logged since it was made won’t be here afterward.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace my data",
            style: "destructive",
            onPress: () => void onRestore(preview),
          },
        ],
      );
    } catch (e) {
      setError(describeBackupError(e) ?? "That file couldn’t be read.");
    }
  };

  const busy = mode.kind === "exporting" || mode.kind === "restoring";

  return (
    <View style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.container,
          { paddingTop: space.md, paddingBottom: space.xl },
        ]}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        <AppText color={theme.ink} style={styles.lede}>
          Everything you’ve written lives on this phone and nowhere else. A
          backup is the only copy that survives it.
        </AppText>

        {error !== null ? (
          <View style={[styles.notice, { borderColor: theme.hairline }]}>
            <AppText color={theme.ink}>{error}</AppText>
          </View>
        ) : null}

        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={theme.muted} />
            <AppText variant="caption" color={theme.muted}>
              {mode.kind === "exporting" ? "Writing your backup…" : "Restoring…"}
            </AppText>
          </View>
        ) : null}

        {mode.kind === "done" ? (
          <View style={[styles.section, { borderTopColor: theme.hairline }]}>
            <AppText color={theme.ink}>{mode.message}</AppText>
            <Button label="Done" onPress={reset} theme={theme} />
          </View>
        ) : null}

        {mode.kind === "idle" ? (
          <>
            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                Back up
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                Writes one file you can put in Files, iCloud Drive, or anywhere
                else you keep things. Photos aren’t included yet. Everything
                else is.
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                The file isn’t locked with a passphrase, so anyone who has it
                can read what’s in it. Keep it somewhere private.
              </AppText>
              <Button label="Back up now" onPress={() => void onExport()} theme={theme} />
            </View>

            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                Restore
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                Replaces everything currently in the app with the contents of a
                backup file. Your current data is set aside first, but the app
                will show the restored version.
              </AppText>
              <Button
                label="Choose a backup file"
                variant="secondary"
                onPress={() => void onPick()}
                theme={theme}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: space.screen },
  lede: { marginTop: space.sm },
  section: {
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  notice: {
    marginTop: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  busy: { marginTop: space.xl, gap: space.sm, alignItems: "center" },
});
