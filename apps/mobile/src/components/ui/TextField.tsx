/**
 * The app's one text field (ADR-0043 §5).
 *
 * Every field used to set its own placeholder colour, colours and
 * Return behaviour, and they had drifted: some Return keys said Done
 * and did nothing, one said Next and went nowhere. This owns the parts
 * every field shares and leaves the shape to the caller, whose `style`
 * goes on top.
 *
 * Return works as the spec asks (§5.8a):
 *
 * - **Notes** (`multiline`) get a new line.
 * - **One-line fields** say Done and close the keyboard. Return never
 *   saves the sheet; a half-finished form shouldn't commit on a stray
 *   tap.
 * - **`returnKeyType="next"`** moves to the next field, unless the
 *   caller handles `onSubmitEditing` itself.
 *
 * The bar above the keyboard (⌄, and ‹ › between fields) is
 * `KeyboardBar`, placed once per sheet or screen, not per field.
 */
import type { Ref } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";

export interface TextFieldProps extends TextInputProps {
  theme: ThemeTokens;
  ref?: Ref<TextInput>;
}

export function TextField({
  theme,
  ref,
  multiline,
  returnKeyType,
  onSubmitEditing,
  submitBehavior,
  style,
  ...rest
}: TextFieldProps) {
  const next = returnKeyType === "next" && !multiline;
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.muted}
      multiline={multiline}
      returnKeyType={multiline ? returnKeyType : (returnKeyType ?? "done")}
      submitBehavior={
        submitBehavior ?? (multiline ? "newline" : next ? "submit" : "blurAndSubmit")
      }
      onSubmitEditing={
        onSubmitEditing ?? (next ? () => void KeyboardController.setFocusTo("next") : undefined)
      }
      style={[
        styles.field,
        multiline ? styles.multiline : null,
        { backgroundColor: theme.surface, color: theme.ink },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    ...typeScale.body,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 48,
  },
  multiline: { minHeight: 88, textAlignVertical: "top" },
});
