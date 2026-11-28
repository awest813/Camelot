import { describe, it, expect, vi, afterEach } from "vitest";
import { WaitDialogPanel } from "./wait-dialog";
import { AttributePanelView } from "./attribute-panel";
import { QuestLogView } from "./quest-log-panel";
import { AttributeSystem } from "../systems/attribute-system";
import type { Quest } from "../systems/quest-system";

const byText = (t: string) => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === t)!;
const byLabel = (t: string) => document.querySelector<HTMLElement>(`[aria-label="${t}"]`)!;
afterEach(() => { document.body.innerHTML = ""; });

describe("WaitDialogPanel", () => {
  it("picks 1–24 hours (buttons, arrow keys, slider), waits or cancels, and remembers the choice", () => {
    const panel = new WaitDialogPanel();
    const waited: number[] = [];
    const cancel = vi.fn();
    panel.open({ onWait: (h) => waited.push(h), onCancel: cancel });
    expect(document.querySelector("output")!.textContent).toBe("8 h");
    byLabel("Increase wait time").click();
    byLabel("Increase wait time").click();
    expect(document.querySelector("output")!.textContent).toBe("10 h");
    const selector = document.querySelector(".wait-dialog__selector")!;
    selector.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(panel.hours).toBe(9);
    const range = byLabel("Hours to wait") as HTMLInputElement;
    range.value = "30";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    expect(panel.hours, "clamped").toBe(24);
    expect((byLabel("Increase wait time") as HTMLButtonElement).disabled).toBe(true);
    byText("Wait").click();
    expect(waited).toEqual([24]);
    byText("Cancel").click();
    expect(cancel).toHaveBeenCalledOnce();
    panel.close();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    panel.open({ onWait: () => {}, onCancel: () => {} });
    expect(document.querySelector("output")!.textContent, "remembered").toBe("24 h");
  });
});

describe("AttributePanelView", () => {
  it("lists every attribute with its effect; +1 spends only while points wait", () => {
    const attrs = new AttributeSystem();
    const spent: string[] = [];
    const view = new AttributePanelView();
    view.open({ onSpend: (n) => spent.push(n), onClose: () => {} });
    view.refresh(attrs);
    const rows = document.querySelectorAll(".attribute-panel__table tr");
    expect(rows).toHaveLength(7);
    expect(rows[0].textContent).toMatch(/Strength.*Dmg \+/);
    expect((byLabel("Need points to increase Strength") as HTMLButtonElement).disabled).toBe(true);
    (attrs as unknown as { pendingPoints: number }).pendingPoints = 2;
    view.refresh(attrs);
    expect(document.querySelector(".craft-panel__subtitle")!.textContent).toBe("Points available: 2");
    byLabel("Increase Luck").click();
    expect(spent).toEqual(["luck"]);
  });
});

