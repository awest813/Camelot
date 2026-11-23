/**
 * Pickpocketing as a kernel feature: what each NPC carries that can be
 * lifted, the picker (crouched behind a mark, E), the roll, getting caught.
 *
 * Inputs:   services thief-host, skills, feedback, modal.
 * Outputs:  the `pickpocket` service; `pickpocket:opened` events.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { PickpocketSystem, type PickpocketableItem } from "../../systems/pickpocket-system";
import { PickpocketUI } from "../../ui/pickpocket-ui";
import type { NPC } from "../../entities/npc";
import { FeedbackKey, ModalKey, SkillsKey } from "../services";

/** A mark's awareness (lowers the odds of a clean lift). */
const MARK_AWARENESS = 30;
export const COIN_PURSE = "coin_purse";

/** What stealing needs from the game. */
export interface ThiefHostService {
  crouching(): boolean;
  /** Whether this mark has noticed the player. */
  noticed(npcId: string): boolean;
  /** Report the theft (a crime against the mark's faction). */
  reportTheft(npcId: string): void;
  /** Put a lifted item in the player's pack. */
  receive(itemId: string): void;
}

export interface PickpocketService {
  readonly system: PickpocketSystem;
  readonly panel: PickpocketUI;
  /** E behind an unaware mark. */
  open(npc: NPC): void;
  close(): void;
  /** Give an NPC something to lift (their gear, and coin when peaceful). */
  registerNpc(npc: NPC): void;
}

export const ThiefHostKey = createServiceKey<ThiefHostService>("thief-host");
export const PickpocketKey = createServiceKey<PickpocketService>("pickpocket");

const REASONS: Record<string, string> = {
  unknown_npc: "There's nothing to steal there.",
  not_crouching: "You must stay crouched to pickpocket.",
  already_detected: "You've been spotted — too late to lift anything.",
  empty_inventory: "Nothing worth taking.",
  unknown_item: "That item is already gone.",
};

export class PickpocketFeature implements Feature {
  public readonly id = "pickpocket";
  public readonly system = new PickpocketSystem();
  public readonly panel = new PickpocketUI();
  private _target: string | null = null;
  private _s: ServiceRegistry | null = null;
  /** Rolls in [0, 100) on the kernel's seeded "pickpocket" stream. */
  private _roll: () => number = () => 50;

  /** `itemName` names an item id (falls back to a readable id). */
  constructor(private readonly _itemName: (id: string) => string | undefined) {}

  /** Display name for an item id. */
  public label(id: string): string {
    if (id === COIN_PURSE) return "Coin Purse";
    return this._itemName(id) ?? id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Register what an NPC carries (usable before install: NPCs exist first). */
  public registerNpc(npc: NPC): void {
    const items: PickpocketableItem[] = npc.startingEquipmentIds.map((id) => ({ id, name: this.label(id), weight: 0.5, value: 10 }));
    // Settlers carry coin; without it nobody has anything worth stealing.
    if (!npc.isAggressive) items.push({ id: COIN_PURSE, name: "Coin Purse", weight: 0.1, value: 12 });
    this.system.registerNpcInventory(npc.key, items);
  }

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    this._s = s;
    this._roll = () => ctx.kernel.rng.stream("pickpocket").next() * 100;
    const feedback = () => s.get(FeedbackKey);
    const sys = this.system;

    sys.onPickpocketSuccess = (npcId, itemId, xp) => {
      s.get(ThiefHostKey).receive(itemId);
      s.get(SkillsKey).gainXP("sneak", xp);
      feedback().notify(`Lifted ${this.label(itemId)}!`, 2200);
      feedback().markDirty();
      this._refresh(npcId);
    };
    sys.onPickpocketFailed = (_npcId, _itemId, caught) => {
      if (!caught) feedback().notify("Your fingers slip — unnoticed. Try again.", 2200);
    };
    sys.onCaught = (npcId) => {
      s.get(ThiefHostKey).reportTheft(npcId);
      feedback().notify("Caught pickpocketing!", 2600);
      if (this.panel.isVisible) this._close();
    };
    this.panel.onStealItem = (itemId) => this._steal(itemId);
    this.panel.onClose = () => { this._target = null; s.get(ModalKey).restoreGameplay(); };

    ctx.provide(PickpocketKey, {
      system: sys,
      panel: this.panel,
      registerNpc: (npc) => this.registerNpc(npc),
      close: () => { if (this.panel.isVisible) this._close(); },
      open: (npc) => {
        const npcId = npc.key;
        const items = sys.getNpcInventory(npcId);
        if (!items || items.length === 0) {
          feedback().notify("Nothing worth taking.", 1800);
          return;
        }
        this._target = npcId;
        this.panel.show(npcId);
        this._refresh(npcId);
        s.get(ModalKey).suspendGameplay();
        ctx.kernel.events.emit("pickpocket:opened", { npcName: npcId });
      },
    });

    ctx.scope.add(() => {
      sys.onPickpocketSuccess = null;
      sys.onPickpocketFailed = null;
      sys.onCaught = null;
      this.panel.onStealItem = null;
      this.panel.onClose = null;
      if (this.panel.isVisible) this.panel.hide();
      this._s = null;
    });
  }

  private _sneak(): number {
    return this._s?.get(SkillsKey).level("sneak") ?? 0;
  }

  private _close(): void {
    this._target = null;
    this.panel.hide();
    this._s?.get(ModalKey).restoreGameplay();
  }

  /** Re-render with live chances; close when the mark is cleaned out. */
  private _refresh(npcId: string): void {
    if (!this.panel.isVisible) return;
    const items = this.system.getNpcInventory(npcId) ?? [];
    const sneak = this._sneak();
    this.panel.update(items.map((i) => ({
      id: i.id, name: i.name, chance: this.system.getSuccessChance(npcId, i.id, sneak, MARK_AWARENESS) ?? 0,
    })));
    if (items.length === 0) this._close();
  }

  /** One steal click: a live eligibility check, then the roll. */
  private _steal(itemId: string): void {
    const npcId = this._target, s = this._s;
    if (!npcId || !s) return;
    const host = s.get(ThiefHostKey);
    const result = this.system.attempt(npcId, itemId, this._sneak(), MARK_AWARENESS, host.crouching(), host.noticed(npcId), this._roll);
    if (result.success || result.reason === "failed_roll") return; // the callbacks report it
    // Eligibility lapsed with the picker open (stood up, spotted, emptied).
    s.get(FeedbackKey).notify(REASONS[result.reason] ?? "Can't steal that.", 2200);
    if (result.reason === "empty_inventory" || result.reason === "unknown_npc") this._close();
  }
}
