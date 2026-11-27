import { describe, expect, it } from "vitest";
import { MaxStatLedger, NO_STATS, addStats, maxStatsFromAttributeDeltas, type MaxStats } from "./max-stat-ledger";

describe("MaxStatLedger", () => {
  const body = () => ({ maxHealth: 150, maxMagicka: 120, maxStamina: 130, maxCarryWeight: 300, health: 150, magicka: 120, stamina: 130 });
  const attrs: MaxStats = { maxHealth: 150, maxMagicka: 120, maxStamina: 130, carryWeight: 300 };

  it("adds the omen on top and keeps what others added (perks, gear) across later syncs", () => {
    const b = body();
    let omen = { ...NO_STATS };
    let a = { ...attrs };
    const ledger = new MaxStatLedger(() => addStats(a, omen), b, attrs);
    omen = { ...NO_STATS, maxMagicka: 50 };
    ledger.sync();
    expect(b.maxMagicka).toBe(170);
    b.maxStamina += 25; // a perk
    a = { ...a, maxHealth: 160 }; // a point in endurance
    ledger.sync();
    expect(b).toMatchObject({ maxHealth: 160, maxMagicka: 170, maxStamina: 155 });
  });

  it("a disease lowers the maxima and the current values with them; the cure gives them back", () => {
    const b = body();
    let sick: Record<string, number> = {};
    const ledger = new MaxStatLedger(() => addStats(attrs, maxStatsFromAttributeDeltas(sick)), b, attrs);
    sick = { endurance: -5, strength: -5 };
    ledger.sync();
    expect(b).toMatchObject({ maxHealth: 140, health: 140, maxStamina: 125, maxCarryWeight: 275 });
    sick = {};
    ledger.sync();
    expect(b).toMatchObject({ maxHealth: 150, maxStamina: 130, maxCarryWeight: 300 });
    expect(b.health).toBe(140);
  });

  it("after a load reset the maxima to the attributes', adopt + sync puts the omen back", () => {
    const b = body();
    const omen = { ...NO_STATS, maxMagicka: 50 };
    const ledger = new MaxStatLedger(() => addStats(attrs, omen), b, attrs);
    ledger.sync();
    b.maxMagicka = attrs.maxMagicka; // what the save system's load does
    ledger.adopt(attrs);
    ledger.sync();
    expect(b.maxMagicka).toBe(170);
  });
});
