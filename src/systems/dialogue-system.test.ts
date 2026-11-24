/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DialogueSystem, type DialogueChoiceOption } from "./dialogue-system";


vi.mock("@babylonjs/core/scene", () => ({
  Scene: vi.fn(),
}));
vi.mock("@babylonjs/core/Maths/math.vector", () => {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    add(v: {x:number;y:number;z:number}) { return new Vector3(this.x+v.x,this.y+v.y,this.z+v.z); }
    subtractToRef(_: unknown, out: Record<string,number>) { out.x=0;out.y=0;out.z=0; return out; }
    normalize() { return this; }
    scaleToRef(_: number, out: Record<string,number>) { out.x=0;out.y=0;out.z=0; return out; }
    addInPlace(_: unknown) { return this; }
    addInPlaceFromFloats(_x: number, _y: number, _z: number) { return this; }
    copyFrom(_: unknown) { return this; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    static Zero() { return new Vector3(0, 0, 0); }
  }
  return { Vector3 };
});
vi.mock("@babylonjs/core/Cameras/arcRotateCamera", () => {
  function ArcRotateCamera(this: Record<string, unknown>) {
    this.setTarget = vi.fn();
    this.position = { x: 0, y: 0, z: 0, copyFrom: vi.fn() };
    this.minZ = 0;
    this.attachControl = vi.fn();
    this.detachControl = vi.fn();
  }
  return { ArcRotateCamera };
});
vi.mock("@babylonjs/core/Cameras/camera", () => ({ Camera: vi.fn() }));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeNpc(name = "Guard") {
  return {
    key: name, displayName: name,
    mesh: {
      name,
      position: { x: 0, y: 0, z: 0, clone() { return this; }, add() { return this; } },
    },
    isInDialogue: false,
  } as unknown as import("../entities/npc").NPC;
}

function makeScene() {
  return { activeCamera: null } as unknown as import("@babylonjs/core/scene").Scene;
}

function makePlayer() {
  const cam = {
    position: { x: 0, y: 0, z: 0, subtractToRef: vi.fn() },
    rotation: { x: 0, y: 0 },
    fov: 0.8,
    detachControl: vi.fn(),
    attachControl: vi.fn(),
  };
  return { camera: cam } as unknown as import("../entities/player").Player;
}

