import { describe, expect, it } from "vitest";
import { Kernel } from "../../core/kernel";
import { GameEventBus } from "../../systems/event-bus";
import { SwimmingSystem } from "../../systems/swimming-system";
import { PerkSystem } from "../../systems/perk-system";
import { FeedbackKey } from "../services";
import { NoticesFeature } from "./notices-feature";

function setup() {
  const events = new GameEventBus();
  const k = new Kernel({ events });
  const said: string[] = [];
  let dirty = 0;
  k.services.provide(FeedbackKey, {
    notify: (t: string) => said.push(t), grant: () => {}, addFame: () => {}, markDirty: () => { dirty++; },
  });
  k.install(new NoticesFeature({ disease: (id) => `the ${id}`, merchant: (id) => `Old ${id}`, weather: () => "Light rain" }));
  return { events, said, dirty: () => dirty };
}

describe("notices: what systems report, told to the player", () => {
  it("turns each event into its message", () => {
    const { events, said, dirty } = setup();
    events.emit("swim:entered", {});
    events.emit("swim:breathLow", {});
    events.emit("disease:contracted", { diseaseId: "rattles" });
    events.emit("merchant:restocked", { merchantId: "Bram" });
    events.emit("perk:unlocked", { perkId: "p", perkName: "Keen Eye" });
    events.emit("weather:changed", { state: "rain" });
    events.emit("zone:respawned", { zoneId: "Barrow" });
    expect(said).toEqual([
      "Entered water.", "Running out of breath!", "Contracted the rattles!",
      "Old Bram has restocked their wares.", "Perk unlocked: Keen Eye!", "Weather: Light rain",
      "Barrow has respawned — new dangers await!",
    ]);
    expect(dirty(), "a restock and a perk are worth saving").toBe(2);
  });

  it("a system given the bus reports through it", () => {
    const { events, said } = setup();
    const swim = new SwimmingSystem();
    swim.events = events;
    swim.enterWater();
    expect(said).toEqual(["Entered water."]);
    expect(PerkSystem.prototype).not.toHaveProperty("onPerkUnlocked");
  });
});
