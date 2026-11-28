/**
 * Cells: entering one (discovery, the HUD, music), portal fades, and putting the world back after a load.
 *
 * Part of the composition root (moved out of game.ts).
 */
import type { Game } from "../game";
import { dressInterior } from "../world/interior-dressing";

export function onCellEntered(g: Game, cellId: string, cellName: string): void {
  // Interiors become fast-travel destinations; the open world ("exterior",
  // entered on the way out of one) is not a place to travel to.
  if (g.cellManager.currentCell?.type !== "exterior") {
    const isNew = g.fastTravelSystem.discoverLocation(
        cellId, cellName, g.player.camera.position.clone()
    );
    g.ui.showNotification(
        isNew ? `Discovered: ${cellName}` : `Entered: ${cellName}`, 2500
    );
  }

  // LodSystem prunes disposed meshes in update(); chunk CDN props keep stable
  // refs for the exterior world, so we do not clear the registry here.

  presentCell(g, cellId);
}

/** Hide the outdoors inside an interior, and dress a freshly built room. */
export function presentCell(g: Game, cellId: string): void {
  const isInterior = g.cellManager.isInterior;
  g.world.setVisible(!isInterior);
  if (isInterior) dressInterior(cellId, { scene: g.scene, textures: g.world.textureManager, fireFx: g._env.fireFx });
}

export function beginPortalTransition(g: Game, portalId: string): void {
  if (!g.cellManager.portals.has(portalId)) return;
  if (g.ui.isScreenFadeActive) return;
  g.ui.playScreenFadeSequence({
      fadeOutMs: 420,
      holdMs: 140,
      fadeInMs: 480,
      onBlack: () => {
          g.cellManager.tryTransition(portalId);
      },
  });
}

/** Rebuild interior geometry after load so cell save state matches the scene. */
export function hydrateCellAfterLoad(g: Game): void {
  g.cellManager.hydrateActiveCellFromState();
  const cell = g.cellManager.currentCell;
  if (cell) {
      // (Only interiors are destinations; see _onCellEntered.)
      if (cell.type !== "exterior") {
        g.fastTravelSystem.discoverLocation(cell.id, cell.name, g.player.camera.position.clone());
      }
      // World visibility, and an interior's torches and textures (as on entering it).
      presentCell(g, cell.id);
  }
}

/** Remove world loot objects whose item IDs are now in inventory or equipment (called after load). */
export function cleanupCollectedLoot(g: Game): void {
  const collectedIds = new Set<string>();
  for (const item of g.inventorySystem.items) {
      collectedIds.add(item.id);
  }
  for (const item of g.equipmentSystem.getEquipped().values()) {
      collectedIds.add(item.id);
  }
  // Iterate a snapshot to avoid mutation during iteration
  for (const mesh of g.scene.meshes.slice()) {
      if (mesh.metadata?.type === 'loot') {
          const loot = mesh.metadata.loot;
          if (collectedIds.has(loot.item.id) || (loot.pickupKey && g.containerSystem.takenPickups.has(loot.pickupKey))) {
              loot.dispose();
          }
      }
  }
}