function makeCanvas(): HTMLCanvasElement {
  return {
    requestPointerLock: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

function makeSystem() {
  const scene = makeScene();
  const player = makePlayer();
  const canvas = makeCanvas();
  const sys = new DialogueSystem(scene, player, [], canvas);
  return { sys, scene, player, canvas };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("DialogueSystem", () => {
  let sys: DialogueSystem;

  beforeEach(() => {
    ({ sys } = makeSystem());
  });
  afterEach(() => sys.endDialogue());

  it("starts not in dialogue", () => {
    expect(sys.isInDialogue).toBe(false);
  });

  it("choices is empty when not in dialogue", () => {
    expect(sys.choices).toHaveLength(0);
  });

  it("sets isInDialogue = true on startDialogue", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    expect(sys.isInDialogue).toBe(true);
  });

  it("marks the NPC as in dialogue", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    expect(npc.isInDialogue).toBe(true);
  });

  it("populates choices after startDialogue (fallback)", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    // Fallback creates 3 choices: "Just passing through", "Any rumors…", "Goodbye"
    expect(sys.choices.length).toBeGreaterThanOrEqual(2);
  });

  it("fires onTalkStart with the NPC mesh name", () => {
    const npc = makeNpc("Innkeeper");
    const handler = vi.fn();
    sys.onTalkStart = handler;
    sys.startDialogue(npc);
    expect(handler).toHaveBeenCalledWith("Innkeeper");
  });

  it("endDialogue sets isInDialogue = false", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    sys.endDialogue();
    expect(sys.isInDialogue).toBe(false);
  });

  it("endDialogue clears choices", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    sys.endDialogue();
    expect(sys.choices).toHaveLength(0);
  });

  it("endDialogue fires onDialogueClosed", () => {
    const npc = makeNpc();
    const closed = vi.fn();
    sys.onDialogueClosed = closed;
    sys.startDialogue(npc);
    sys.endDialogue();
    expect(closed).toHaveBeenCalledOnce();
  });

  it("endDialogue is idempotent (calling twice doesn't error)", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    sys.endDialogue();
    expect(() => sys.endDialogue()).not.toThrow();
  });

  it("unmarks the NPC on endDialogue", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    sys.endDialogue();
    expect(npc.isInDialogue).toBe(false);
  });

  it("Escape keydown during dialogue calls endDialogue", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    expect(sys.isInDialogue).toBe(true);

    const evt = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    window.dispatchEvent(evt);
    expect(sys.isInDialogue).toBe(false);
  });

  it("pressing '1' during dialogue triggers first choice callback", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    const firstChoice = sys.choices[0] as DialogueChoiceOption;
    const spy = vi.spyOn(firstChoice, "callback");

    const evt = new KeyboardEvent("keydown", { key: "1", bubbles: true, cancelable: true });
    window.dispatchEvent(evt);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("pressing a number key out of range (e.g. '9') when fewer choices exist does nothing", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    // There are at most 3 fallback choices; pressing 9 should not throw
    expect(() => {
      const evt = new KeyboardEvent("keydown", { key: "9", bubbles: true, cancelable: true });
      window.dispatchEvent(evt);
    }).not.toThrow();
    // Still in dialogue (no choice triggered)
    expect(sys.isInDialogue).toBe(true);
  });

  it("startDialogue is a no-op if already in dialogue", () => {
    const npc1 = makeNpc("NPC1");
    const npc2 = makeNpc("NPC2");
    sys.startDialogue(npc1);
    sys.startDialogue(npc2);
    // First NPC should still be active
    expect(npc1.isInDialogue).toBe(true);
    expect(npc2.isInDialogue).toBe(false);
  });

  it("key handler is removed after endDialogue (second Escape is benign)", () => {
    const npc = makeNpc();
    sys.startDialogue(npc);
    sys.endDialogue();
    const closed = vi.fn();
    sys.onDialogueClosed = closed;
    // Handler is gone, so Escape won't re-fire endDialogue
    const evt = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    window.dispatchEvent(evt);
    expect(closed).not.toHaveBeenCalled();
  });

  describe("polish", () => {
    /** A framework-style session with three choices, the middle one locked. */
    function sessionWithLockedMiddle() {
      const chosen: string[] = [];
      const node = {
        id: "start", speaker: "Innkeeper", text: "What'll it be?", terminal: false,
        choices: [
          { id: "a", text: "Ale.", isAvailable: true },
          { id: "room", text: "A room.", isAvailable: false, blockedBy: "needs 10 gold coins" },
          { id: "bye", text: "Goodbye.", isAvailable: true },
        ],
      };
      const session = {
        getCurrentNode: () => node,
        choose: (id: string) => { chosen.push(id); return { success: true, message: "", isComplete: false, currentNode: node }; },
      };
      return { session, chosen };
    }
    const key = (k: string, repeat = false) => {
      const evt = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, repeat });
      window.dispatchEvent(evt);
      return evt;
    };

    it("numbers choices by position, locked ones included, with the reason shown", () => {
      const { session, chosen } = sessionWithLockedMiddle();
      sys.dialogueSessionProvider = () => session as never;
      sys.startDialogue(makeNpc("Innkeeper_10042"));
      expect(sys.choices.map((c) => c.enabled)).toEqual([true, false, true]);
      expect(sys.choices[1].reason).toBe("needs 10 gold coins");
      key("2");                      // the locked one: nothing happens
      expect(chosen).toEqual([]);
      key("3");                      // "Goodbye." keeps its number
      expect(chosen).toEqual(["bye"]);
    });

    it("keeps digit keys away from the game (quick slots) during a conversation", () => {
      sys.startDialogue(makeNpc());
      const evt = key("7");          // no 7th choice
      expect(evt.defaultPrevented).toBe(true);
      expect(sys.isInDialogue).toBe(true);
    });

    it("arrow keys move the highlight past locked choices; Enter picks it", () => {
      const { session, chosen } = sessionWithLockedMiddle();
      sys.dialogueSessionProvider = () => session as never;
      sys.startDialogue(makeNpc());
      key("ArrowDown");              // skips the locked "A room."
      key("Enter");
      expect(chosen).toEqual(["bye"]);
      // The node re-renders: the highlight starts on the first choice again.
      key("Enter");
      expect(chosen).toEqual(["bye", "a"]);
      key("ArrowUp");                // wraps round to the last
      key("Enter");
      expect(chosen).toEqual(["bye", "a", "bye"]);
    });

    it("a held key doesn't fire a choice twice", () => {
      const { session, chosen } = sessionWithLockedMiddle();
      sys.dialogueSessionProvider = () => session as never;
      sys.startDialogue(makeNpc());
      key("1");
      key("1", true);                // auto-repeat
      expect(chosen).toEqual(["a"]);
    });

    it("ends the conversation if the speaker dies, turns hostile, or the player is moved away", () => {
      const npc = makeNpc() as unknown as { isDead: boolean; isAggressive: boolean };
      sys.startDialogue(npc as never);
      sys.update(0.016);
      expect(sys.isInDialogue).toBe(true);
      npc.isDead = true;
      sys.update(0.016);
      expect(sys.isInDialogue).toBe(false);

      // Merely suspicious (legacy isAggressive set by ALERT) doesn't end it…
      const npc2 = makeNpc() as unknown as { isAggressive: boolean; aiState: string };
      sys.startDialogue(npc2 as never);
      npc2.isAggressive = true;
      npc2.aiState = "ALERT";
      sys.update(0.016);
      expect(sys.isInDialogue).toBe(true);
      // …attacking does.
      npc2.aiState = "ATTACK";
      sys.update(0.016);
      expect(sys.isInDialogue).toBe(false);

      const { sys: sys2, player } = makeSystem();
      sys2.startDialogue(makeNpc());
      (player.camera.position as { x: number }).x = 20;
      sys2.update(0.016);
      expect(sys2.isInDialogue).toBe(false);
    });

    it("shows a readable speaker name in the fallback conversation", async () => {
      const { displayNameOf } = await import("./dialogue-system");
      expect(displayNameOf("Innkeeper_10042")).toBe("Innkeeper");
      expect(displayNameOf("Town Guard_7")).toBe("Town Guard");
    });

    it("draws the box on the page: speaker, line, numbered choices, the reason for a locked one", () => {
      const { session, chosen } = sessionWithLockedMiddle();
      sys.dialogueSessionProvider = () => session as never;
      sys.startDialogue(makeNpc());
      const box = document.querySelector(".dialogue-box")!;
      expect(box.querySelector(".dialogue-box__speaker")!.textContent).toContain("Innkeeper");
      expect(box.querySelector(".dialogue-box__text")!.textContent).toBe('"What\'ll it be?"');
      const buttons = Array.from(box.querySelectorAll<HTMLButtonElement>(".dialogue-box__choice"));
      expect(buttons.map((b) => b.textContent)).toEqual(["[1]  Ale.", "[2]  A room.  —  needs 10 gold coins", "[3]  Goodbye."]);
      expect(buttons.map((b) => b.disabled)).toEqual([false, true, false]);
      expect(buttons[0].getAttribute("aria-current")).toBe("true");

      // The keyboard highlight and the mouse share one selection.
      key("ArrowDown");
      expect(document.querySelectorAll(".dialogue-box__choice")[2].getAttribute("aria-current")).toBe("true");
      document.querySelectorAll<HTMLButtonElement>(".dialogue-box__choice")[0].dispatchEvent(new MouseEvent("mouseenter"));
      expect(document.querySelectorAll(".dialogue-box__choice")[0].getAttribute("aria-current")).toBe("true");

      // A click picks it; a locked choice can't be clicked.
      document.querySelectorAll<HTMLButtonElement>(".dialogue-box__choice")[0].click();
      expect(chosen).toEqual(["a"]);
      document.querySelectorAll<HTMLButtonElement>(".dialogue-box__choice")[1].click();
      expect(chosen).toEqual(["a"]);

      sys.endDialogue();
      expect(document.querySelector(".dialogue-box")).toBeNull();
    });
  });
});
