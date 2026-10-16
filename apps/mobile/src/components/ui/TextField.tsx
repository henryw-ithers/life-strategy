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
 * **The bar above the keyboard** (⌄, which hides it) is iOS's own input
 * accessory view, attached to this field. The system places it on the
 * keyboard wherever the field is, in a screen or a native sheet, so it
 * can't drift (Phase 3c: a bar we positioned ourselves floated to the
 * top of SwiftUI sheets). It sits in a zero-size, absolutely positioned
 * wrapper so it never adds a gap to the form around it.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { SymbolView } from "expo-symbols";
import { useId, type Ref } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  PlatformColor,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
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
  const accessoryId = useId();
  const ios = Platform.OS === "ios";
  return (
    <>
      <TextInput
        ref={ref}
        inputAccessoryViewID={ios ? accessoryId : undefined}
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
      {ios ? (
        <View style={styles.accessoryHolder} pointerEvents="box-none">
          <InputAccessoryView nativeID={accessoryId} backgroundColor="transparent">
            <View style={styles.bar}>
              <Pressable
                onPress={() => Keyboard.dismiss()}
                accessibilityRole="button"
                accessibilityLabel="Hide keyboard"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.hide,
                  { backgroundColor: PlatformColor("secondarySystemGroupedBackground") },
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <SymbolView
                  name="keyboard.chevron.compact.down"
                  size={22}
                  tintColor={PlatformColor("label")}
                  fallback={<Ionicons name="chevron-down" size={22} color={theme.ink} />}
                />
              </Pressable>
            </View>
          </InputAccessoryView>
        </View>
      ) : null}
    </>
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
  /** Out of the layout: the accessory renders on the keyboard, not here. */
  accessoryHolder: { position: "absolute", width: 0, height: 0 },
  /** A round button floating at the right, over the top of the keyboard. */
  bar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  hide: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.18)",
  },
});
