import { describe, it, expect, vi } from "vitest";
import type { Game } from "../game";
import { forwardDialogToggleKey } from "./input-wiring";

function harness(bindings: Record<string, string>) {
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  const button = document.createElement("button");
  const field = document.createElement("input");
  dialog.append(button, field);
  document.body.append(dialog);
  const handleKeyEvent = vi.fn();
  const g = {
    _inCharacterCreation: false,
    canvas: document.createElement("canvas"),
    _inputAdapter: { matchAction: (key: string) => bindings[key] ?? null, handleKeyEvent },
  } as unknown as Game;
  const press = (key: string, target: HTMLElement) => {
    const ev = new KeyboardEvent("keydown", { key, cancelable: true, bubbles: true });
    Object.defineProperty(ev, "target", { value: target });
    forwardDialogToggleKey(g, ev);
    return ev;
  };
  return { button, field, press, handleKeyEvent, done: () => dialog.remove() };
}

describe("keys pressed inside a panel", () => {
  it("a panel's own toggle key closes it from inside", () => {
    const h = harness({ i: "toggleInventory" });
    expect(h.press("i", h.button).defaultPrevented).toBe(true);
    expect(h.handleKeyEvent).toHaveBeenCalledOnce();
    h.done();
  });

  it("a game F-key never reaches the browser (F5 would reload), even from a text field", () => {
    const h = harness({ F5: "quickSave" });
    expect(h.press("F5", h.button).defaultPrevented).toBe(true);
    expect(h.press("F5", h.field).defaultPrevented).toBe(true);
    expect(h.handleKeyEvent, "and it does nothing in the panel").not.toHaveBeenCalled();
    h.done();
  });

  it("unbound keys and typing are left alone", () => {
    const h = harness({ i: "toggleInventory" });
    expect(h.press("F11", h.button).defaultPrevented).toBe(false);
    expect(h.press("i", h.field).defaultPrevented).toBe(false);
    h.done();
  });
});
