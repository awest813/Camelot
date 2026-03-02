import { describe, it, expect, vi, beforeEach } from "vitest";
import { InteractionSystem } from "./interaction-system";

describe("InteractionSystem", () => {
  let system: InteractionSystem;
  let scene: any;
  let player: any;
  let inventory: any;
  let dialogue: any;
  let ui: any;

  beforeEach(() => {
    scene = {
      onKeyboardObservable: {
        add: vi.fn(),
      },
    };

    player = {
      raycastForward: vi.fn(),
    };

    inventory = {
      isOpen: false,
      toggleInventory: vi.fn(),
      addItem: vi.fn(() => true),
    };

    dialogue = {
      isInDialogue: false,
      startDialogue: vi.fn(),
    };

    ui = {
      setInteractionText: vi.fn(),
      setCrosshairActive: vi.fn(),
      showNotification: vi.fn(),
    };

    system = new InteractionSystem(scene, player, inventory, dialogue, ui);
  });

  it("starts dialogue with non-hostile NPCs", () => {
    const npc = { isAggressive: false, mesh: { name: "Guard" } };
    player.raycastForward.mockReturnValue({
      pickedMesh: { metadata: { type: "npc", npc } },
    });

    system.interact();

    expect(dialogue.startDialogue).toHaveBeenCalledWith(npc);
    expect(ui.showNotification).not.toHaveBeenCalled();
  });

  it("blocks dialogue with hostile NPCs", () => {
    const npc = { isAggressive: true, mesh: { name: "Bandit" } };
    player.raycastForward.mockReturnValue({
      pickedMesh: { metadata: { type: "npc", npc } },
    });

    system.interact();

    expect(dialogue.startDialogue).not.toHaveBeenCalled();
    expect(ui.showNotification).toHaveBeenCalledWith("Bandit is hostile!", 1500);
  });

  it("shows hostile prompt when aiming at an aggressive NPC", () => {
    const npc = { isAggressive: true, mesh: { name: "Bandit" } };
    player.raycastForward.mockReturnValue({
      pickedMesh: { metadata: { type: "npc", npc } },
    });

    // InteractionSystem raycasts every 3rd update call.
    system.update();
    system.update();
    system.update();

    expect(ui.setInteractionText).toHaveBeenCalledWith("Bandit is hostile");
    expect(ui.setCrosshairActive).toHaveBeenCalledWith(true);
  });
});
