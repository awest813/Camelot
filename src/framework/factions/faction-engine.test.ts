import { describe, it, expect } from "vitest";
import { FactionEngine } from "./faction-engine";

describe("FactionEngine", () => {
  it("returns neutral by default and updates disposition with reputation changes", () => {
    const engine = new FactionEngine([
      {
        id: "guard",
        name: "Guard",
        hostileBelow: -20,
        friendlyAt: 20,
        alliedAt: 50,
      },
    ]);

    expect(engine.getDisposition("guard")).toBe("neutral");
    engine.adjustReputation("guard", -50);
    expect(engine.getDisposition("guard")).toBe("hostile");
    engine.setReputation("guard", 22);
    expect(engine.getDisposition("guard")).toBe("friendly");
    engine.setReputation("guard", 70);
    expect(engine.getDisposition("guard")).toBe("allied");
  });

  it("persists and restores faction snapshots", () => {
    const engine = new FactionEngine([{ id: "mages", name: "Mages", defaultReputation: 10 }]);
    engine.adjustReputation("mages", 15);

    const snapshot = engine.getSnapshot();
    const restored = new FactionEngine([{ id: "mages", name: "Mages", defaultReputation: 0 }]);
    restored.restoreSnapshot(snapshot);

    expect(restored.getReputation("mages")).toBe(25);
  });
});
