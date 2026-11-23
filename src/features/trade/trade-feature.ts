/**
 * Trade as a kernel feature: buying and selling with a merchant (opened by
 * their "let me see your wares" once the conversation ends), and taking
 * from containers.
 *
 * Prices follow reputation: fame shifts them, and the merchant's own
 * disposition refines that (friends give discounts; enemies gouge).
 *
 * Inputs:   services trade-host, purse, feedback, modal; events
 *           `dialogue:action` ("barter:open"), `dialogue:closed`.
 * Outputs:  the `trade` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { BarterUI } from "../../ui/barter-ui";
import { ContainerUI } from "../../ui/container-ui";
import type { BarterSystem } from "../../systems/barter-system";
import type { ShopSystem } from "../../systems/shop-system";
import type { ContainerSystem } from "../../systems/container-system";
import type { Item } from "../../systems/inventory-system";
import { FeedbackKey, ModalKey, PurseKey } from "../services";

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
  readonly barterPanel: BarterUI;
  readonly containerPanel: ContainerUI;
  closeBarter(): void;
  closeContainer(): void;
}

export const TradeHostKey = createServiceKey<TradeHostService>("trade-host");
export const TradeKey = createServiceKey<TradeService>("trade");

export class TradeFeature implements Feature {
  public readonly id = "trade";
  public readonly barterPanel = new BarterUI();
  public readonly containerPanel = new ContainerUI();
  private _pending: { merchantId: string; npcName: string | null } | null = null;
  private _s: ServiceRegistry | null = null;

  public install(ctx: FeatureContext): void {
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
      this.barterPanel.update(h.barter, h.items());
      dirty();
    };
    this.barterPanel.onBuy = trade(false);
    this.barterPanel.onSell = trade(true);
    this.barterPanel.onClose = () => this._closeBarter();

    const containers = host().containers;
    containers.onContainerOpen = () => {
      this.containerPanel.show();
      this.containerPanel.update(containers);
      s.get(ModalKey).suspendGameplay();
    };
    this.containerPanel.onTakeItem = (itemId) => {
      const active = containers.activeContainer;
      if (!active) return;
      if (containers.takeItem(active.id, itemId)) dirty();
      this.containerPanel.update(containers);
      if (containers.activeContainer?.contents.length === 0) this._closeContainer();
    };
    this.containerPanel.onTakeAll = () => {
      const active = containers.activeContainer;
      if (active) containers.takeAll(active.id);
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
      this.barterPanel.onBuy = this.barterPanel.onSell = this.barterPanel.onClose = null;
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
    this.barterPanel.show();
    this.barterPanel.update(h.barter, h.items());
    s.get(ModalKey).suspendGameplay();
  }

  private _closeBarter(): void {
    this.barterPanel.hide();
    this._s?.get(TradeHostKey).barter.closeBarter();
    this._s?.get(ModalKey).restoreGameplay();
  }

  private _closeContainer(): void {
    this.containerPanel.hide();
    this._s?.get(TradeHostKey).containers.closeContainer();
    this._s?.get(ModalKey).restoreGameplay();
  }
}
