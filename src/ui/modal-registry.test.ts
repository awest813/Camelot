import { describe, it, expect } from "vitest";
import { ModalRegistry } from "./modal-registry";

function panel(id: string, open = false) {
  const p = { id, open, closed: 0, isOpen: () => p.open, close: () => { p.open = false; p.closed++; } };
  return p;
}

describe("ModalRegistry", () => {
  it("Escape closes the first open panel in registration order", () => {
    const r = new ModalRegistry();
    const a = panel("a"), b = panel("b", true), c = panel("c", true);
    r.add(a, b, c);
    expect(r.open()).toEqual(["b", "c"]);
    expect(r.closeTop()).toBe(true);
    expect(r.open()).toEqual(["c"]);
    r.closeTop();
    expect(r.closeTop(), "nothing left").toBe(false);
  });

  it("closeAll closes every open panel once; ids are unique", () => {
    const r = new ModalRegistry();
    const a = panel("a", true), b = panel("b"), c = panel("c", true);
    r.add(a, b, c);
    r.closeAll();
    expect([a.closed, b.closed, c.closed]).toEqual([1, 0, 1]);
    expect(r.anyOpen()).toBe(false);
    expect(() => r.add(panel("a"))).toThrow(/already registered/);
  });

  it("closes a panel by id, and only when it is open", () => {
    const r = new ModalRegistry();
    const a = panel("a", true), b = panel("b");
    r.add(a, b);
    expect(r.isOpen("a")).toBe(true);
    r.close("a");
    r.close("b");
    expect([a.closed, b.closed]).toEqual([1, 0]);
    expect(() => r.isOpen("nope")).toThrow(/no modal/);
  });
});
