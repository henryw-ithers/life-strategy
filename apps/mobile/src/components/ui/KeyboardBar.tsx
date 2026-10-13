/**
 * What every sheet or screen that takes typing needs besides its
 * fields (ADR-0043 §5, spec §5.8a).
 *
 * **`KeyboardBar`** sits above the keyboard with ⌄ on the right to hide
 * it, which number pads need most because they have no Return key. Pass
 * `arrows` where there is more than one field, for ‹ › between them.
 * It has to be rendered inside each sheet's `Modal`: a modal is its own
 * native window, so a bar at the app's root would sit behind it.
 *
 * **`KeyboardScroll`** is the scroll view that keeps the field you're
 * typing in visible. It makes room by adding a keyboard-high space
 * after the content ("layout" mode) rather than squeezing the view. In
 * a sheet anchored to the bottom, that means a short sheet grows upward
 * by exactly the keyboard and looks unchanged, and a tall one reaches
 * its cap and scrolls. Neither shrinks, which is what the old
 * `KeyboardAvoidingView` did to every sheet that took typing.
 *
 * **`useKeyboardLift`** is for the two short sheets built to rise with
 * the keyboard so Save stays in reach while you type (a note, an
 * activity). It gives the padding that lifts a sheet above both the
 * keyboard and the bar, at the sheet's own height.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Ref } from "react";
import {
  KeyboardAwareScrollView,
  KeyboardToolbar,
  useReanimatedKeyboardAnimation,
  type KeyboardAwareScrollViewProps,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ThemeTokens } from "../../theme/colors";

/** The bar's height, rounded up from the library's 42. */
const BAR_HEIGHT = 44;

/** The bar plus a little air, so a field stops above the bar rather
 *  than under it. */
const ABOVE_BAR = BAR_HEIGHT + 20;

export function KeyboardBar({
  arrows = false,
  aboveScreenBottom = 0,
  theme,
}: {
  arrows?: boolean;
  /**
   * How far the parent's bottom edge sits above the screen's, such as a
   * tab bar's height. The bar is pinned to its parent's bottom, so
   * without this it would float that far above the keyboard, and show
   * over the tab bar while the keyboard is down.
   */
  aboveScreenBottom?: number;
  theme: ThemeTokens;
}) {
  return (
    <KeyboardToolbar offset={{ closed: aboveScreenBottom, opened: aboveScreenBottom }}>
      {arrows ? <KeyboardToolbar.Prev /> : null}
      {arrows ? <KeyboardToolbar.Next /> : null}
      <KeyboardToolbar.Done text={<Ionicons name="chevron-down" size={22} color={theme.ink} />} />
    </KeyboardToolbar>
  );
}

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

/**
 * Animated bottom padding for a sheet that rises with the keyboard:
 * `base` while it's down, and the keyboard plus the bar above it while
 * it's up. The keyboard's height already covers the home-indicator
 * inset, so that part isn't counted twice.
 */
export function useKeyboardLift(base: number) {
  const { height, progress } = useReanimatedKeyboardAnimation();
  const insets = useSafeAreaInsets();
  return useAnimatedStyle(() => ({
    paddingBottom:
      base + Math.max(-height.value - insets.bottom, 0) + progress.value * BAR_HEIGHT,
  }));
}
