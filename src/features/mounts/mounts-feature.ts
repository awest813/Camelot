/**
 * Horses as a kernel feature: the horse roster and stable master, mounting,
 * the stable (buy a horse) and saddlebag (take items) windows.
 *
 * One pair of actions — `toggleMount` (O) and `toggleStableOrSaddlebag`
 * (Shift+O) — serves both the input adapter and the legacy keyboard path,
 * which used to carry two full copies of this logic.
 *
 * Inputs:   services feedback, modal, purse, mount-host.
 * Outputs:  the `mounts` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { HorseSystem } from "../../systems/horse-system";
import type { StableUI } from "../../ui/stable-ui";
import type { SaddlebagUI } from "../../ui/saddlebag-ui";
import { LazyPanel } from "../../ui/lazy-panel";
import { UIAnimator } from "../../ui/ui-animator";
import type { Item } from "../../systems/inventory-system";
import { FeedbackKey, ModalKey, PurseKey, ownSave } from "../services";

/** What riding needs from the game. */
export interface MountHostService {
  /** Whether gameplay actions are allowed now (not paused, not talking). */
  canAct(): boolean;
  setMoveSpeedMultiplier(multiplier: number): void;
  unlockAchievement(id: string): void;
  give(item: Item): void;
}

export interface MountsService {
  readonly horses: HorseSystem;
  /** The stable and saddlebag windows (loaded on first use). */
  readonly stable: LazyPanel<StableUI>;
  readonly saddlebag: LazyPanel<SaddlebagUI>;
  /** O: mount the first owned horse, or dismount. */
  toggleMount(): void;
  /** Shift+O: the saddlebag while mounted, otherwise the stable. */
  toggleStableOrSaddlebag(): void;
}

export const MountHostKey = createServiceKey<MountHostService>("mount-host");
export const MountsKey = createServiceKey<MountsService>("mounts");

const STABLE_MASTER = "Stable Master";

export class MountsFeature implements Feature {
  public readonly id = "mounts";
  public readonly horses = new HorseSystem();
  /** Loaded the first time they open (out of the start-up bundle). */
  public readonly stable = new LazyPanel<StableUI>(async () => {
    const { StableUI } = await import("../../ui/stable-ui");
    const panel = new StableUI();
    this._wireStable?.(panel);
    return panel;
  });
  public readonly saddlebag = new LazyPanel<SaddlebagUI>(async () => {
    const { SaddlebagUI } = await import("../../ui/saddlebag-ui");
    const panel = new SaddlebagUI();
    panel.setAnimator(new UIAnimator());
    this._wireSaddlebag?.(panel);
    return panel;
  });
  private _wireStable: ((panel: StableUI) => void) | null = null;
  private _wireSaddlebag: ((panel: SaddlebagUI) => void) | null = null;

  constructor() {
    // Starter horses available at world stables.
    this.horses.registerHorse({ id: "bay_mare", name: "Bay Mare", speed: 1.8, saddlebagCapacity: 8, stableId: "starter_stable" });
    this.horses.registerHorse({ id: "black_stallion", name: "Black Stallion", speed: 2.2, saddlebagCapacity: 6, stableId: "starter_stable" });
    this.horses.registerHorse({ id: "grey_gelding", name: "Grey Gelding", speed: 2.0, saddlebagCapacity: 10, stableId: "starter_stable" });
    this.horses.registerStableNPC({
      npcName: STABLE_MASTER,
      availableHorseIds: ["bay_mare", "black_stallion", "grey_gelding"],
      prices: { bay_mare: 500, black_stallion: 1000, grey_gelding: 750 },
    });
  }

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    ownSave(ctx, {
      key: "horse",
      save: () => this.horses.getSaveState(),
      load: (data) => {
        if (data) this.horses.restoreFromSave(data as never); // a mounted save re-mounts (onMount sets the speed)
        if (!this.horses.isMounted) s.get(MountHostKey).setMoveSpeedMultiplier(1); // on foot in the save: walk
      },
    });
    const host = () => s.get(MountHostKey);
    const feedback = () => s.get(FeedbackKey);
    const modal = () => s.get(ModalKey);
    const purse = () => s.get(PurseKey);

