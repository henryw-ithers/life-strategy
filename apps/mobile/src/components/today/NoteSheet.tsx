import { useState } from "react";
import { StyleSheet } from "react-native";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { NativeSheet } from "../ui/NativeSheet";
import { TextField } from "../ui/TextField";

interface NoteSheetProps {
  visible: boolean;
  /** "today" or a spoken date. */
  dayLabel: string;
  /** The note being rewritten. Absent when adding a new one. */
  initialBody?: string;
  theme: ThemeTokens;
  onClose: () => void;
  /** After it has finished closing (`NativeSheet`). */
  onDismissed?: () => void;
  onCommit: (body: string) => void;
}

/** Write a journal note, or rewrite one.
 *
 *  Entries used to be append-only (ADR-0002) and this sheet always
 *  opened blank. That was retired on 2026-08-13 — pass `initialBody`
 *  and the same sheet edits in place.
 *
 *  **The first native sheet (Phase 3c trial).** It sits in a SwiftUI
 *  sheet (`NativeSheet`), which handles the keyboard itself, so the
 *  lifting this sheet used to do is gone. Save is the header's
 *  confirming action. */
export function NoteSheet({
  visible,
  dayLabel,
  initialBody,
  theme,
  onClose,
  onDismissed,
  onCommit,
}: NoteSheetProps) {
  const [body, setBody] = useState(initialBody ?? "");

  // Re-seed each time it opens: blank for a new note, the existing
  // text when rewriting one. Done as the sheet opens, during render,
  // rather than in an effect that would render it twice.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setBody(initialBody ?? "");
  }

  const commit = () => {
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    onCommit(trimmed);
    onClose();
  };

  return (
    <NativeSheet onDismissed={onDismissed}
      visible={visible}
      onClose={onClose}
      title={initialBody === undefined ? `A note on ${dayLabel}` : "Edit note"}
      confirm={{
        label: "Save",
        onPress: commit,
        disabled: body.trim().length === 0,
      }}
    >
      <TextField
        theme={theme}
        value={body}
        accessibilityLabel="Note"
        onChangeText={setBody}
        placeholder="What's worth remembering?"
        multiline
        // The sheet's content mounts as it presents, so this focuses
        // as it opens.
        autoFocus
        style={styles.input}
      />
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    ...typeScale.body,
    minHeight: 120,
    maxHeight: 240,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    textAlignVertical: "top",
  },
});
