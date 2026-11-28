import { describe, it, expect } from "vitest";
import { installPhysicalKeys, physicalKey } from "./physical-keys";

const press = (code: string, key: string, shiftKey = false, altKey = false) => ({ code, key, shiftKey, altKey, ctrlKey: false, metaKey: false });

describe("keys by where they are", () => {
  it("AZERTY: the key above S is forward; the number row gives digits without Shift", () => {
    expect(physicalKey(press("KeyW", "z"))).toEqual({ key: "w", keyCode: 87 });
    expect(physicalKey(press("KeyA", "q"))).toEqual({ key: "a", keyCode: 65 });
    expect(physicalKey(press("Digit1", "&"))).toEqual({ key: "1", keyCode: 49 });
    expect(physicalKey(press("Digit1", "1", true)), "Shift+1 is QWERTY's !").toEqual({ key: "!", keyCode: 49 });
  });

  it("Shift gives the capital (Shift+O, Shift+B); QWERTY presses come out the same", () => {
    expect(physicalKey(press("KeyO", "O", true))).toEqual({ key: "O", keyCode: 79 });
    expect(physicalKey(press("KeyI", "i"))).toEqual({ key: "i", keyCode: 73 });
  });

  it("other keys and AltGr characters are left alone", () => {
    expect(physicalKey(press("F5", "F5"))).toBeNull();
    expect(physicalKey(press("Space", " "))).toBeNull();
    expect(physicalKey(press("Digit2", "@", false, true))).toBeNull();
  });

  it("rewrites presses on the page before anything else hears them, but not typing", () => {
    const off = installPhysicalKeys(window);
    const seen: string[] = [];
    const canvas = document.createElement("canvas");
    const field = document.createElement("input");
    document.body.append(canvas, field);
    const hear = (e: KeyboardEvent) => seen.push(`${e.key}/${e.keyCode}`);
    canvas.addEventListener("keydown", hear);
    field.addEventListener("keydown", hear);
    canvas.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "z", keyCode: 90, bubbles: true } as KeyboardEventInit));
    field.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "z", keyCode: 90, bubbles: true } as KeyboardEventInit));
    expect(seen).toEqual(["w/87", "z/90"]);
    off();
    canvas.remove(); field.remove();
  });
});

describe("keys by place: shortcuts and canvas text fields", () => {
  it("Ctrl/Cmd shortcuts keep the key's own letter (undo is the key marked Z)", () => {
    expect(physicalKey({ code: "KeyW", key: "z", shiftKey: false, altKey: false, ctrlKey: true, metaKey: false })).toBeNull();
    expect(physicalKey({ code: "KeyW", key: "z", shiftKey: false, altKey: false, ctrlKey: false, metaKey: true })).toBeNull();
  });

  it("a Babylon GUI field being typed in gets the layout's own letters", async () => {
    const { setCanvasTyping } = await import("./physical-keys");
    const off = installPhysicalKeys(window);
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const seen: string[] = [];
    canvas.addEventListener("keydown", (e) => seen.push(e.key));
    setCanvasTyping(true);
    canvas.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "z", bubbles: true }));
    setCanvasTyping(false);
    canvas.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "z", bubbles: true }));
    expect(seen).toEqual(["z", "w"]);
    off(); canvas.remove();
  });
});