    this.horses.onMount = (horse, speed) => {
      host().setMoveSpeedMultiplier(speed);
      feedback().notify(`Mounted ${horse.name}`, 1800);
      host().unlockAchievement("ACH_SADDLED");
      feedback().markDirty();
    };
    this.horses.onDismount = (horse) => {
      host().setMoveSpeedMultiplier(1);
      feedback().notify(`Dismounted ${horse.name}`, 1800);
      feedback().markDirty();
    };
    this.horses.onHorsePurchased = (horse) => {
      feedback().notify(`Purchased ${horse.name}!`, 2500);
      host().unlockAchievement("ACH_SADDLED");
      feedback().markDirty();
    };

    this._wireStable = (stable) => {
      stable.onClose = () => modal().restoreGameplay();
      stable.onPurchase = (horseId) => {
        if (!this.horses.getStableNPC(STABLE_MASTER)) return;
        const price = this.horses.purchaseHorse(STABLE_MASTER, horseId, purse().gold());
        if (price === -2) {
          stable.showStatus("You already own this horse.", true);
        } else if (price < 0) {
          stable.showStatus("Unable to complete the purchase.", true);
        } else {
          purse().spend(price);
          stable.markOwned(horseId);
          stable.setPlayerGold(purse().gold());
          stable.showStatus(`You purchased a horse for ${price}g.`);
        }
      };
    };

    this._wireSaddlebag = (saddlebag) => {
      saddlebag.onClose = () => modal().restoreGameplay();
      saddlebag.onRemoveItem = (itemId) => {
        const horse = this.horses.currentHorse;
        if (!horse) return;
        const entry = this.horses.getSaddlebag(horse.id)?.find((i) => i.id === itemId);
        if (!entry) return;
        if (this.horses.saddlebagRemoveItem(horse.id, itemId)) {
          host().give({ ...entry, quantity: 1 });
          this._refreshSaddlebag();
          saddlebag.showStatus(`Took ${entry.name}.`);
        }
      };
    };

    ctx.provide(MountsKey, {
      horses: this.horses,
      stable: this.stable,
      saddlebag: this.saddlebag,
      toggleMount: () => {
        if (!host().canAct()) return;
        if (this.horses.isMounted) {
          this.horses.dismountHorse();
          return;
        }
        const owned = this.horses.ownedHorses;
        if (owned.length === 0) feedback().notify("You don't own a horse. Visit a stable (Shift+O).", 2500);
        else this.horses.mountHorse(owned[0].id);
      },
      toggleStableOrSaddlebag: () => {
        if (!host().canAct()) return;
        if (this.horses.isMounted) {
          if (this.saddlebag.isVisible) { this.saddlebag.close(); return; }
          const horse = this.horses.currentHorse!;
          const bag = this.horses.getSaddlebag(horse.id) ?? [];
          void this.saddlebag.get().then((panel) => {
            panel.open(horse.name, bag.map(toRow), bag.length, horse.saddlebagCapacity);
            modal().suspendGameplay();
          });
          return;
        }
        if (this.stable.isVisible) { this.stable.close(); return; }
        const stable = this.horses.getStableNPC(STABLE_MASTER);
        if (!stable) {
          feedback().notify("No stable nearby.", 1500);
          return;
        }
        const offers = stable.availableHorseIds.map((id) => {
          const h = this.horses.getHorse(id)!;
          return {
            id: h.id, name: h.name, speed: h.speed,
            saddlebagCapacity: h.saddlebagCapacity, price: stable.prices[id] ?? 0, isOwned: h.isOwned,
          };
        });
        void this.stable.get().then((panel) => {
          panel.open(STABLE_MASTER, offers, purse().gold());
          modal().suspendGameplay();
        });
      },
    });

    ctx.scope.add(() => {
      this.horses.onMount = null;
      this.horses.onDismount = null;
      this.horses.onHorsePurchased = null;
      if (this.stable.isVisible) this.stable.close();
      if (this.saddlebag.isVisible) this.saddlebag.close();
    });
  }

  private _refreshSaddlebag(): void {
    const horse = this.horses.currentHorse;
    if (!horse) return;
    const bag = this.horses.getSaddlebag(horse.id) ?? [];
    this.saddlebag.current?.refresh(bag.map(toRow), bag.length, horse.saddlebagCapacity);
  }
}

function toRow(i: { id: string; name: string; quantity: number; stackable: boolean }) {
  return { id: i.id, name: i.name, quantity: i.quantity, stackable: i.stackable };
}
