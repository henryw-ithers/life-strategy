/**
 * The Log shows a day's photos from where they actually are: the row
 * holds a path inside app storage, resolved against this launch's
 * documents directory. Handed over raw, every photo failed to load and
 * read as "Photo not in this backup" (Henry, 2026-10-26).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadLog } from "../log";
import { photo } from "../schema";
import { resetTestDb, testDb } from "./harness";

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///container/Documents/",
}));

describe("photos in the Log", () => {
  beforeEach(() => resetTestDb());

  it("resolves a stored path against this launch's documents", async () => {
    testDb().insert(photo).values({ id: "p1", localDate: "2026-10-20", fileUri: "photos/p1.jpg" }).run();
    const months = await loadLog();
    const photos = months.flatMap((m) => m.entries.flatMap((e) => e.photos));
    expect(photos.map((p) => p.uri)).toEqual(["file:///container/Documents/photos/p1.jpg"]);
  });

  it("heals an old absolute path from a container that has moved", async () => {
    testDb()
      .insert(photo)
      .values({ id: "p2", localDate: "2026-10-20", fileUri: "file:///old/UUID/Documents/photos/p2.png" })
      .run();
    const months = await loadLog();
    const photos = months.flatMap((m) => m.entries.flatMap((e) => e.photos));
    expect(photos.map((p) => p.uri)).toEqual(["file:///container/Documents/photos/p2.png"]);
  });
});
