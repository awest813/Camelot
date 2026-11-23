import { describe, it, expect, vi } from "vitest";
import { GameEventBus } from "../systems/event-bus";
import type { NPC } from "../entities/npc";
import { NpcRoster } from "./npc-roster";

function setup() {
  const schedule = { addNPC: vi.fn(), removeNPC: vi.fn() };
  const combat = { removeNPC: vi.fn() }, stealth = { removeNPC: vi.fn() };
  const lod = { register: vi.fn(), unregister: vi.fn() };
  const pockets = { registerNpc: vi.fn(), forget: vi.fn() };
  const scale = vi.fn();
  const events = new GameEventBus();
  const released: string[] = [];
  events.on("npc:released", ({ npcName }) => released.push(npcName));
  const roster = new NpcRoster({
    schedule: () => schedule, trackers: () => [combat, stealth], lod: () => lod, scale, pockets: () => pockets, events: () => events,
  });
  const npc = { mesh: { name: "Guard_1", dispose: vi.fn() } } as unknown as NPC;
  return { roster, npc, schedule, combat, stealth, lod, pockets, scale, released };
}

describe("NpcRoster", () => {
  it("adds an NPC to every system it needs", () => {
    const t = setup();
    t.roster.add(t.npc, { regional: true });
    expect(t.schedule.addNPC).toHaveBeenCalledWith(t.npc);
    expect(t.scale).toHaveBeenCalledWith(t.npc, true);
    expect(t.lod.register).toHaveBeenCalledWith(t.npc.mesh, 120);
    expect(t.pockets.registerNpc).toHaveBeenCalledWith(t.npc);
  });

  it("a dragon is neither culled nor pickpocketed", () => {
    const t = setup();
    t.roster.add(t.npc, { regional: true, cull: false, pockets: false });
    expect(t.lod.register).not.toHaveBeenCalled();
    expect(t.pockets.registerNpc).not.toHaveBeenCalled();
  });

  it("removal clears every list, its pockets, tells features, and disposes unless told not to", () => {
    const t = setup();
    t.roster.remove(t.npc, { dispose: false });
    for (const sys of [t.schedule, t.combat, t.stealth]) expect(sys.removeNPC).toHaveBeenCalledWith(t.npc);
    expect(t.lod.unregister).toHaveBeenCalledWith(t.npc.mesh);
    expect(t.pockets.forget).toHaveBeenCalledWith("Guard_1");
    expect(t.released).toEqual(["Guard_1"]);
    expect(t.npc.mesh.dispose).not.toHaveBeenCalled();
    t.roster.remove(t.npc);
    expect(t.npc.mesh.dispose).toHaveBeenCalledOnce();
  });
});
