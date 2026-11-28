/**
 * Horses as a kernel feature: the horse roster and the ostler's stable,
 * mounting, the stable (buy a horse) and saddlebag (take items) windows.
 * The stable opens from the ostler's dialogue ("stable:open"); Shift+O on
 * foot says where to find one, mounted it opens the saddlebag.
 *
 * One pair of actions — `toggleMount` (O) and `toggleStableOrSaddlebag`
 * (Shift+O) — serves both the input adapter and the legacy keyboard path,
 * which used to carry two full copies of this logic.
 *
 * Inputs:   services feedback, modal, purse, mount-host; `dialogue:action`,
 *           `dialogue:closed`.
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
import type { Scene } from "@babylonjs/core/scene";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HORSE_COATS, HORSE_MODEL_TINT, buildRiderView, buildStandingHorse, groundUnder, spawnHorseModel, type HorseInstance } from "../../entities/horse-body";
import { FeedbackKey, ModalKey, PlayerKey, PurseKey, ownSave } from "../services";

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

const STABLE_MASTER = "Ostler";

/** A horse left standing: which, where, facing. */
interface Parked { horseId: string; x: number; y: number; z: number; yaw: number }

/** Where the ridden horse sits under the camera: a rider's eye (1.7 m up, in its stance) over its back (1.6 m), its head (2 m) ahead. */
const RIDE_OFFSET = { x: 0, y: -1.7, z: 0.35 };

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
  private _stableAfterTalk = false;
  private _openStable: () => void = () => {};

  /**
   * Riding: the horse model carries you (its back just under your eyes, its
   * head ahead); until it loads, or if it can't, the shape horse's neck and
   * head ride ahead of the camera.
   */
  private _ride(horseId: string): void {
    this._clearBodies();
    const scene = this._scene, camera = scene?.activeCamera;
    if (!scene || !camera) return;
    const view = buildRiderView(scene, `rider_${horseId}`, HORSE_COATS[horseId] ?? HORSE_COATS.bay_mare);
    view.parent = camera;
    this._riderView = view;
    const token = this._bodyToken;
    void spawnHorseModel(scene, `ridden_${horseId}`, HORSE_MODEL_TINT[horseId]).then((horse) => {
      if (!horse) return;
      if (token !== this._bodyToken || !this._riderView) { horse.dispose(); return; }
      this._riderView.dispose(false, true);
      this._riderView = null;
      this._model = horse;
      this._carry(camera as unknown as Parameters<MountsFeature["_carry"]>[0]);
    });
  }

  /** Off the horse: it stands beside you, facing your way, on the ground. */
  private _standAside(horseId: string, player: { position(): { x: number; y?: number; z: number }; heading?(): number }): void {
    this._clearBodies();
    const scene = this._scene;
    if (!scene) return;
    const p = player.position();
    const yaw = player.heading?.() ?? 0;
    // A pace and a half to your right.
    const x = p.x + Math.cos(yaw) * 2, z = p.z - Math.sin(yaw) * 2;
    const y = groundUnder(scene, x, p.y ?? 2, z) ?? (p.y ?? 2) - 1.8;
    this._standAt(horseId, x, y, z, yaw);
  }

  /** The horse standing at (x, y, z) facing `yaw` (the model replaces the shape horse once loaded). */
  private _standAt(horseId: string, x: number, y: number, z: number, yaw: number): void {
    this._clearBodies();
    const scene = this._scene;
    if (!scene) return;
    this._parked = { horseId, x, y, z, yaw };
    const shape = buildStandingHorse(scene, `horse_${horseId}`, HORSE_COATS[horseId] ?? HORSE_COATS.bay_mare);
    shape.position.set(x, y, z);
    shape.rotation.y = yaw;
    this._standing = shape;
    const token = this._bodyToken;
    void spawnHorseModel(scene, `horse_${horseId}_model`, HORSE_MODEL_TINT[horseId]).then((horse) => {
      if (!horse) return;
      if (token !== this._bodyToken || !this._standing) { horse.dispose(); return; }
      this._standing.dispose(false, true);
      this._standing = null;
      horse.root.position.set(x, y, z);
      horse.root.rotation.y = yaw;
      this._model = horse;
    });
  }

  /** Keep the ridden horse under the rider: their heading (not their gaze up or down), their place. */
  private _carry(camera: { position: { x: number; y: number; z: number }; rotation: { y: number } }): void {
    const horse = this._model;
    if (!horse || !this.horses.isMounted) return;
    const yaw = camera.rotation.y, c = Math.cos(yaw), sn = Math.sin(yaw);
    horse.root.position.set(
      camera.position.x + RIDE_OFFSET.x * c + RIDE_OFFSET.z * sn,
      camera.position.y + RIDE_OFFSET.y,
      camera.position.z - RIDE_OFFSET.x * sn + RIDE_OFFSET.z * c,
    );
    horse.root.rotation.y = yaw;
  }

  private _clearBodies(): void {
    this._bodyToken++;
    this._parked = null;
    this._standing?.dispose(false, true);
    this._riderView?.dispose(false, true);
    this._model?.dispose();
    this._standing = this._riderView = null;
    this._model = null;
  }

  /** Show the ostler's horses (asked for in dialogue). */
  public openStable(): void { this._openStable(); }
  private _wireSaddlebag: ((panel: SaddlebagUI) => void) | null = null;

  /** The horse you left standing (dismounted), and the neck and head you see while riding. */
  private _standing: TransformNode | null = null;
  private _riderView: TransformNode | null = null;
  /** The horse model, when it has loaded (riding or standing). */
  private _model: HorseInstance | null = null;
  /** Where the horse stands, if it does (saved). */
  private _parked: Parked | null = null;
  /** Bumped on every change, so a model that finishes loading late is dropped. */
  private _bodyToken = 0;
  private _bob = 0;

  constructor(private readonly _scene: Scene | null = null) {
    // Starter horses available at world stables.
    this.horses.registerHorse({ id: "bay_mare", name: "Bay Mare", speed: 1.8, saddlebagCapacity: 8, stableId: "starter_stable" });
    this.horses.registerHorse({ id: "black_stallion", name: "Black Stallion", speed: 2.2, saddlebagCapacity: 6, stableId: "starter_stable" });
    this.horses.registerHorse({ id: "grey_gelding", name: "Chestnut Gelding", speed: 2.0, saddlebagCapacity: 10, stableId: "starter_stable" });
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
      // Where a horse was left standing travels with the save too.
      save: () => ({ ...this.horses.getSaveState(), parked: this._parked }),
      load: (data) => {
        if (data) this.horses.restoreFromSave(data as never); // a mounted save re-mounts (onMount sets the speed)
        if (!this.horses.isMounted) s.get(MountHostKey).setMoveSpeedMultiplier(1); // on foot in the save: walk
        this._clearBodies();
        if (this.horses.isMounted) this._ride(this.horses.currentHorse!.id);
        const parked = (data as { parked?: Parked | null } | undefined)?.parked;
        if (!this.horses.isMounted && parked && this.horses.getHorse(parked.horseId)?.isOwned) {
          this._standAt(parked.horseId, parked.x, parked.y, parked.z, parked.yaw);
        }
      },
    });
    const host = () => s.get(MountHostKey);
    const feedback = () => s.get(FeedbackKey);
    const modal = () => s.get(ModalKey);
    const purse = () => s.get(PurseKey);

    this.horses.onMount = (horse, speed) => {
      host().setMoveSpeedMultiplier(speed);
      this._ride(horse.id);
      feedback().notify(`Mounted ${horse.name}`, 1800);
      host().unlockAchievement("ACH_SADDLED");
      feedback().markDirty();
    };
    this.horses.onDismount = (horse) => {
      host().setMoveSpeedMultiplier(1);
      const player = s.tryGet(PlayerKey);
      if (player) this._standAside(horse.id, player);
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
        if (owned.length === 0) feedback().notify("You don't own a horse. The ostler at a village inn sells them.", 2500);
        else this.horses.mountHorse(owned[0].id);
      },
      toggleStableOrSaddlebag: () => {
        // Closing comes first: the open window itself counts as "can't act".
        if (this.saddlebag.isVisible) { this.saddlebag.close(); return; }
        if (this.stable.isVisible) { this.stable.close(); return; }
        if (!host().canAct()) return;
        if (this.horses.isMounted) {
          const horse = this.horses.currentHorse!;
          const bag = this.horses.getSaddlebag(horse.id) ?? [];
          void this.saddlebag.get().then((panel) => {
            panel.open(horse.name, bag.map(toRow), bag.length, horse.saddlebagCapacity);
            modal().suspendGameplay();
          });
          return;
        }
        feedback().notify("To buy a horse, talk to the ostler at a village inn.", 2500);
      },
    });
    ctx.on("dialogue:action", ({ eventId }) => { if (eventId === "stable:open") this._stableAfterTalk = true; });
    ctx.on("dialogue:closed", () => {
      if (!this._stableAfterTalk) return;
      this._stableAfterTalk = false;
      if (!this.stable.isVisible) this.openStable();
    });
    this._openStable = () => {
      const stable = this.horses.getStableNPC(STABLE_MASTER);
      if (!stable) return;
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
    };

    // While riding, the horse's neck nods with your pace.
    let last: { x: number; z: number } | null = null;
    ctx.system({
      id: "mounts.rider", phase: "ui", update: (dt) => {
        const p = s.tryGet(PlayerKey)?.position();
        const moved = p && last ? Math.hypot(p.x - last.x, p.z - last.z) : 0;
        last = p ? { x: p.x, z: p.z } : null;
        // The ridden model walks or runs with your pace (metres a second).
        if (this._model && this.horses.isMounted) {
          const camera = this._scene?.activeCamera as unknown as { position: { x: number; y: number; z: number }; rotation: { y: number } } | null;
          if (camera?.rotation) this._carry(camera);
          const pace = dt > 0 ? moved / dt : 0;
          this._model.play(pace > 6 ? "run" : pace > 0.6 ? "walk" : "stand");
        }
        const view = this._riderView;
        if (!view) return;
        if (moved > 0.01) this._bob += dt * 9;
        view.position.y = Math.sin(this._bob) * 0.035;
        view.rotation.x = Math.sin(this._bob + 0.6) * 0.03;
      },
    });

    ctx.scope.add(() => {
      this._clearBodies();
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
