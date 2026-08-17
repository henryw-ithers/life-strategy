import { eq } from "drizzle-orm";

import type { db as Db } from "./client";
import { lifeArea, lifeUnit } from "./schema";
import { DEFAULT_TAXONOMY } from "./taxonomy";

/**
 * Taxonomy sync (ADR-0002 §2): runs on every launch. Default areas and
 * units are upserted by their stable ids (renames and re-homes apply
 * as label updates), and non-custom rows that left the default set are
 * archived — never deleted, so rating history stays intact. Custom
 * units are never touched.
 */
export async function syncTaxonomy(db: typeof Db): Promise<void> {
  const now = new Date().toISOString();

  const defaultUnits = DEFAULT_TAXONOMY.flatMap((area) =>
    area.units.map((unit, index) => ({
      id: unit.id,
      name: unit.name,
      areaId: area.id,
      sortOrder: index,
      motivationKind: unit.motivationKind ?? ("instrumental" as const),
    })),
  );
  const defaultAreaIds = new Set(DEFAULT_TAXONOMY.map((a) => a.id));
  const defaultUnitIds = new Set(defaultUnits.map((u) => u.id));

  await db.transaction(async (tx) => {
    const existingAreas = await tx.select().from(lifeArea);
    const existingUnits = await tx.select().from(lifeUnit);

    for (const [index, area] of DEFAULT_TAXONOMY.entries()) {
      const existing = existingAreas.find((e) => e.id === area.id);
      if (!existing) {
        await tx
          .insert(lifeArea)
          .values({ id: area.id, name: area.name, sortOrder: index });
      } else if (
        existing.name !== area.name ||
        existing.sortOrder !== index ||
        existing.archivedAt !== null
      ) {
        await tx
          .update(lifeArea)
          .set({ name: area.name, sortOrder: index, archivedAt: null })
          .where(eq(lifeArea.id, area.id));
      }
    }

    for (const unit of defaultUnits) {
      const existing = existingUnits.find((e) => e.id === unit.id);
      if (!existing) {
        await tx.insert(lifeUnit).values(unit);
      } else if (
        existing.name !== unit.name ||
        existing.areaId !== unit.areaId ||
        existing.sortOrder !== unit.sortOrder ||
        existing.motivationKind !== unit.motivationKind ||
        existing.archivedAt !== null
      ) {
        await tx
          .update(lifeUnit)
          .set({
            name: unit.name,
            areaId: unit.areaId,
            sortOrder: unit.sortOrder,
            // Seed-authoritative, like name and area — this is how
            // ADR-0025 §1's assignments reach existing installs. Safe
            // only while nothing in the UI edits it; if a user-facing
            // override is ever added, this line has to stop
            // overwriting it or it will silently revert their choice
            // on the next launch.
            motivationKind: unit.motivationKind,
            archivedAt: null,
          })
          .where(eq(lifeUnit.id, unit.id));
      }
    }

    for (const area of existingAreas) {
      if (!defaultAreaIds.has(area.id) && area.archivedAt === null) {
        await tx
          .update(lifeArea)
          .set({ archivedAt: now })
          .where(eq(lifeArea.id, area.id));
      }
    }
    for (const unit of existingUnits) {
      if (
        !defaultUnitIds.has(unit.id) &&
        !unit.isCustom &&
        unit.archivedAt === null
      ) {
        await tx
          .update(lifeUnit)
          .set({ archivedAt: now })
          .where(eq(lifeUnit.id, unit.id));
      }
    }
  });
}
