/**
 * Trade as a kernel feature: buying and selling with a merchant (opened by
 * their "let me see your wares" once the conversation ends), and taking
 * from containers.
 *
 * Prices follow reputation: fame shifts them, and the merchant's own
 * disposition refines that (friends give discounts; enemies gouge).
 *
 * The barter window loads the first time it opens.
 *
 * Taking from a chest with an owner is theft (the law service records it,
 * if anyone sees).
 *
 * Inputs:   services trade-host, purse, feedback, modal, law; events
 *           `dialogue:action` ("barter:open"), `dialogue:closed`.
 * Outputs:  the `trade` service; event `container:emptied`.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import type { BarterUI } from "../../ui/barter-ui";
import { LazyPanel } from "../../ui/lazy-panel";
import { ContainerUI } from "../../ui/container-ui";
import type { BarterSystem } from "../../systems/barter-system";
import type { ShopSystem } from "../../systems/shop-system";
import type { ContainerSystem } from "../../systems/container-system";
import type { Item } from "../../systems/inventory-system";
import { FeedbackKey, LawKey, ModalKey, PurseKey, declareStateless } from "../services";

const DEFAULT_MERCHANT = "merchant_01";

export interface TradeHostService {
  readonly barter: BarterSystem;
  readonly shops: ShopSystem;
  readonly containers: ContainerSystem;
  /** The player's pack, for the sell column. */
  items(): readonly Item[];
  hour(): number;
  /** Price factor from fame, and from `npcName`'s disposition when known. */
  reputationFactor(npcName: string | null): number;
}

export interface TradeService {
  /** The barter window (loaded on first use). */
  readonly barterPanel: LazyPanel<BarterUI>;
  readonly containerPanel: ContainerUI;
  closeBarter(): void;
  closeContainer(): void;
}

/** A short tag after an item's name in the barter rows (e.g. its condition), or null. */
export type ItemTag = (item: Item) => string | null;

export const TradeHostKey = createServiceKey<TradeHostService>("trade-host");
export const TradeKey = createServiceKey<TradeService>("trade");

