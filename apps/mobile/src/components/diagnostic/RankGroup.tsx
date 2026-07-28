import { StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { ReorderableList, type ReorderableItem } from "../ui/ReorderableList";

interface RankGroupProps {
  /** In current rank order; index 0 is rank 1. */
  items: ReorderableItem[];
  prompt: string;
  /** What the two gestures do. Varies by step: area lists have nothing
   *  to tap into, unit lists do. */
  hint: string;
  theme: ThemeTokens;
  /** Fires on every reorder — the order lives with the caller so it
   *  survives stepping back and forth through the flow. */
  onChange: (orderedIds: string[]) => void;
  onPressItem?: (item: ReorderableItem) => void;
  detailHint?: string;
}

/**
 * One ranking step: a prompt and a drag-to-reorder list.
 *
 * Replaced the Beli-style pairwise comparison this component used to
 * drive. Pairwise earns its comparisons when a list is long — but
 * every area holds two or three units, where ⌈log₂(n!)⌉ is one or
 * three taps to express an order you can just as easily drag into
 * place, and a drag shows the whole standing at once instead of
 * hiding it behind a sequence of isolated either/ors.
 * `PairwiseRank` still serves task ranking, where lists do grow.
 */
export function RankGroup({
  items,
  prompt,
  hint,
  theme,
  onChange,
  onPressItem,
  detailHint,
}: RankGroupProps) {
  return (
    <View style={styles.root}>
      <AppText variant="title" color={theme.ink}>
        {prompt}
      </AppText>
      <AppText variant="caption" color={theme.muted} style={styles.hint}>
        {hint}
      </AppText>
      <View style={styles.list}>
        <ReorderableList
          items={items}
          onReorder={onChange}
          onPressItem={onPressItem}
          detailHint={detailHint}
          theme={theme}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hint: { marginTop: space.xs },
  list: { flex: 1, marginTop: space.lg },
});
