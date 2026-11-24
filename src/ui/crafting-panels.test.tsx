import { describe, it, expect, vi, afterEach } from "vitest";
import { AlchemySystem, DEFAULT_INGREDIENTS } from "../systems/alchemy-system";
import { EnchantingSystem } from "../systems/enchanting-system";
import { AlchemyUI } from "./alchemy-ui";
import { EnchantingUI } from "./enchanting-ui";

const ui = { showNotification: vi.fn() } as never;
const rows = (label: string) => Array.from(document.querySelectorAll<HTMLButtonElement>(`section[aria-label="${label}"] button.craft-panel__row`));
const button = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === text)!;
const status = () => document.querySelector(".craft-panel__status")!.textContent;

afterEach(() => { document.body.innerHTML = ""; });

describe("AlchemyUI (Preact)", () => {
  it("opens with the satchel, selects ingredients (up to four), crafts, and closes", () => {
    const system = new AlchemySystem({} as never, ui);
    for (const def of DEFAULT_INGREDIENTS.slice(0, 5)) system.addIngredient(def.id, 2);
    const panel = new AlchemyUI(system);
    const crafted: string[][] = [];
    panel.onCraft = (ids) => crafted.push(ids);
    const closed = vi.fn();
    panel.onClosed = closed;

    panel.toggle(true);
    expect(document.querySelector("[role=dialog]")?.getAttribute("aria-labelledby")).toBe("alchemy-title");
    expect(rows("Ingredients")).toHaveLength(5);
    expect(status()).toMatch(/Select 2–4/);
    expect(button("Craft Potion").disabled).toBe(true);

    rows("Ingredients")[0].click();
    expect(status()).toMatch(/need at least 2/);
    for (const i of [1, 2, 3, 4]) rows("Ingredients")[i].click();
    expect(rows("Ingredients").filter((r) => r.getAttribute("aria-pressed") === "true"), "four at most").toHaveLength(4);
    button("Craft Potion").click();
    expect(crafted).toEqual([DEFAULT_INGREDIENTS.slice(0, 4).map((d) => d.id)]);
    expect(rows("Ingredients").some((r) => r.getAttribute("aria-pressed") === "true"), "selection cleared").toBe(false);

    (document.querySelector(".graphics-settings__close") as HTMLButtonElement).click();
    expect(panel.isVisible).toBe(false);
    expect(closed).toHaveBeenCalledOnce();
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });
});

describe("EnchantingUI (Preact)", () => {
  it("needs an item, an effect and a gem; the effects follow the item's kind; enchanting reports all three", () => {
    const inventory = { items: [
      { id: "sword", name: "Iron Sword", description: "", stackable: false, quantity: 1, slot: "mainHand", stats: {} },
      { id: "helm", name: "Iron Helm", description: "", stackable: false, quantity: 1, slot: "head", stats: {} },
    ] };
    const system = new EnchantingSystem({} as never, inventory as never, {} as never, ui);
    system.addSoulGem("petty", 2);
    const panel = new EnchantingUI(system);
    const done: string[][] = [];
    panel.onEnchant = (i, e, g) => done.push([i, e, g]);
    panel.toggle(true);

    expect(status()).toBe("Select an: item, effect, soul gem");
    const allEffects = rows("Effects").length;
    rows("Items")[0].click();
    expect(rows("Effects").length, "only what a weapon can take").toBeLessThan(allEffects);
    rows("Effects")[0].click();
    expect(status()).toBe("Select a: soul gem");
    expect(button("Enchant").disabled).toBe(true);
    rows("Soul gems")[0].click();
    expect(status()).toMatch(/Iron Sword — .* \+\d+$/);
    button("Enchant").click();
    expect(done).toHaveLength(1);
    expect(done[0][0]).toBe("sword");
    expect(done[0][2]).toBe("petty");
    expect(status(), "starts over").toBe("Select an: item, effect, soul gem");
  });
});
