/**
 * A chevron that turns as its section opens and closes: down when
 * closed, up when open. Turned rather than swapped, so the eye follows
 * one shape. Reduce Motion sets it straight to its place.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function ExpandChevron({ open, color, size = 15 }: { open: boolean; color: string; size?: number }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.set(reduceMotion ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 200 }));
  }, [open, reduceMotion, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View style={style} accessible={false}>
      <Ionicons name="chevron-down" size={size} color={color} />
    </Animated.View>
  );
}
