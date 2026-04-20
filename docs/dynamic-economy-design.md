# Dynamic Economy Design — Agent-Based Market Simulation

This document outlines a design for enhancing Camelot's static `BarterSystem`
with a dynamic, agent-based market simulation inspired by
[economia](https://github.com/Jimimimi/economia) (a JavaScript port of
[bazaarBot](https://github.com/larsiusprime/bazaarBot)).

---

## Current State — Static Pricing

Camelot's `BarterSystem` uses a skill-based pricing model:

```
Buy price  = baseValue × priceMultiplier × barterBuyFactor × rapportFactor
Sell price = baseValue × barterSellFactor × rapportFactor × demandFactor
```

Prices are deterministic for a given player skill level and merchant rapport.
Merchant inventories are static and restocked on a fixed timer via
`MerchantRestockSystem` (every 72 in-game hours).

### Limitations

1. **No supply/demand dynamics** — Flooding a merchant with iron swords
   does not depress the price of iron swords.
2. **No cross-merchant effects** — Buying all health potions from the
   alchemist does not raise prices at the general goods store.
3. **No commodity chains** — Selling ore to a blacksmith does not increase
   the blacksmith's output of weapons.
4. **No regional variation** — A sword costs the same in a remote village
   as in the capital city.

---

## Reference — economia / bazaarBot Algorithm

The economia engine models a free market with autonomous agents.  The core
algorithm (from the paper "Emergent Economies for Role Playing Games" by
Doran & Parberry, LARC-2010-03) works as follows:

### Agents

Each agent has:
- A **role** (farmer, miner, blacksmith, baker, etc.)
- **Needs**: commodities consumed per tick with ideal amounts
- **Produce**: commodities produced per tick
- An internal **inventory** of commodities
- **Belief ranges** about the fair price of each commodity
  (initially wide, narrowed by market observation)

### Market Tick

Each tick, every agent:

1. **Produces** its output commodities.
2. **Consumes** its input commodities (needs).
3. For each commodity where inventory < ideal:
   - Posts a **buy order** at a price sampled from its belief range.
4. For each commodity where inventory > ideal:
   - Posts a **sell order** at a price sampled from its belief range.
5. The market **matches** buy and sell orders:
   - Orders are shuffled randomly.
   - Matching pairs trade at the midpoint of their bid/ask.
   - Unmatched orders expire.
6. Agents **update beliefs** based on outcomes:
   - Successful trades narrow the belief range toward the trade price.
   - Failed buys shift the belief range **up** (willing to pay more).
   - Failed sells shift the belief range **down** (willing to accept less).

### Emergent Behavior

Over many ticks, commodity prices converge to reflect genuine supply and
demand.  If miners stop producing ore, the price of ore rises, which makes
blacksmiths produce fewer tools, which raises the price of tools, which
makes farmers less productive — creating realistic economic cascades.

---

## Proposed Camelot Integration — `DynamicMarketSystem`

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   DynamicMarketSystem                    │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ MarketAgent│  │ MarketAgent│  │ MarketAgent│  ...     │
│  │ (Farmer)   │  │ (Smith)    │  │ (Alchemist)│         │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘         │
│        │               │               │                │
│        └───────────┬────┘───────────────┘                │
│                    ▼                                     │
│            ┌──────────────┐                              │
│            │  OrderBook   │ ← buy/sell matching          │
│            └──────┬───────┘                              │
│                   │ resolved trades                      │
│                   ▼                                      │
│            ┌──────────────┐                              │
│            │ PriceHistory │ ← per-commodity price log    │
│            └──────────────┘                              │
│                                                          │
│  update(gameTimeHours) — advance one market tick         │
│  getMarketPrice(commodityId) → number                   │
│  getPriceHistory(commodityId) → PriceSnapshot[]          │
│  registerAgent(def) / removeAgent(id)                    │
│  getSaveState() / restoreFromSave()                      │
└──────────────────────────────────────────────────────────┘
           │
           │ market price multiplier
           ▼
┌──────────────────────────────────────────────────────────┐
│                     BarterSystem                         │
│                                                          │
│  Buy price  = baseValue × marketMultiplier × ...         │
│  Sell price = baseValue × marketMultiplier × ...         │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Headless and testable** — `DynamicMarketSystem` is a pure-TypeScript
   system with no rendering dependencies, following the same pattern as
   all existing `src/systems/` modules.

2. **Opt-in integration** — The `BarterSystem` reads an optional
   `marketMultiplier` from `DynamicMarketSystem.getMarketPrice()`.
   Without the market system, pricing falls back to the existing static
   formula.

3. **Commodities as item categories** — Map Camelot's item IDs to a small
   set of commodities (ore, ingot, weapon, armor, potion, food, gem,
   leather, cloth, wood) so the market operates on category-level supply
   and demand rather than individual item tracking.

4. **Game-time driven** — Market ticks are tied to `TimeSystem` game hours
   (e.g. one market tick per 6 in-game hours), not real-time.

5. **NPC agents mirror archetypes** — Each `MerchantDef` in `BarterSystem`
   maps to a `MarketAgent` whose role determines production/consumption
   profiles.

### Commodity Definitions

| Commodity | Produced By | Consumed By |
|-----------|-------------|-------------|
| `ore` | Miner | Blacksmith |
| `ingot` | Blacksmith (smelting) | Blacksmith (forging) |
| `weapon` | Blacksmith | Guard, Adventurer |
| `armor` | Blacksmith | Guard, Adventurer |
| `leather` | Hunter | Blacksmith (light armor) |
| `food` | Farmer, Baker | All agents |
| `potion` | Alchemist | Adventurer |
| `ingredient` | Gatherer | Alchemist |
| `gem` | Miner | Enchanter |
| `cloth` | Weaver | Tailor |

### API Sketch

```ts
// src/systems/dynamic-market-system.ts  (conceptual — not yet implemented)

export interface MarketAgentDef {
  id: string;
  role: string;
  needs: Record<string, number>;    // commodityId → ideal qty
  produces: Record<string, number>; // commodityId → qty per tick
}

export interface PriceSnapshot {
  commodityId: string;
  price: number;
  gameTime: number;
}

export class DynamicMarketSystem {
  registerAgent(def: MarketAgentDef): void;
  removeAgent(id: string): void;
  update(gameTimeHours: number): void;
  getMarketPrice(commodityId: string): number;
  getPriceHistory(commodityId: string, limit?: number): PriceSnapshot[];
  getSaveState(): DynamicMarketSaveState;
  restoreFromSave(state: DynamicMarketSaveState): void;
}
```

### Integration with BarterSystem

```ts
// In BarterSystem.getBuyPrice():
const marketMult = this._marketSystem?.getMarketPrice(commodityOf(item)) ?? 1.0;
return Math.max(1, Math.round(baseValue * priceMultiplier * barterFactor * rapportFactor * marketMult));
```

---

## Scope & Phasing

### Phase 1 — Core Market Engine

- Implement `DynamicMarketSystem` with agent registration, order matching,
  and belief-range updating.
- 5–8 commodity types.
- Unit tests for price convergence and supply shock scenarios.

### Phase 2 — BarterSystem Integration

- Wire `getMarketPrice()` into `BarterSystem` buy/sell formulas.
- Map `MerchantDef` roles to `MarketAgentDef` production/consumption.
- Merchant restock quantities adjust based on market conditions.

### Phase 3 — Regional Markets

- Per-region `DynamicMarketSystem` instances (tied to `RegionSystem`).
- Transport cost multiplier for cross-region trade.
- Price arbitrage opportunities for the player.

### Phase 4 — Player Impact & UI

- Player bulk sales depress local prices (visible in barter UI).
- Optional economy HUD showing price trends.
- War/disaster events that disrupt supply chains.

---

## References

- economia (JS bazaarBot port): https://github.com/Jimimimi/economia
- bazaarBot (original): https://github.com/larsiusprime/bazaarBot
- Paper: "Emergent Economies for Role Playing Games" — Doran & Parberry
  (LARC-2010-03): http://larc.unt.edu/techreports/LARC-2010-03.pdf
- Existing `BarterSystem`: `src/systems/barter-system.ts`
- Existing `MerchantRestockSystem`: `src/systems/merchant-restock-system.ts`
