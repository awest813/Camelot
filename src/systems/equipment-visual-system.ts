/**
 * EquipmentVisualSystem — Modular outfit mesh attachment for characters.
 *
 * Manages the visual representation of equipped armour and clothing on
 * character meshes.  When a player or NPC equips an item that has a
 * corresponding Quaternius outfit asset, this system attaches (or detaches)
 * the correct mesh piece to/from the character's skeleton.
 *
 * Equipment slots:
 *   head     — helmets, hoods
 *   chest    — cuirasses, robes
 *   legs     — greaves, trousers
 *   feet     — boots, sabatons
 *   back     — cloaks, capes
 *   offhand  — shields
 *
 * Quaternius Modular Character Outfits (CC0 Public Domain) provide meshes
 * that are designed to attach to a standard humanoid skeleton.  Each outfit
 * piece is loaded via `FantasyAssetLoader` and parented to the character's
 * root mesh.
 *
 * This system is headless-testable: the actual mesh attachment is performed
 * by callback functions that the game layer provides when constructing the
 * system.  The system itself tracks only the logical state.
 */

import type { FantasyAssetKey } from "./fantasy-asset-loader";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Equipment visual slots supported by the system. */
export type EquipmentVisualSlot =
  | "head"
  | "chest"
  | "legs"
  | "feet"
  | "back"
  | "offhand";

/** Maps an equipment visual slot to a Quaternius outfit asset key. */
export interface OutfitBinding {
  slot: EquipmentVisualSlot;
  assetKey: FantasyAssetKey;
}

/** Snapshot of a character's current outfit state for save/restore. */
export interface OutfitSnapshot {
  characterId: string;
  bindings: Record<EquipmentVisualSlot, FantasyAssetKey | null>;
}

/** Callback invoked when an outfit piece should be attached to a character. */
export type OnOutfitAttach = (characterId: string, slot: EquipmentVisualSlot, assetKey: FantasyAssetKey) => void;

/** Callback invoked when an outfit piece should be detached from a character. */
export type OnOutfitDetach = (characterId: string, slot: EquipmentVisualSlot) => void;

// ── Constants ─────────────────────────────────────────────────────────────────

/** All valid equipment visual slot names. */
export const EQUIPMENT_VISUAL_SLOTS: readonly EquipmentVisualSlot[] = [
  "head", "chest", "legs", "feet", "back", "offhand",
] as const;

const VALID_SLOTS = new Set<string>(EQUIPMENT_VISUAL_SLOTS);

// ── Internal state ──────────────────────────────────────────────────────────

interface CharacterOutfitState {
  bindings: Map<EquipmentVisualSlot, FantasyAssetKey>;
}

// ── EquipmentVisualSystem ────────────────────────────────────────────────────

export class EquipmentVisualSystem {
  private readonly _characters: Map<string, CharacterOutfitState> = new Map();
  private _onAttach: OnOutfitAttach | null = null;
  private _onDetach: OnOutfitDetach | null = null;

  // ── Callback wiring ───────────────────────────────────────────────────────

  /** Set the callback invoked when an outfit mesh should be attached. */
  set onOutfitAttach(cb: OnOutfitAttach | null) {
    this._onAttach = cb;
  }

  /** Set the callback invoked when an outfit mesh should be detached. */
  set onOutfitDetach(cb: OnOutfitDetach | null) {
    this._onDetach = cb;
  }

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a character to track outfit state.
   * If already registered, this is a no-op.
   */
  registerCharacter(characterId: string): void {
    if (!this._characters.has(characterId)) {
      this._characters.set(characterId, {
        bindings: new Map(),
      });
    }
  }

  /**
   * Unregister a character and clear all outfit bindings.
   * Fires `onOutfitDetach` for each slot that had an outfit.
   */
  unregisterCharacter(characterId: string): void {
    const state = this._characters.get(characterId);
    if (!state) return;

    for (const slot of state.bindings.keys()) {
      this._onDetach?.(characterId, slot);
    }
    this._characters.delete(characterId);
  }

  /** Returns true if the character is registered. */
  isRegistered(characterId: string): boolean {
    return this._characters.has(characterId);
  }

  /** Returns all registered character IDs. */
  getRegisteredCharacters(): string[] {
    return Array.from(this._characters.keys());
  }

  // ── Equip / Unequip ───────────────────────────────────────────────────────

