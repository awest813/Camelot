import { describe, it, expect, vi } from "vitest";
import { PlayFocus } from "./play-focus";

function setup() {
  const d = { lockPointer: vi.fn(), unlockPointer: vi.fn(), attachCamera: vi.fn(), detachCamera: vi.fn(), setInteractionBlocked: vi.fn() };
  return { d, f: new PlayFocus(d) };
}

describe("PlayFocus", () => {
  it("a menu takes input; closing it gives it back", () => {
    const { d, f } = setup();
    f.take("menu");
    expect(f.held).toBe(true);
    expect(d.unlockPointer).toHaveBeenCalled();
    expect(d.setInteractionBlocked).toHaveBeenLastCalledWith(true);
    f.give("menu");
    expect(f.held).toBe(false);
    expect(d.lockPointer).toHaveBeenCalledOnce();
    expect(d.setInteractionBlocked).toHaveBeenLastCalledWith(false);
  });

  it("closing a tool inside the map editor keeps the editor's hold", () => {
    const { d, f } = setup();
    f.take("editor");
    f.take("menu");
    f.give("menu");
    expect(f.holds("editor")).toBe(true);
    expect(d.lockPointer).not.toHaveBeenCalled();
    expect(d.setInteractionBlocked).toHaveBeenLastCalledWith(true);
    f.give("editor");
    expect(d.lockPointer).toHaveBeenCalledOnce();
  });

  it("letting go of something not held is harmless; pointer errors are swallowed", () => {
    const { d, f } = setup();
    d.lockPointer.mockImplementation(() => { throw new Error("no gesture"); });
    expect(() => f.give("dialogue")).not.toThrow();
    expect(d.attachCamera).toHaveBeenCalled();
  });
});
