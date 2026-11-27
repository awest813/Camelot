import { describe, expect, it } from "vitest";
import { mergeStacks } from "./chest";

describe("chest contents", () => {
  it("merge stackable items into one row each; keep the rest apart", () => {
    const gold = { id: "gold_coins", name: "Gold Coins", description: "", stackable: true, quantity: 10, weight: 0.1 };
    const mail = { id: "chainmail", name: "Chainmail Armor", description: "", stackable: false, quantity: 1, weight: 9 };
    const out = mergeStacks([gold, mail, { ...gold, quantity: 25 }, mail]);
    expect(out.map((i) => [i.name, i.quantity])).toEqual([["Gold Coins", 35], ["Chainmail Armor", 1], ["Chainmail Armor", 1]]);
    expect(gold.quantity, "the roll's items are not changed").toBe(10);
  });
});
