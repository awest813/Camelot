import { describe, it, expect } from "vitest";
import { Kernel } from "../core/kernel";
import { seedGameRandomness } from "./game-services";
import type { Game } from "../game";

const SYSTEMS = ["combatSystem", "projectileSystem", "scheduleSystem", "weatherSystem", "leveledListSystem",
  "pickpocketSystem", "persuasionSystem", "lootTableSystem", "alchemySystem"] as const;

function fakeGame(seed: string) {
  const game: Record<string, unknown> = { kernel: new Kernel({ seed }) };
  for (const name of SYSTEMS) game[name] = { random: () => Math.random() };
  seedGameRandomness(game as unknown as Game);
  return game as Record<(typeof SYSTEMS)[number], { random(): number }> & { kernel: Kernel };
}
const rolls = (s: { random(): number }) => Array.from({ length: 5 }, () => s.random());

describe("seedGameRandomness", () => {
  it("the same seed gives every gameplay system the same rolls; systems don't share a stream", () => {
    const a = fakeGame("world-1"), b = fakeGame("world-1");
    for (const name of SYSTEMS) expect(rolls(a[name]), name).toEqual(rolls(b[name]));
    expect(rolls(fakeGame("world-1").combatSystem)).not.toEqual(rolls(fakeGame("world-1").weatherSystem));
    expect(rolls(fakeGame("world-1").combatSystem)).not.toEqual(rolls(fakeGame("world-2").combatSystem));
  });

  it("reseeding (a new game or a load) resets the streams in place", () => {
    const g = fakeGame("world-1");
    const first = rolls(g.combatSystem);
    g.kernel.rng.reseed("world-1");
    expect(rolls(g.combatSystem)).toEqual(first);
  });
});
