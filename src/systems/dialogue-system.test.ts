/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
vi.mock("@babylonjs/gui/2D", () => {
  const makeMockObs = () => ({ add: vi.fn() });

  function Rectangle(this: Record<string, unknown>) {
    this.isVisible = false;
    this.addControl = vi.fn();
    this.width = ""; this.height = ""; this.cornerRadius = 0;
    this.color = ""; this.thickness = 0; this.background = "";
    this.verticalAlignment = 0; this.top = "";
  }

  function StackPanel(this: Record<string, unknown>) {
    this.addControl = vi.fn();
    this.clearControls = vi.fn();
    this.height = ""; this.verticalAlignment = 0;
    this.paddingBottom = ""; this.paddingLeft = ""; this.paddingRight = "";
  }

  function TextBlock(this: Record<string, unknown>) {
    this.text = ""; this.color = ""; this.fontSize = 0; this.fontWeight = "";
    this.height = ""; this.verticalAlignment = 0; this.paddingTop = "";
    this.paddingLeft = ""; this.paddingRight = "";
    this.textHorizontalAlignment = 0;
    this.shadowColor = ""; this.shadowBlur = 0;
    this.fontStyle = ""; this.textWrapping = false;
  }

  return {
    AdvancedDynamicTexture: {
      CreateFullscreenUI: vi.fn(() => ({ addControl: vi.fn() })),
    },
    Button: {
      CreateSimpleButton: vi.fn((_name: string, _text: string) => ({
        width: "", height: "", color: "", background: "",
        cornerRadius: 0, thickness: 0, fontSize: 0,
        paddingBottom: "", hoverCursor: "", isEnabled: true,
        isFocusInvisible: false, tabIndex: 0,
        accessibilityTag: null as unknown,
        textBlock: { textHorizontalAlignment: 0, paddingLeft: "" },
        onPointerEnterObservable: makeMockObs(),
        onPointerOutObservable: makeMockObs(),
        onFocusObservable: makeMockObs(),
        onBlurObservable: makeMockObs(),
        onKeyboardEventProcessedObservable: makeMockObs(),
        onPointerUpObservable: makeMockObs(),
      })),
    },
    Control: {
      VERTICAL_ALIGNMENT_BOTTOM: 2,
      VERTICAL_ALIGNMENT_TOP: 0,
      HORIZONTAL_ALIGNMENT_LEFT: 0,
    },
    Rectangle,
    StackPanel,
    TextBlock,
  };
});
vi.mock("../ui/ui-manager", () => ({
  SHARED_UI_PANEL: {
    PANEL_BORDER: "#888", PANEL_BG: "#111", TITLE: "#fff", TEXT: "#ccc",
    DIM: "#555", BTN_BG: "#222", BTN_HOVER: "#444",
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeNpc(name = "Guard") {
  return {
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
});
