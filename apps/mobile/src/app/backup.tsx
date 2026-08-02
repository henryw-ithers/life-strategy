/**
 * Your data (ADR-0002 "Backup (v1)"). Manual, local, database-only:
 * export seals the database with a passphrase and hands it to the
 * share sheet; restore reads one back.
 *
 * Copy rules (docs/design/copy-guide.md) still hold — nothing here
 * nags or conditions on how the user has been doing. But restore
 * replaces data, and the passphrase genuinely cannot be recovered, so
 * both say so plainly. Clarity about consequences is not shame.
 */
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  describeBackupError,
  exportBackup,
  isCryptoAvailable,
  pickBackup,
  restoreBackup,
  type BackupPreview,
} from "../backup/backupFile";
import { AppText } from "../components/ui/AppText";
import { Backdrop, hueWash } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import { getTheme, type ThemeTokens } from "../theme/colors";
import { radius, space, type as typeScale } from "../theme/tokens";

const MIN_PASSPHRASE = 8;

type Mode =
  | { kind: "idle" }
  | { kind: "exporting" }
  | { kind: "export-passphrase" }
  | { kind: "restore-passphrase"; preview: BackupPreview }
  | { kind: "restoring" }
  | { kind: "done"; message: string };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BackupScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPassphrase("");
    setConfirm("");
    setError(null);
    setMode({ kind: "idle" });
  };

  const onExport = async () => {
    setError(null);
    if (passphrase.length < MIN_PASSPHRASE) {
      setError(`Use at least ${MIN_PASSPHRASE} characters.`);
      return;
    }
    if (passphrase !== confirm) {
      setError("Those two don't match.");
      return;
    }
    setMode({ kind: "exporting" });
    try {
      const result = await exportBackup(passphrase);
      setPassphrase("");
      setConfirm("");
      setMode({
        kind: "done",
        message: `Saved ${result.fileName}, ${Math.max(1, Math.round(result.bytes / 1024))} KB. Keep it somewhere you'll still have it if this phone doesn't.`,
      });
    } catch (e) {
      setError(describeBackupError(e) ?? "The backup couldn't be written.");
      setMode({ kind: "export-passphrase" });
    }
  };

  const onPick = async () => {
    setError(null);
    try {
      const preview = await pickBackup();
      if (!preview) return;
      if (preview.tooNew) {
        setError(
          "That backup came from a newer version of the app. Update first, then restore.",
        );
        return;
      }
      setMode({ kind: "restore-passphrase", preview });
    } catch (e) {
      setError(describeBackupError(e) ?? "That file couldn't be read.");
    }
  };

  const onRestore = async (preview: BackupPreview) => {
    setError(null);
    setMode({ kind: "restoring" });
    try {
      const outcome = await restoreBackup(preview, passphrase);
      setPassphrase("");
      if (outcome.status === "refused") {
        setError(outcome.reason);
        setMode({ kind: "idle" });
        return;
      }
      setMode({
        kind: "done",
        message: `Restored from ${formatDate(outcome.restoredFrom)}. Close the app completely and open it again. It's still running on the old data until you do.`,
      });
    } catch (e) {
      setError(describeBackupError(e) ?? "The backup couldn't be restored.");
      setMode({ kind: "restore-passphrase", preview });
    }
  };

  const busy = mode.kind === "exporting" || mode.kind === "restoring";

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
          Your data
        </AppText>
        <AppText color={theme.ink} style={styles.lede}>
          Everything you've written lives on this phone and nowhere else. A
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
              {mode.kind === "exporting"
                ? "Sealing your backup. This takes a few seconds."
                : "Restoring…"}
            </AppText>
          </View>
        ) : null}

        {mode.kind === "done" ? (
          <View style={[styles.section, { borderTopColor: theme.hairline }]}>
            <AppText color={theme.ink}>{mode.message}</AppText>
            <Button label="Done" onPress={reset} theme={theme} />
          </View>
        ) : null}

        {/* Only ever true in Expo Go or the web preview: the crypto is a
            native module (ADR-0020), which neither can load. A tester on
            a real build never sees this. */}
        {!isCryptoAvailable ? (
          <View style={[styles.section, { borderTopColor: theme.hairline }]}>
            <AppText variant="headline" color={theme.ink}>
              Not available here
            </AppText>
            <AppText color={theme.ink}>
              Backup and restore need a development or TestFlight build. This
              one can't do the encryption.
            </AppText>
          </View>
        ) : null}

        {mode.kind === "idle" && isCryptoAvailable ? (
          <>
            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                Back up
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                Writes one encrypted file you can put in Files, iCloud Drive,
                or anywhere else you keep things. Photos aren't included yet.
                Everything else is.
              </AppText>
              <Button
                label="Back up now"
                onPress={() => setMode({ kind: "export-passphrase" })}
                theme={theme}
              />
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

        {mode.kind === "export-passphrase" ? (
          <View style={[styles.section, { borderTopColor: theme.hairline }]}>
            <AppText variant="headline" color={theme.ink}>
              Choose a passphrase
            </AppText>
            <AppText variant="caption" color={theme.muted}>
              This is what unlocks the backup. It isn't stored anywhere and
              can't be looked up or reset. If you lose it, the file can't be
              opened again. Write it down somewhere real.
            </AppText>
            <Field
              theme={theme}
              value={passphrase}
              onChange={setPassphrase}
              placeholder="Passphrase"
              autoFocus
            />
            <Field
              theme={theme}
              value={confirm}
              onChange={setConfirm}
              placeholder="Type it again"
            />
            <Button label="Create backup" onPress={() => void onExport()} theme={theme} />
            <Button label="Cancel" variant="quiet" onPress={reset} theme={theme} />
          </View>
        ) : null}

        {mode.kind === "restore-passphrase" ? (
          <View style={[styles.section, { borderTopColor: theme.hairline }]}>
            <AppText variant="headline" color={theme.ink}>
              Restore this backup?
            </AppText>
            <View style={[styles.provenance, { borderColor: theme.hairline }]}>
              <AppText color={theme.ink}>
                Backed up {formatDate(mode.preview.meta.createdAt)}
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                App version {mode.preview.meta.appVersion} ·{" "}
                {Math.max(1, Math.round(mode.preview.meta.payloadBytes / 1024))} KB
              </AppText>
            </View>
            <AppText variant="caption" color={theme.muted}>
              Everything currently in the app is replaced by what's in this
              file. Anything logged since it was made won't be here afterward.
            </AppText>
            <Field
              theme={theme}
              value={passphrase}
              onChange={setPassphrase}
              placeholder="Passphrase for this backup"
              autoFocus
            />
            <Button
              label="Replace my data"
              color={theme.danger}
              onPress={() => void onRestore(mode.preview)}
              theme={theme}
            />
            <Button label="Cancel" variant="quiet" onPress={reset} theme={theme} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Field({
  theme,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  theme: ThemeTokens;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={theme.muted}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      autoFocus={autoFocus}
      accessibilityLabel={placeholder}
      style={[
        styles.input,
        { borderColor: theme.hairline, color: theme.ink, backgroundColor: theme.surface },
      ]}
    />
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
  notice: {
    marginTop: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  busy: { marginTop: space.xl, gap: space.sm, alignItems: "center" },
  provenance: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  input: {
    // Passphrase fields had no type styling at all, so they were the
    // one place still rendering in the system face.
    ...typeScale.body,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
});
