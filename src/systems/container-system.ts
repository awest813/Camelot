import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Item } from "./inventory-system";
import { InventorySystem } from "./inventory-system";
import { UIManager } from "../ui/ui-manager";
import { Player } from "../entities/player";

export interface ContainerDef {
  id: string;
  name: string;
  position: Vector3;
  contents: Item[];
  isLocked?: boolean;
  /** Lock difficulty 0-100.  0 = trivial, 100 = master. */
  lockDifficulty?: number;
}

export interface Container {
  id: string;
  name: string;
  mesh: Mesh;
  contents: Item[];
  isLocked: boolean;
  lockDifficulty: number;
  isOpen: boolean;
}

export interface ContainerSaveState {
  containers: Array<{ id: string; contents: Item[]; isLocked: boolean }>;
}

/**
 * Manages interactive containers (chests, barrels, corpses) in the world.
 *
 * - Containers are spawned with `spawnContainer()` and placed in the scene.
 * - Dead NPCs can be registered as lootable corpses with `registerCorpse()`.
 * - E-key (via InteractionSystem) picks up a "container" metadata type and
 *   calls `tryOpen()`, which fires `onContainerOpen` for the UI to handle.
 * - Container contents are persisted through save/load via `getSaveState()`.
 *
 * Lockpicking:
 *   `tryOpen(container, lockpickSkill)` — player must have a lockpick skill
 *   ≥ lockDifficulty to open a locked container.  On failure, a notification
 *   is shown and `tryOpen` returns false.
 */
export class ContainerSystem {
  private _scene: Scene;
  private _player: Player;
  private _inventory: InventorySystem;
  private _ui: UIManager;

  private _containers: Map<string, Container> = new Map();
  public activeContainer: Container | null = null;

  /** Fired when the player successfully opens a container. Hook to show UI. */
  public onContainerOpen: ((container: Container) => void) | null = null;

  constructor(
    scene: Scene,
    player: Player,
    inventory: InventorySystem,
    ui: UIManager,
  ) {
    this._scene     = scene;
    this._player    = player;
    this._inventory = inventory;
    this._ui        = ui;
  }

  // ── World spawning ─────────────────────────────────────────────────────────

  /**
   * Spawn a chest mesh at `def.position` and register it as a container.
   * The mesh receives `metadata.type = "container"` so the InteractionSystem
   * can detect it via raycast.
   */
  public spawnContainer(def: ContainerDef): Container {
    const mesh = MeshBuilder.CreateBox(
      `container_${def.id}`,
      { width: 0.9, height: 0.6, depth: 0.6 },
      this._scene,
    );
    mesh.position = def.position.clone();
    mesh.position.y += 0.3; // sit on ground

    const mat = new StandardMaterial(`containerMat_${def.id}`, this._scene);
    mat.diffuseColor = def.isLocked
      ? new Color3(0.45, 0.35, 0.20)   // dark locked chest
      : new Color3(0.60, 0.45, 0.22);  // warm open-able chest
    mat.specularColor = new Color3(0.20, 0.15, 0.08);
    mesh.material = mat;

    const container: Container = {
      id:             def.id,
      name:           def.name,
      mesh,
      contents:       [...def.contents],
      isLocked:       def.isLocked      ?? false,
      lockDifficulty: def.lockDifficulty ?? 0,
      isOpen:         false,
    };

    mesh.metadata = { type: "container", container };
    this._containers.set(def.id, container);
    return container;
  }

  /**
   * Register a dead NPC's existing mesh as a lootable corpse container.
   * Called by CombatSystem after an NPC dies.
   */
  public registerCorpse(id: string, npcName: string, mesh: Mesh, loot: Item[]): Container {
    const container: Container = {
      id,
      name:           `${npcName}'s body`,
      mesh,
      contents:       [...loot],
      isLocked:       false,
      lockDifficulty: 0,
      isOpen:         false,
    };

    // Merge into existing metadata rather than overwriting it
    mesh.metadata = { ...(mesh.metadata ?? {}), containerOverride: container };
    this._containers.set(id, container);
    return container;
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  /**
   * Attempt to open a container.
   * @param container      Target container.
   * @param lockpickSkill  Player's lockpick skill (0-100). Defaults to 0.
   * @returns true if the container was opened, false if locked and skill too low.
   */
  public tryOpen(container: Container, lockpickSkill: number = 0): boolean {
    if (container.isLocked && lockpickSkill < container.lockDifficulty) {
      this._ui.showNotification(
        `Locked (difficulty ${container.lockDifficulty})`, 2000,
      );
      return false;
    }

    container.isOpen  = true;
    this.activeContainer = container;
    this.onContainerOpen?.(container);
    return true;
  }

  /** Take one item from a container into the player's inventory. */
  public takeItem(containerId: string, itemId: string): boolean {
    const container = this._containers.get(containerId);
    if (!container) return false;

    const idx = container.contents.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;

    const item = container.contents[idx];
    const added = this._inventory.addItem({ ...item, quantity: 1 });
    if (!added) return false;

    if (item.quantity > 1) {
      container.contents[idx] = { ...item, quantity: item.quantity - 1 };
    } else {
      container.contents.splice(idx, 1);
    }
    return true;
  }

  /** Take all items from a container at once. Returns count of items taken. */
  public takeAll(containerId: string): number {
    const container = this._containers.get(containerId);
    if (!container) return 0;

    let taken = 0;
    const remaining: Item[] = [];
    for (const item of container.contents) {
      const added = this._inventory.addItem(item);
      if (added) {
        taken++;
      } else {
        remaining.push(item);
      }
    }
    container.contents = remaining;
    if (taken > 0) {
      this._ui.showNotification(`Took ${taken} item(s)`, 1500);
    }
    return taken;
  }

  public closeContainer(): void {
    if (this.activeContainer) {
      this.activeContainer.isOpen = false;
      this.activeContainer = null;
    }
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  public get containers(): Map<string, Container> {
    return this._containers;
  }

  public getContainer(id: string): Container | undefined {
    return this._containers.get(id);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  public getSaveState(): ContainerSaveState {
    const containers: ContainerSaveState["containers"] = [];
    for (const c of this._containers.values()) {
      containers.push({ id: c.id, contents: [...c.contents], isLocked: c.isLocked });
    }
    return { containers };
  }

  public restoreFromSave(state: ContainerSaveState): void {
    for (const saved of state?.containers ?? []) {
      const container = this._containers.get(saved.id);
      if (container) {
        container.contents = [...saved.contents];
        container.isLocked = saved.isLocked;
      }
    }
  }
}
