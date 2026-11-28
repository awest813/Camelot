/**
 * A chest the player can open in the world (a bandit camp's strongbox): the
 * chest model, owned by its chunk, whose meshes carry the container so the
 * player can look at it and press E.  Locked at the site's difficulty; its
 * contents come from a loot table, rolled the same for the same world and
 * chest, or nothing when it was taken from lately (what was left then stays in it).
 */
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { ChunkContent } from "./chunk-content";
import type { ContainerSystem } from "../systems/container-system";
import type { Item } from "../systems/inventory-system";
import { setInstanceYaw, type FantasyAssetLoader } from "../systems/fantasy-asset-loader";

export interface ChestDeps {
  chunks: ChunkContent;
  containers: ContainerSystem;
  assets: FantasyAssetLoader;
  /** What a chest holds: loot table `loot`, rolled for chest `id`. */
  contents(loot: string, id: string): Item[];
}

export interface ChestPlacement {
  id: string; name: string; x: number; z: number; rot: number; lock: number; loot: string; empty: boolean;
  /** Whose it is (a faction): taking from it is theft. */
  owner?: string;
}

export function placeChest(d: ChestDeps, chunkKey: string, chest: ChestPlacement): void {
  const record = d.chunks.record(chunkKey);
  if (!record) return;
  d.assets.getInstance("qChest", (root) => {
    if (!root) return;
    if (d.chunks.record(chunkKey) !== record) { root.dispose(); return; }
    root.position.set(chest.x, 0, chest.z);
    setInstanceYaw(root, chest.rot);
    d.containers.registerChest(chest.id, chest.name, root as Mesh, chest.empty ? [] : mergeStacks(d.contents(chest.loot, chest.id)), chest.lock, chest.owner);
    root.onDisposeObservable.addOnce(() => d.containers.unregister(chest.id));
    d.chunks.track(chunkKey, record, root, "prop");
  });
}

/** One row per stackable item (a loot roll returns gold as several stacks). */
export function mergeStacks(items: readonly Item[]): Item[] {
  const out: Item[] = [];
  for (const item of items) {
    const same = item.stackable ? out.find((o) => o.stackable && o.id === item.id) : undefined;
    if (same) same.quantity += item.quantity;
    else out.push({ ...item });
  }
  return out;
}
