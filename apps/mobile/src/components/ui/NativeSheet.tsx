/**
 * A native iOS sheet (ADR-0043 §1, spec §2.2): SwiftUI's sheet from
 * `@expo/ui`, with a grabber, swipe to dismiss, and the iOS 26 glass
 * background. The app's own content sits inside it in an `RNHostView`.
 *
 * The header follows iOS form sheets: Cancel on the left, the title in
 * the middle, and the confirming action on the right in bold.
 *
 * Every form sheet in the app is one of these since Phase 3c. The
 * SwiftUI sheet keeps a short form clear of the keyboard itself (checked
 * on the phone with the note sheet, 2026-10-16). A long form scrolls in
 * `KeyboardScroll`, which brings the field you're typing in into view;
 * whether that and the sheet's own keyboard handling add up to extra
 * space above the keyboard is still to be checked on the phone.
 *
 * **Keep it mounted and flip `visible`.** Unmounting a presented sheet
 * skips the closing animation; `useRetained` keeps a closing sheet's
 * content on screen while it slides away. And **open the next sheet
 * from `onDismissed`**: iOS drops a sheet presented while another is
 * still closing.
 *
 * Two sizes:
 *
 * - **"fit"** (the default) sizes the sheet to its content: a short
 *   form, a choice, an explanation.
 * - **"large"** opens at full height and gives the content the space,
 *   for long forms. Pass `scroll` to have the content scroll inside it,
 *   or give it your own `KeyboardScroll` with `style={{ flex: 1 }}`.
 *
 * The web preview gets `NativeSheet.web.tsx`, the old custom sheet,
 * because SwiftUI doesn't render there.
 */
import { BottomSheet, Group, Host, RNHostView } from "@expo/ui/swift-ui";
import {
  interactiveDismissDisabled,
  presentationDetents,
  presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";

import { space } from "../../theme/tokens";
import { KeyboardScroll } from "./KeyboardScroll";
import { SheetHeader, type SheetHeaderProps } from "./SheetHeader";

export interface NativeSheetProps extends SheetHeaderProps {
  visible: boolean;
  /** Swiping it down, Cancel or Done. Must set `visible` to false: the
   *  native sheet has already closed, and a `visible` left true can't
   *  present again. */
  onClose: () => void;
  /** After it has finished closing: the moment to open another. */
  onDismissed?: () => void;
  /** False while something is saving, so it can't be swiped away. */
  dismissible?: boolean;
  /** "fit" sizes to the content; "large" is full height (see above). */
  size?: "fit" | "large";
  /** With "large": the content scrolls inside the sheet. */
  scroll?: boolean;
  children: React.ReactNode;
}

export function NativeSheet({
  visible,
  onClose,
  size = "fit",
  scroll,
  onDismissed,
  dismissible = true,
  children,
  ...header
}: NativeSheetProps) {
  const large = size === "large";
  const presentation = [
    ...(large ? [presentationDetents(["large"])] : []),
    presentationDragIndicator("visible"),
    ...(dismissible ? [] : [interactiveDismissDisabled(true)]),
  ];
  return (
    // A zero-size host: the sheet presents over everything, so the host
    // needs no room in the layout.
    <Host style={styles.host}>
      <BottomSheet
        isPresented={visible}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
        onDismiss={onDismissed}
        fitToContents={!large}
      >
        <Group modifiers={presentation}>
          <RNHostView matchContents={large ? false : { vertical: true }}>
            <View style={[styles.content, large ? styles.fill : null]}>
              <SheetHeader {...header} onCancel={onClose} />
              {scroll === true ? (
                <KeyboardScroll style={styles.fill} contentContainerStyle={styles.scrollBody}>
                  {children}
                </KeyboardScroll>
              ) : (
                children
              )}
            </View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", width: 0, height: 0 },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  fill: { flex: 1 },
  scrollBody: { gap: space.lg, paddingBottom: space.lg },
});
