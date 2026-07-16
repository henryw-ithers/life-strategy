import { count } from "drizzle-orm";
import type { db as Db } from "./client";
import { lifeArea, lifeUnit } from "./schema";
import { DEFAULT_TAXONOMY } from "./taxonomy";

/**
 * Idempotent: seeds the 6×16 default taxonomy on first launch and does
 * nothing on every launch after that.
 */
export async function seedTaxonomy(db: typeof Db): Promise<void> {
  const [row] = await db.select({ n: count() }).from(lifeArea);
  if ((row?.n ?? 0) > 0) return;

  await db.transaction(async (tx) => {
    for (const [areaIndex, area] of DEFAULT_TAXONOMY.entries()) {
      await tx.insert(lifeArea).values({
        id: area.id,
        name: area.name,
        sortOrder: areaIndex,
      });
      await tx.insert(lifeUnit).values(
        area.units.map((unit, unitIndex) => ({
          id: unit.id,
          areaId: area.id,
          name: unit.name,
          sortOrder: unitIndex,
        })),
      );
    }
  });
}