export class TradeFeature implements Feature {
  public readonly id = "trade";
  /** The barter window: its code loads the first time a merchant opens it. */
  public readonly barterPanel = new LazyPanel<BarterUI>(async () => {
    const { BarterUI } = await import("../../ui/barter-ui");
    const ui = new BarterUI();
    ui.itemTag = this._itemTag;
    this._wireBarter?.(ui);
    return ui;
  });
  private _wireBarter: ((ui: BarterUI) => void) | null = null;
  private _itemTag: ItemTag | null = null;
  public readonly containerPanel = new ContainerUI();
  private _pending: { merchantId: string; npcName: string | null } | null = null;
  private _s: ServiceRegistry | null = null;

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "merchant stock and gold belong to the barter and restock systems, which the save system saves");
    const s = ctx.kernel.services;
    this._s = s;
    const host = () => s.get(TradeHostKey);
    const dirty = () => s.get(FeedbackKey).markDirty();

    const trade = (sell: boolean) => (itemId: string, instanceId?: string) => {
      const h = host();
      const mid = h.barter.activeMerchantId;
      if (!mid) return;
      if (sell) h.barter.sellItem(mid, itemId, instanceId);
      else h.barter.buyItem(mid, itemId, instanceId);
      this.barterPanel.current?.update(h.barter, h.items());
      dirty();
    };
    this._wireBarter = (ui) => {
      ui.onBuy = trade(false);
      ui.onSell = trade(true);
      ui.onClose = () => this._closeBarter();
    };

    const containers = host().containers;
    // Taking from someone's chest is theft: reported once per opening (the
    // crime system counts it only if someone sees).
    let reported: string | null = null;
    const theft = () => {
      const active = containers.activeContainer;
      if (!active?.owner || reported === active.id) return;
      reported = active.id;
      const law = s.tryGet(LawKey);
      law?.crime.commitCrime("theft", active.owner, law.now());
    };
    containers.onContainerOpen = () => {
      reported = null;
      this.containerPanel.show();
      this.containerPanel.update(containers);
      s.get(ModalKey).suspendGameplay();
    };
    this.containerPanel.onTakeItem = (itemId) => {
      const active = containers.activeContainer;
      if (!active) return;
      if (containers.takeItem(active.id, itemId)) { theft(); dirty(); }
      this.containerPanel.update(containers);
      if (containers.activeContainer?.contents.length === 0) {
        ctx.kernel.events.emit("container:emptied", { id: active.id });
        this._closeContainer();
      }
    };
    this.containerPanel.onTakeAll = () => {
      const active = containers.activeContainer;
      if (active) { theft(); containers.takeAll(active.id); }
      if (active && active.contents.length === 0) ctx.kernel.events.emit("container:emptied", { id: active.id });
      dirty();
      this._closeContainer();
    };
    this.containerPanel.onClose = () => this._closeContainer();

    ctx.on("dialogue:action", ({ eventId, npcName, payload }) => {
      if (eventId !== "barter:open") return;
      if (this.barterPanel.isVisible) this._closeBarter();
      const merchantId = typeof payload?.merchantId === "string" ? payload.merchantId : DEFAULT_MERCHANT;
      this._pending = { merchantId, npcName };
    });
    ctx.on("dialogue:closed", () => this._openPending());

    ctx.provide(TradeKey, {
      barterPanel: this.barterPanel,
      containerPanel: this.containerPanel,
      closeBarter: () => this._closeBarter(),
      closeContainer: () => this._closeContainer(),
    });

    ctx.scope.add(() => {
      containers.onContainerOpen = null;
      const ui = this.barterPanel.current;
      if (ui) { ui.hide(); ui.onBuy = ui.onSell = ui.onClose = null; }
      this._wireBarter = null;
      this.containerPanel.onTakeItem = this.containerPanel.onClose = null;
      this.containerPanel.onTakeAll = null;
      this._s = null;
    });
  }

  private _openPending(): void {
    const pending = this._pending, s = this._s;
    this._pending = null;
    if (!pending || !s) return;
    const h = s.get(TradeHostKey);
    const hour = h.hour();
    const shop = h.shops.getShopByMerchantId(pending.merchantId);
    if (shop && !h.shops.isOpen(shop.id, hour)) {
      s.get(FeedbackKey).notify(`${shop.name} is closed right now.`, 2600);
      return;
    }
    if (!h.barter.openBarter(pending.merchantId, hour)) return;
    h.barter.sessionBuyPriceFactor = Math.min(1.5, Math.max(0.7, h.reputationFactor(pending.npcName)));
    h.barter.playerGold = s.get(PurseKey).gold();
    s.get(ModalKey).suspendGameplay();
    this._opening = true;
    void this.barterPanel.get().then((ui) => {
      this._opening = false;
      // Closed (or the feature removed) while the window loaded: don't open it.
      if (!this._s || !h.barter.activeMerchantId) return;
      ui.show();
      ui.update(h.barter, h.items());
    });
  }

  /** Condition tags and the like after item names in the barter rows. */
  public setItemTag(tag: ItemTag | null): void {
    this._itemTag = tag;
    const ui = this.barterPanel.current;
    if (ui) ui.itemTag = tag;
  }

  /** The barter window is open, or loading to open. */
  public get barterOpen(): boolean {
    return this.barterPanel.isVisible || this._opening;
  }
  private _opening = false;

  /** Close the barter window (Escape, a fall, a modal taking over). */
  public closeBarter(): void {
    if (this.barterOpen) this._closeBarter();
  }

  private _closeBarter(): void {
    this._opening = false;
    this.barterPanel.current?.hide();
    this._s?.get(TradeHostKey).barter.closeBarter();
    this._s?.get(ModalKey).restoreGameplay();
  }

  private _closeContainer(): void {
    this.containerPanel.hide();
    this._s?.get(TradeHostKey).containers.closeContainer();
    this._s?.get(ModalKey).restoreGameplay();
  }
}