  /**
   * Equip an outfit piece to a character slot.
   *
   * If the slot already has a different outfit, it is detached first.
   * If the same outfit is already in the slot, this is a no-op.
   *
   * @param characterId  The character's unique identifier.
   * @param slot         The equipment visual slot.
   * @param assetKey     The FantasyAssetKey of the outfit mesh.
   * @returns True if the outfit was equipped (false if no-op or unregistered).
   */
  equip(characterId: string, slot: EquipmentVisualSlot, assetKey: FantasyAssetKey): boolean {
    const state = this._characters.get(characterId);
    if (!state) return false;

    const current = state.bindings.get(slot);
    if (current === assetKey) return false; // already wearing this

    // Detach existing piece if different
    if (current !== undefined) {
      this._onDetach?.(characterId, slot);
    }

    state.bindings.set(slot, assetKey);
    this._onAttach?.(characterId, slot, assetKey);
    return true;
  }

  /**
   * Remove the outfit piece from a character slot.
   *
   * @returns True if something was unequipped (false if slot was empty or unregistered).
   */
  unequip(characterId: string, slot: EquipmentVisualSlot): boolean {
    const state = this._characters.get(characterId);
    if (!state) return false;

    if (!state.bindings.has(slot)) return false;

    state.bindings.delete(slot);
    this._onDetach?.(characterId, slot);
    return true;
  }

  /**
   * Remove all outfit pieces from a character.
   * Fires `onOutfitDetach` for each slot.
   */
  unequipAll(characterId: string): void {
    const state = this._characters.get(characterId);
    if (!state) return;

    for (const slot of Array.from(state.bindings.keys())) {
      this._onDetach?.(characterId, slot);
    }
    state.bindings.clear();
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Get the asset key equipped in a slot, or `undefined` if empty. */
  getEquipped(characterId: string, slot: EquipmentVisualSlot): FantasyAssetKey | undefined {
    return this._characters.get(characterId)?.bindings.get(slot);
  }

  /** Get all equipped slots and their asset keys for a character. */
  getOutfit(characterId: string): Partial<Record<EquipmentVisualSlot, FantasyAssetKey>> {
    const state = this._characters.get(characterId);
    if (!state) return {};
    const result: Partial<Record<EquipmentVisualSlot, FantasyAssetKey>> = {};
    for (const [slot, key] of state.bindings) {
      result[slot] = key;
    }
    return result;
  }

  /** Returns the number of slots currently filled for a character. */
  getEquippedSlotCount(characterId: string): number {
    return this._characters.get(characterId)?.bindings.size ?? 0;
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  /**
   * Capture the outfit state for a character as a serialisable snapshot.
   * Returns `null` if the character is not registered.
   */
  getSnapshot(characterId: string): OutfitSnapshot | null {
    const state = this._characters.get(characterId);
    if (!state) return null;

    const bindings: Record<EquipmentVisualSlot, FantasyAssetKey | null> = {
      head: null, chest: null, legs: null, feet: null, back: null, offhand: null,
    };
    for (const [slot, key] of state.bindings) {
      bindings[slot] = key;
    }
    return { characterId, bindings };
  }

  /**
   * Restore outfit state from a snapshot.
   * Registers the character if not already registered.
   * Fires `onOutfitAttach` for each non-null slot.
   */
  restoreSnapshot(snapshot: OutfitSnapshot): void {
    // Ensure character is registered
    this.registerCharacter(snapshot.characterId);
    const state = this._characters.get(snapshot.characterId)!;

    // Clear existing bindings
    for (const slot of state.bindings.keys()) {
      this._onDetach?.(snapshot.characterId, slot);
    }
    state.bindings.clear();

    // Restore from snapshot
    for (const slotStr of Object.keys(snapshot.bindings)) {
      if (!VALID_SLOTS.has(slotStr)) continue;
      const slot = slotStr as EquipmentVisualSlot;
      const assetKey = snapshot.bindings[slot];
      if (assetKey) {
        state.bindings.set(slot, assetKey);
        this._onAttach?.(snapshot.characterId, slot, assetKey);
      }
    }
  }

  /**
   * Capture all characters' outfit state.
   */
  getAllSnapshots(): OutfitSnapshot[] {
    const snapshots: OutfitSnapshot[] = [];
    for (const characterId of this._characters.keys()) {
      const snap = this.getSnapshot(characterId);
      if (snap) snapshots.push(snap);
    }
    return snapshots;
  }

  /**
   * Restore all characters' outfit state from an array of snapshots.
   */
  restoreAllSnapshots(snapshots: OutfitSnapshot[]): void {
    for (const snap of snapshots) {
      this.restoreSnapshot(snap);
    }
  }
}