describe("QuestLogView", () => {
  const quest = (id: string, extra: Partial<Quest>): Quest => ({
    id, name: id, description: "", isActive: true, isCompleted: false,
    objectives: [{ id: `${id}.o`, type: "kill", description: `Do ${id}`, targetId: "x", required: 2, current: 1, completed: false }],
    ...extra,
  });

  it("lists active, then failed, then completed quests with objectives and rewards; ✕ reports the close", () => {
    const close = vi.fn();
    const view = new QuestLogView();
    view.update([quest("Done", { isCompleted: true, isActive: false }), quest("Failed", { isFailed: true, isActive: false }), quest("Now", { reward: "50 gold" })]);
    view.open(close);
    const names = Array.from(document.querySelectorAll(".quest-log__name")).map((n) => n.textContent);
    expect(names).toEqual(["◆ Now", "✕ Failed (failed)", "✓ Done (completed)"]);
    expect(document.querySelector(".quest-log__objectives")!.textContent).toBe("○ Do Now (1/2)");
    expect(document.querySelector(".quest-log__reward")!.textContent).toBe("Reward: 50 gold");
    view.update([]);
    expect(document.querySelector(".craft-panel__empty")!.textContent).toBe("No quests yet.");
    (document.querySelector(".graphics-settings__close") as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("SkillTreeView", () => {
  it("shows ranks and the right action per skill: upgrade, locked, need points, mastered", async () => {
    const { SkillTreeView } = await import("./skill-tree-panel");
    const skill = (id: string, rank: number, max: number) => ({ id, name: id, description: `${id} desc`, currentRank: rank, maxRank: max, effect: () => {} });
    const trees = [{ name: "Combat", skills: [skill("Blade", 1, 3), skill("Riposte", 0, 1), skill("Mastery", 2, 2)] }];
    const bought: number[][] = [];
    const view = new SkillTreeView();
    view.open({ onBuy: (t, s) => bought.push([t, s]), onClose: () => {} });
    view.refresh({ trees, skillPoints: 1, prereqMet: (_t, s) => s !== 1 });
    const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".skill-tree__skill button")).map((b) => [b.textContent, b.disabled]);
    expect(buttons()).toEqual([["Upgrade", false], ["🔒 Locked", true], ["✦ Mastered", true]]);
    expect(document.querySelector(".skill-tree__rank")!.textContent).toBe("★☆☆  (1/3)");
    byLabel("Upgrade Blade").click();
    expect(bought).toEqual([[0, 0]]);
    view.refresh({ trees, skillPoints: 0, prereqMet: () => true });
    expect(buttons()[0]).toEqual(["Need Points", true]);
    expect(document.querySelector(".craft-panel__subtitle")!.textContent).toBe("Skill Points: 0");
  });
});

describe("InventoryPanelView", () => {
  it("shows twenty slots, describes the hovered item, clicks only usable ones, and takes off worn gear", async () => {
    const { InventoryPanelView } = await import("./inventory-panel");
    const items = [
      { id: "sword", name: "Iron Sword", description: "Sharp.", stackable: false, quantity: 1, slot: "mainHand" },
      { id: "potion", name: "Potion", description: "Heals.", stackable: true, quantity: 3 },
      { id: "rock", name: "Rock", description: "A rock.", stackable: true, quantity: 1 },
    ] as never[];
    const clicked: string[] = [];
    const wornSword = { id: "sword", name: "Iron Sword", description: "", stackable: false, quantity: 1, slot: "mainHand" } as never;
    const view = new InventoryPanelView(() => ({
      items, equippedIds: new Set(["sword"]), stats: [{ label: "Health", value: "10 / 10", fill: 1, kind: "health" }], equipment: ["Main Hand: Iron Sword", "Head: --"],
      worn: [wornSword, null],
      isConsumable: (i) => (i as { id: string }).id === "potion", detail: () => "",
    }));
    view.open({ onItem: (i) => clicked.push((i as { id: string }).id), onClose: () => {} });
    expect(document.querySelectorAll(".inventory__grid li")).toHaveLength(20);
    const slots = Array.from(document.querySelectorAll<HTMLButtonElement>("button.inventory__slot"));
    expect(slots.map((b) => b.querySelector(".inventory__name")?.textContent)).toEqual(["Iron Sword", "Potion", "Rock"]);
    expect(slots.map((b) => b.querySelector(".inventory__qty")?.textContent ?? null)).toEqual([null, "3", null]);
    expect(slots[0].classList.contains("is-equipped"), "a bag copy isn't the worn one").toBe(false);
    slots[0].dispatchEvent(new FocusEvent("focus"));
    await Promise.resolve();
    slots[0].focus();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector(".inventory__hint")?.textContent).toBe("[Click to Equip]");
    for (const b of slots) b.click();
    expect(clicked, "the rock does nothing").toEqual(["sword", "potion"]);
    expect(document.querySelector(".inventory__stat--health dd")!.textContent).toBe("10 / 10");
    expect(document.querySelector<HTMLElement>(".inventory__stat--health .inventory__stat-bar > span")!.style.width).toBe("100%");
    const equip = Array.from(document.querySelectorAll(".inventory__equip")).map((e) => [e.querySelector("dt")!.textContent, e.querySelector("dd")!.textContent, e.classList.contains("is-empty")]);
    expect(equip).toEqual([["Main Hand", "Iron Sword", false], ["Head", "—", true]]);
    clicked.length = 0;
    document.querySelector<HTMLButtonElement>(".inventory__unequip")!.click();
    expect(clicked, "the worn sword, from the Equipped list").toEqual(["sword"]);
    expect(view.isOpen).toBe(true);
    view.close();
    expect(view.isOpen).toBe(false);
  });
});
