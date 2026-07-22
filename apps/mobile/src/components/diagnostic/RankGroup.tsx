import { useEffect, useState } from "react";

import { PairwiseRank, type RankableItem } from "../ui/PairwiseRank";
import type { ThemeTokens } from "../../theme/colors";

interface RankGroupProps {
  /** Unordered; length may be 0 or 1 (resolves immediately, no UI). */
  items: RankableItem[];
  prompt: string;
  theme: ThemeTokens;
  /** Fires exactly once, with the full order (index 0 = rank 1). */
  onComplete: (orderedIds: string[]) => void;
}

/**
 * Ranks a set of items from scratch via repeated Beli-style binary
 * insertion (`PairwiseRank`) — insert item 2 into [item 1], item 3
 * into that 2-item order, and so on, ~⌈log₂(n!)⌉ comparisons total.
 * Pass a `key` (e.g. area id + axis) that changes per group so
 * internal state resets between uses.
 */
export function RankGroup({ items, prompt, theme, onComplete }: RankGroupProps) {
  const [ranked, setRanked] = useState<RankableItem[]>(
    items.length > 0 ? [items[0]!] : [],
  );
  const [remaining, setRemaining] = useState<RankableItem[]>(items.slice(1));
  const [placementKey, setPlacementKey] = useState(0);

  useEffect(() => {
    if (items.length <= 1) onComplete(items.map((i) => i.id));
    // Only meant to fire once, for the trivial 0/1-item case at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length <= 1) return null;

  const newItem = remaining[0]!;

  const handleResolve = (rank: number) => {
    const next = [...ranked.slice(0, rank - 1), newItem, ...ranked.slice(rank - 1)];
    const nextRemaining = remaining.slice(1);
    setRanked(next);
    setRemaining(nextRemaining);
    setPlacementKey((k) => k + 1);
    if (nextRemaining.length === 0) {
      onComplete(next.map((r) => r.id));
    }
  };

  return (
    <PairwiseRank
      key={placementKey}
      newItem={newItem}
      existingItems={ranked}
      prompt={prompt}
      theme={theme}
      onResolve={handleResolve}
    />
  );
}
