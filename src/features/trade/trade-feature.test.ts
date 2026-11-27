import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, ModalKey, PurseKey } from "../services";
import { TradeFeature, TradeHostKey, TradeKey, type TradeHostService } from "./trade-feature";

function setup(opts: { open?: boolean } = {}) {
  const k = new Kernel();
  const notes: string[] = [];
  const barter = {
    activeMerchantId: null as string | null,
    sessionBuyPriceFactor: 1,
    playerGold: 0,
    openBarter: vi.fn((id: string) => { barter.activeMerchantId = id; return true; }),
    closeBarter: vi.fn(() => { barter.activeMerchantId = null; }),
    buyItem: vi.fn(), sellItem: vi.fn(),
    getMerchant: () => ({ inventory: [], gold: 100, name: "Trader" }),
    getBuyPrice: () => 1, getSellPrice: () => 1,
  };
  const shops = {
    getShopByMerchantId: () => ({ id: "shop", name: "Trader's Stall" }),
    isOpen: () => opts.open ?? true,
  };
  const containers = {
    onContainerOpen: null as null | (() => void),
    activeContainer: { id: "chest", contents: [{ id: "gold" }, { id: "sword" }] } as null | { id: string; contents: Array<{ id: string }> },
    takeItem: vi.fn((_c: string, id: string) => { containers.activeContainer!.contents = containers.activeContainer!.contents.filter((i) => i.id !== id); return true; }),
    takeAll: vi.fn(), closeContainer: vi.fn(),
  };
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(TradeHostKey, {
    barter, shops, containers, items: () => [], hour: () => 12, reputationFactor: (n) => (n === "Friend" ? 0.5 : 1.2),
  } as unknown as TradeHostService);
  k.services.provide(PurseKey, { gold: () => 77, spend: () => true });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, modal);
  const f = new TradeFeature();
  k.install(f);
  const talk = (npcName: string | null, merchantId?: string) => {
    k.events.emit("dialogue:action", { eventId: "barter:open", npcName, payload: merchantId ? { merchantId } : undefined });
    k.events.emit("dialogue:closed", {});
  };
  return { k, f, notes, barter, containers, modal, talk, svc: k.services.get(TradeKey) };
}

describe("TradeFeature (headless, through the kernel)", () => {
  it("a merchant's wares open once the talk ends (loading the window), priced by reputation", async () => {
    const t = setup();
    t.f.setItemTag(() => "90%");
    t.talk("Friend", "merchant_weapons_01");
    expect(t.barter.openBarter).toHaveBeenCalledWith("merchant_weapons_01", 12);
    expect(t.barter.sessionBuyPriceFactor, "clamped to 0.7").toBe(0.7);
    expect(t.barter.playerGold).toBe(77);
    expect(t.f.barterOpen, "open while the window loads").toBe(true);
    const ui = await t.svc.barterPanel.get();
    expect(t.svc.barterPanel.isVisible).toBe(true);
    expect(ui.itemTag?.({} as never), "the item tag set before it loaded").toBe("90%");
    ui.onBuy!("sword");
    expect(t.barter.buyItem).toHaveBeenCalledWith("merchant_weapons_01", "sword", undefined);
    t.svc.closeBarter();
    expect(t.barter.closeBarter).toHaveBeenCalled();
    expect(t.modal.restoreGameplay).toHaveBeenCalled();
    t.k.uninstall("trade");
  });

  it("a closed shop says so; no merchant named means the default one", () => {
    const t = setup({ open: false });
    t.talk(null);
    expect(t.notes.at(-1)).toBe("Trader's Stall is closed right now.");
    expect(t.barter.openBarter).not.toHaveBeenCalled();
    t.k.uninstall("trade");
  });

  it("only a barter action opens the shop", () => {
    const t = setup();
    t.k.events.emit("dialogue:closed", {});
    expect(t.barter.openBarter).not.toHaveBeenCalled();
    t.k.uninstall("trade");
  });

  it("a container closes once it is emptied, and says so (a site's chest stays empty a while)", () => {
    const t = setup();
    const emptied: string[] = [];
    t.k.events.on("container:emptied", ({ id }) => emptied.push(id));
    t.containers.onContainerOpen!();
    expect(t.svc.containerPanel.isVisible).toBe(true);
    t.svc.containerPanel.onTakeItem!("gold");
    expect(t.svc.containerPanel.isVisible).toBe(true);
    t.svc.containerPanel.onTakeItem!("sword");
    expect(t.svc.containerPanel.isVisible).toBe(false);
    expect(t.containers.closeContainer).toHaveBeenCalled();
    expect(emptied).toEqual(["chest"]);
    t.k.uninstall("trade");
  });
});
