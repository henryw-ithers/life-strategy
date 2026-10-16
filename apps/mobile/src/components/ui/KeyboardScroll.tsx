/**
 * The scroll view for forms with text fields (ADR-0043 §5): it keeps the
 * field you're typing in visible, making room by adding a keyboard-high
 * space after the content ("layout" mode) rather than squeezing the
 * view, which is what the old `KeyboardAvoidingView` did to every sheet
 * that took typing. The bar above the keyboard lives on each
 * `TextField`.
 */
import type { Ref } from "react";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";

/** Air between the focused field and the keyboard's accessory bar. */
const ABOVE_BAR = 64;

export function KeyboardScroll({
  ref,
  ...props
}: KeyboardAwareScrollViewProps & { ref?: Ref<KeyboardAwareScrollViewRef> }) {
  return (
    <KeyboardAwareScrollView
      ref={ref}
      mode="layout"
      bottomOffset={ABOVE_BAR}
      keyboardShouldPersistTaps="handled"
      {...props}
    />
  );
}
