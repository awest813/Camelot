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
    system.cellManager = {
      isTransitioning: false,
      tryTransition: vi.fn(() => true),
      portals: new Map([["p1", {}]]),
    } as any;
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

  it("calls tryTransition when interacting with a portal", () => {
    const tryTransition = vi.fn(() => true);
    system.cellManager = {
      isTransitioning: false,
      tryTransition,
      portals: new Map([["door1", {}]]),
    } as any;
    const portal = { id: "door1", labelText: "Enter" };
    player.raycastForward.mockReturnValue({
      pickedMesh: { metadata: { type: "portal", portal } },
    });
    system.interact();
    expect(tryTransition).toHaveBeenCalledWith("door1");
  });

  it("uses onPortalTransition when set instead of tryTransition", () => {
    const tryTransition = vi.fn();
    const onPortalTransition = vi.fn();
    system.cellManager = {
      isTransitioning: false,
      tryTransition,
      portals: new Map([["door1", {}]]),
    } as any;
    system.onPortalTransition = onPortalTransition;
    const portal = { id: "door1", labelText: "Enter" };
    player.raycastForward.mockReturnValue({
      pickedMesh: { metadata: { type: "portal", portal } },
    });
    system.interact();
    expect(onPortalTransition).toHaveBeenCalledWith("door1");
    expect(tryTransition).not.toHaveBeenCalled();
  });

  it("blocks portal interaction while a screen fade is active", () => {
    const onPortalTransition = vi.fn();
    system.cellManager = {
      isTransitioning: false,
      tryTransition: vi.fn(),
      portals: new Map([["door1", {}]]),
    } as any;
    system.onPortalTransition = onPortalTransition;
    ui.isScreenFadeActive = true;
    const portal = { id: "door1", labelText: "Enter" };
    player.raycastForward.mockReturnValue({
      pickedMesh: { metadata: { type: "portal", portal } },
    });
    system.interact();
    expect(onPortalTransition).not.toHaveBeenCalled();
  });

  it("hides portal prompt while a screen fade is active", () => {
    system.cellManager = {
      isTransitioning: false,
      tryTransition: vi.fn(),
      portals: new Map([["door1", {}]]),
    } as any;
    ui.isScreenFadeActive = true;
    const portal = { id: "door1", labelText: "Enter" };
    player.raycastForward.mockReturnValue({
      pickedMesh: { metadata: { type: "portal", portal } },
    });
    system.update();
    system.update();
    system.update();
    expect(ui.setInteractionText).toHaveBeenCalledWith("");
    expect(ui.setCrosshairActive).toHaveBeenCalledWith(false);
  });
});
