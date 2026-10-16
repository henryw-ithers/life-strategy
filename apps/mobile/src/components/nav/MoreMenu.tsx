/**
 * A pushed screen's ••• menu in its nav bar (ADR-0043 §1): what you do
 * to the page's subject as a whole, out of the way of what is in it.
 * iOS draws destructive items in red; put them last.
 */
import { Stack } from "expo-router";
import type { SFSymbol } from "sf-symbols-typescript";

export interface MoreMenuItem {
  label: string;
  icon?: SFSymbol;
  /** A line under the label saying what it does. */
  subtitle?: string;
  destructive?: boolean;
  onPress: () => void;
}

export function MoreMenu({ items, label }: { items: MoreMenuItem[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={label}>
        {items.map((item) => (
          <Stack.Toolbar.MenuAction
            key={item.label}
            icon={item.icon}
            subtitle={item.subtitle}
            destructive={item.destructive}
            onPress={item.onPress}
          >
            {item.label}
          </Stack.Toolbar.MenuAction>
        ))}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
