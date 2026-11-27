import { describe, expect, it, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, SavesKey } from "../services";
import type { SaveCodec } from "../../systems/save-system";
import type { Item } from "../../systems/inventory-system";
import { ProvisionsFeature } from "./provisions-feature";

function setup() {
  const k = new Kernel();
  const codecs: SaveCodec[] = [];
  const notes: string[] = [];
  k.services.provide(SavesKey, { register: (c) => { codecs.push(c); return () => {}; } });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  let absorber: ((item: Item) => string | null) | null = null;
  const known = new Set(["kindle"]);
  const satchel = new Map<string, number>();
  const vessels = new Map<string, number>();
  const quiver = { arrowCount: 20, addArrows(n: number) { this.arrowCount += n; } };
  const diseases = { hasDiseases: true, cureAllDiseases: vi.fn(() => { diseases.hasDiseases = false; }) };
  const f = new ProvisionsFeature({
    inventory: { addAbsorber: (fn) => { absorber = fn; } },
    quiver,
    spells: {
      getDefinitions: () => [{ id: "kindle", name: "Kindle" }, { id: "rime", name: "Rime" }, { id: "fade", name: "Fade" }],
      learnSpell: (id) => { known.add(id); return true; },
      knowsSpell: (id) => known.has(id),
    },
    alchemy: {
      getIngredientDef: (id) => (id === "vervain" ? { name: "Vervain" } : undefined),
      addIngredient: (id, n) => { satchel.set(id, (satchel.get(id) ?? 0) + n); return true; },
    },
    enchanting: { addVessel: (t, n) => { vessels.set(t, (vessels.get(t) ?? 0) + n); } },
    diseases,
  });
  k.install(f);
  const give = (id: string, quantity = 1) => absorber!({ id, name: id, description: "", stackable: true, quantity });
  return { k, give, quiver, satchel, vessels, known, diseases, notes, codec: () => codecs.find((c) => c.key === "provisions")! };
}

describe("ProvisionsFeature", () => {
  it("arrow bundles fill the quiver, 20 apiece", () => {
    const t = setup();
    expect(t.give("arrow_bundle", 2)).toMatch(/\+40 arrows/);
    expect(t.quiver.arrowCount).toBe(60);
  });

  it("herbs go to the satchel and vessels to the altar; other items stay in the pack", () => {
    const t = setup();
    expect(t.give("vervain", 3)).toMatch(/Vervain/);
    expect(t.satchel.get("vervain")).toBe(3);
    expect(t.give("vessel_grail")).toMatch(/grail/);
    expect(t.vessels.get("grail")).toBe(1);
    expect(t.give("vessel_tin")).toBeNull();
    expect(t.give("iron_sword")).toBeNull();
  });

  it("a named tome teaches its spell once; a known one stays a book to sell", () => {
    const t = setup();
    expect(t.give("tome_rime")).toMatch(/learn Rime/);
    expect(t.known.has("rime")).toBe(true);
    expect(t.give("tome_rime")).toBeNull();
    expect(t.give("tome_kindle")).toBeNull();
  });

  it("a plain spell tome teaches a spell not yet known, until none are left", () => {
    const t = setup();
    expect(t.give("spell_tome")).toMatch(/learn (Rime|Fade)/);
    expect(t.give("spell_tome")).toMatch(/learn (Rime|Fade)/);
    expect([...t.known].sort()).toEqual(["fade", "kindle", "rime"]);
    expect(t.give("spell_tome")).toBeNull();
  });

  it("drinking a cure clears diseases", () => {
    const t = setup();
    const item = { id: "potion_cure", name: "Cure Disease", description: "", stackable: true, quantity: 1, stats: { cure: 1 } };
    t.k.events.emit("item:consumed", { item, source: "inventory" });
    expect(t.diseases.cureAllDiseases).toHaveBeenCalledOnce();
    expect(t.notes.at(-1)).toMatch(/sickness leaves/);
  });

  it("saves the quiver", () => {
    const t = setup();
    t.give("arrow_bundle");
    const saved = t.codec().save();
    const u = setup();
    u.codec().load(saved);
    expect(u.quiver.arrowCount).toBe(40);
  });
});
