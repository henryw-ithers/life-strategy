/**
 * The app's persistent bottom navigation: five destinations, icons at
 * rest, with the active one carrying a filled accent pill and its
 * name.
 *
 * Why a label on the selected tab only: icon-only bars are the least
 * learnable option for a first-time user, and both HIG and Material
 * spec labelled destinations. Naming just the active tab keeps the bar
 * quiet while guaranteeing you can always read where you are.
 * VoiceOver and TalkBack get all five names regardless of selection.
 *
 * The pill is this app's reading of a game-style selected state —
 * decisive fill rather than a raised centre button. A raised centre on
 * a five-tab bar reads as an *action* (compose, capture); every one of
 * these is a destination, so none of them gets that treatment.
 */
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
/* The single family, not the `@expo/vector-icons` barrel — that pulls
 * every icon font in the package into the bundle. */
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { getTheme, type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

/** Outline at rest, solid when selected — the same pairing Apple Music
 *  uses to signal selection, drawn from one icon set throughout.
 *
 *  Tasks is a clipboard, not a checkbox: a ticked box reads as "done"
 *  and belongs to the daily checklist, while this screen is the plan
 *  behind it. It also happens to be the product's own description of
 *  itself — a trusted coach with a clipboard. */
const ICONS: Record<string, { rest: IoniconName; active: IoniconName }> = {
  goals: { rest: "flag-outline", active: "flag" },
  plan: { rest: "clipboard-outline", active: "clipboard" },
  index: { rest: "home-outline", active: "home" },
  portfolio: { rest: "stats-chart-outline", active: "stats-chart" },
  settings: { rest: "settings-outline", active: "settings" },
};

const PILL_W = 56;
const PILL_H = 32;
const ICON_SIZE = 22;
/** Fixed slot so the bar never changes height as the label moves. */
const LABEL_SLOT_H = 16;
const DURATION = 220;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.hairline,
          paddingBottom: Math.max(insets.bottom, space.sm),
        },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!;
        const label =
          typeof options.title === "string" ? options.title : route.name;
        const focused = state.index === index;

        return (
          <TabItem
            key={route.key}
            routeName={route.name}
            label={label}
            focused={focused}
            theme={theme}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (focused || event.defaultPrevented) return;
              if (Platform.OS !== "web") void Haptics.selectionAsync();
              navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}

interface TabItemProps {
  routeName: string;
  label: string;
  focused: boolean;
  theme: ThemeTokens;
  onPress: () => void;
}

function TabItem({ routeName, label, focused, theme, onPress }: TabItemProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);
  /* Deliberately a blank ring, not a real glyph. An unmapped route
   * means the key here and the route name have drifted apart — which
   * happened once already, when `plan/` was a directory and Expo
   * Router named its route `plan/index`. Falling back to a plausible
   * icon hid that; falling back to an obviously empty one shows it. */
  const icons = ICONS[routeName] ?? { rest: "ellipse-outline", active: "ellipse-outline" };

  useEffect(() => {
    const to = focused ? 1 : 0;
    progress.value = reduceMotion
      ? to
      : withTiming(to, { duration: DURATION, easing: Easing.out(Easing.quad) });
  }, [focused, reduceMotion, progress]);

  /* The pill grows out from the icon rather than sliding, so nothing
   * appears to travel across the bar when a distant tab is chosen. */
  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.72 + progress.value * 0.28 }],
  }));
  const restIconStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const activeIconStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={styles.item}
      hitSlop={4}
    >
      <View style={styles.pillSlot}>
        <Animated.View
          style={[
            styles.pill,
            { backgroundColor: theme.accent },
            pillStyle,
          ]}
        />
        {/* Both weights stay mounted and cross-fade; swapping the glyph
         *  outright makes the selection snap rather than settle. */}
        <Animated.View style={[styles.icon, restIconStyle]}>
          <Ionicons name={icons.rest} size={ICON_SIZE} color={theme.muted} />
        </Animated.View>
        <Animated.View style={[styles.icon, activeIconStyle]}>
          <Ionicons name={icons.active} size={ICON_SIZE} color={theme.onAccent} />
        </Animated.View>
      </View>

      <View style={styles.labelSlot}>
        <Animated.View style={labelStyle}>
          <AppText variant="footnote" color={theme.accent} numberOfLines={1}>
            {label}
          </AppText>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    // 48dp floor for the touch target (Material); iOS wants 44pt.
    minHeight: 48,
  },
  pillSlot: {
    width: PILL_W,
    height: PILL_H,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
  },
  icon: { position: "absolute" },
  labelSlot: {
    height: LABEL_SLOT_H,
    justifyContent: "center",
    // Footnote line-height overflows the slot by a hair on Android
    // font scaling; clipping keeps the bar's height fixed.
    overflow: "hidden",
  },
});

export const TAB_BAR_TYPE_GUARD = typeScale;
