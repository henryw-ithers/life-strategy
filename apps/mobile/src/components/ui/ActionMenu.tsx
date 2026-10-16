/**
 * A row with a native iOS menu (ADR-0043 §1, spec §2.2), drawn by
 * SwiftUI like the + menu in the nav bar.
 *
 * - A tap runs the row's main action (`onPress`), such as editing a
 *   note, and a long press opens the menu. A row with no main action
 *   opens the menu on a tap, for a choice between actions ("Add task":
 *   write a new one, or add one you have).
 * - The ••• at the end opens the same menu with a tap, so nothing in it
 *   needs a long press to reach.
 *
 * The row's own content is the app's, hosted inside the menu's label.
 * Destructive actions are drawn in red by iOS.
 *
 * The web preview gets `ActionMenu.web.tsx`, because SwiftUI doesn't
 * render there.
 */
import { Button, HStack, Host, Image, Menu, RNHostView } from "@expo/ui/swift-ui";
import { accessibilityHint, accessibilityLabel, frame } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

export interface MenuAction {
  label: string;
  icon?: SFSymbol;
  destructive?: boolean;
  onPress: () => void;
}

export interface ActionMenuProps {
  actions: MenuAction[];
  /** What a tap on the row does. A long press opens the menu. Without
   *  it, a tap opens the menu. */
  onPress?: () => void;
  /** What VoiceOver reads for the row (a note's text, a photo's
   *  caption), and for the ••• button as "More for …". */
  label: string;
  /** What a tap does, for VoiceOver: "Edits the note". */
  hint?: string;
  /** The ••• glyph's colour. */
  moreColor: string;
  /** The row itself. */
  children: React.ReactElement;
  /** Set false where another control already reaches every action
   *  without a long press (a photo opens full screen, with Delete). */
  more?: boolean;
  /** "row" (the default) fills the width, for a list row; "content"
   *  sizes to the content, for a thumbnail in a horizontal strip. */
  sizing?: "row" | "content";
}

export function ActionMenu({
  actions,
  onPress,
  label,
  moreColor,
  children,
  more = true,
  sizing = "row",
  hint,
}: ActionMenuProps) {
  const fits = sizing === "content";
  const items = actions.map((a) => (
    <Button
      key={a.label}
      label={a.label}
      systemImage={a.icon}
      role={a.destructive === true ? "destructive" : "default"}
      onPress={a.onPress}
    />
  ));
  return (
    <Host matchContents={fits ? true : { vertical: true }} style={fits ? null : styles.host}>
      <HStack spacing={4} alignment="center">
        <Menu
          label={
            <RNHostView matchContents={fits ? true : { vertical: true }}>{children}</RNHostView>
          }
          onPrimaryAction={onPress}
          modifiers={[
            ...(fits ? [] : [frame({ maxWidth: Number.MAX_VALUE, alignment: "leading" })]),
            accessibilityLabel(label),
            // A tap-to-open menu is announced as one by VoiceOver itself.
            ...(onPress
              ? [accessibilityHint(hint ? `${hint}. Hold for more.` : "Hold for more.")]
              : []),
          ]}
        >
          {items}
        </Menu>
        {more ? (
          <Menu
            label={<Image systemName="ellipsis" size={16} color={moreColor} />}
            modifiers={[frame({ width: 44, height: 44 }), accessibilityLabel(`More for ${label}`)]}
          >
            {items}
          </Menu>
        ) : null}
      </HStack>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: "stretch" },
});
