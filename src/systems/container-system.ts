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
import { unseededRandom } from "../core/rng/rng";

/** The item that picks locks. */
export const LOCKPICK_ID = "lockpick";

/** A lockpick, as merchants sell it and bandits carry it. */
export const LOCKPICK: Item = {
  id: LOCKPICK_ID, name: "Lockpick", description: "A bent iron pick. Snaps if you force it.",
  stackable: true, quantity: 1, weight: 0.1, stats: { value: 8 },
};

/**
 * The chance a lockpick opens a lock: an even chance when the lock is just
 * beyond your skill, falling as it gets harder (never below 10 %, never
 * above 95 %).  Locks within your skill open without a pick.
 */
export function pickChance(skill: number, difficulty: number): number {
  return Math.min(0.95, Math.max(0.1, 0.5 + (skill - difficulty) * 0.015));
}

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
  /** Whose it is (a faction): taking from it is theft, if anyone sees. */
  owner?: string;
}

export interface ContainerSaveState {
  containers: Array<{ id: string; contents: Item[]; isLocked: boolean }>;
  /** Charges left on the Warden's Key. */
  masterKeys?: number;
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
 * Locks:
 *   `tryOpen(container)` — a lock within the player's lock skill (`lockSkill`)
 *   opens.  A harder one takes a lockpick: each try succeeds with
 *   `pickChance(skill, difficulty)` (a seeded roll, `lockRng`), and a failure
 *   snaps the pick.  A master key (the Warden's Key omen) opens any lock once.
 */
export class ContainerSystem {
  private _scene: Scene;
  private _player: Player;
  private _inventory: InventorySystem;
  private _ui: UIManager;

  private _containers: Map<string, Container> = new Map();
  /** The player's lock skill, 0–100 (set by the game: Sneak and Agility). */
  public lockSkill: () => number = () => 0;
  /** Rolls for picking locks (set by the game to a seeded stream). */
  public lockRng: () => number = unseededRandom;
  /** A lock was picked (the game grants Sneak experience). */
  public onLockPicked: ((container: Container) => void) | null = null;
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
    this._register(container);
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
  public tryOpen(container: Container, lockpickSkill: number = this.lockSkill()): boolean {
    if (container.isLocked && lockpickSkill < container.lockDifficulty && this.masterKeys > 0) {
      // A master key (the Warden's Key omen) opens it, once.
      this.masterKeys--;
      container.isLocked = false;
      this._ui.showNotification("The Warden's Key turns the lock.", 2000);
    }
    if (container.isLocked && lockpickSkill < container.lockDifficulty) {
      if (this.lockpicks() === 0) {
        this._ui.showNotification(`Locked. You need a lockpick (lock ${container.lockDifficulty}, your skill ${Math.round(lockpickSkill)}).`, 2600);
        return false;
      }
      if (this.lockRng() >= pickChance(lockpickSkill, container.lockDifficulty)) {
        this._inventory.removeQuantity(LOCKPICK_ID, 1);
        this._ui.showNotification(`The lockpick snaps. (${this.lockpicks()} left)`, 2200);
        return false;
      }
      container.isLocked = false;
      this._ui.showNotification("You pick the lock.", 2000);
      this.onLockPicked?.(container);
    }

    container.isOpen  = true;
    this.activeContainer = container;
    this.onContainerOpen?.(container);
    return true;
  }

  /** Lockpicks the player carries. */
  public lockpicks(): number {
    return this._inventory.items.filter((i) => i.id === LOCKPICK_ID).reduce((n, i) => n + i.quantity, 0);
  }

  /**
   * A chest placed in the world (a camp's strongbox): `mesh` is what the player
   * looks at (it gets the container metadata).  Locked when `lockDifficulty` > 0.
   */
  public registerChest(id: string, name: string, mesh: Mesh, contents: Item[], lockDifficulty: number, owner?: string): Container {
    const container: Container = { id, name, mesh, contents: [...contents], isLocked: lockDifficulty > 0, lockDifficulty, isOpen: false, ...(owner ? { owner } : {}) };
    // The model's meshes all answer to the player's look (a chest is several meshes).
    for (const m of [mesh, ...mesh.getChildMeshes(false)]) { m.isPickable = true; m.metadata = { type: "container", container }; }
    this._register(container);
    return container;
  }

  /** Forget a container (its chunk unloaded). */
  public unregister(id: string): void {
    const c = this._containers.get(id);
    if (!c) return;
    if (this.activeContainer === c) this.activeContainer = null;
    this._containers.delete(id);
  }

  /** Locks the player can open regardless of difficulty (each opens one). */
  public masterKeys = 0;

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
    return { containers, masterKeys: this.masterKeys };
  }

  public restoreFromSave(state: ContainerSaveState): void {
    this._pending.clear();
    if (typeof state?.masterKeys === "number" && Number.isFinite(state.masterKeys)) this.masterKeys = Math.max(0, Math.floor(state.masterKeys));
    for (const saved of state?.containers ?? []) {
      const container = this._containers.get(saved.id);
      if (container) this._apply(container, saved);
      // Not here yet (its model is still loading): applied when it registers.
      // A site's chest is the landmarks' to fill or empty, not the save's.
      else if (!saved.id.startsWith("chest_site_")) this._pending.set(saved.id, saved);
    }
  }

  /** Saved state for containers that had not registered when the save loaded. */
  private readonly _pending = new Map<string, ContainerSaveState["containers"][number]>();

  private _apply(container: Container, saved: ContainerSaveState["containers"][number]): void {
    container.contents = [...saved.contents];
    container.isLocked = saved.isLocked;
  }

  /** Register a container, applying any saved state that was waiting for it. */
  private _register(container: Container): void {
    this._containers.set(container.id, container);
    const saved = this._pending.get(container.id);
    if (saved) { this._pending.delete(container.id); this._apply(container, saved); }
  }
}
