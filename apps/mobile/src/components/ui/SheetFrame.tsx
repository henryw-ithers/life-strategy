/**
 * The geometry every bottom sheet sits in: a tappable scrim, and a
 * full-height frame that anchors its child to the bottom of the screen.
 *
 * **This exists because the geometry was wrong in three places at
 * once.** Eighteen sheets each rebuilt the same scrim-plus-frame by
 * hand, and the three that paired a `KeyboardAvoidingView` with a
 * percentage `maxHeight` all shared one bug: an unstyled
 * `KeyboardAvoidingView` sizes to its own content, so `maxHeight: 88%`
 * resolved against the sheet rather than the screen and clipped an
 * eighth of the content at every size. It was found once and fixed
 * three times. One frame means the next such bug can only be fixed
 * once.
 *
 * What it deliberately does **not** own is the sheet itself. The
 * eighteen bodies differ too much to unify — one animates its own
 * keyboard offset, several scroll, one focuses an input on show — and a
 * component configurable enough to express all of them would stop
 * simplifying anything. Callers keep their own sheet view, their own
 * padding, and their own content; they just stop re-deriving where it
 * sits.
 *
 * **Native sheets replaced it (Phase 3c).** Every form sheet is now a
 * `NativeSheet`, and every confirmation a native alert (Phase 3d). This
 * frame remains only for the web preview's stand-in.
 *
 * Three details are load-bearing:
 *
 * - **`flex: 1` on the frame**, so a percentage cap on the child
 *   resolves against the screen. This is the fix above, generalised.
 * - **`box-none` on the frame**, so taps in the empty space above the
 *   sheet fall through to the scrim and dismiss it. Without it a
 *   full-height frame would swallow them.
 * - **An absolutely positioned scrim**, so it fills the modal without
 *   taking part in the layout that positions the sheet.
 */
import { Pressable, StyleSheet, View } from "react-native";

import { SCRIM } from "../../theme/colors";

interface SheetFrameProps {
  /** Tapping the scrim runs this, as the platform expects. */
  onClose: () => void;
  children: React.ReactNode;
}

export function SheetFrame({ onClose, children }: SheetFrameProps) {
  return (
    <>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={styles.frame} pointerEvents="box-none">
        {children}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: SCRIM },
  frame: { flex: 1, justifyContent: "flex-end" },
});
