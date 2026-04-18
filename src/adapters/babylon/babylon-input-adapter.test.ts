import { describe, it, expect, vi } from "vitest";
import {
  BabylonInputAdapter,
  DEFAULT_BINDINGS,
  type InputAction,
  type InputBinding,
} from "./babylon-input-adapter";

describe("BabylonInputAdapter", () => {
  // ── Construction ────────────────────────────────────────────────────────────

  it("uses default bindings when none provided", () => {
    const adapter = new BabylonInputAdapter();
    expect(adapter.bindings.length).toBe(DEFAULT_BINDINGS.length);
  });

  it("accepts custom bindings", () => {
    const bindings: InputBinding[] = [
      { key: "a", action: "meleeAttack" },
    ];
    const adapter = new BabylonInputAdapter(bindings);
    expect(adapter.bindings.length).toBe(1);
  });

  // ── Action subscription ─────────────────────────────────────────────────────

  it("dispatches to registered listeners on simulateAction", () => {
    const adapter = new BabylonInputAdapter();
    let fired = 0;
    adapter.onAction("meleeAttack", () => { fired++; });
    adapter.simulateAction("meleeAttack");
    expect(fired).toBe(1);
  });

  it("supports multiple listeners for the same action", () => {
    const adapter = new BabylonInputAdapter();
    let a = 0, b = 0;
    adapter.onAction("meleeAttack", () => { a++; });
    adapter.onAction("meleeAttack", () => { b++; });
    adapter.simulateAction("meleeAttack");
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it("returns a dispose function from onAction", () => {
    const adapter = new BabylonInputAdapter();
    let fired = 0;
    const dispose = adapter.onAction("meleeAttack", () => { fired++; });
    dispose();
    adapter.simulateAction("meleeAttack");
    expect(fired).toBe(0);
  });

  it("off(action) removes all listeners for that action", () => {
    const adapter = new BabylonInputAdapter();
    let fired = 0;
    adapter.onAction("meleeAttack", () => { fired++; });
    adapter.off("meleeAttack");
    adapter.simulateAction("meleeAttack");
    expect(fired).toBe(0);
  });

  it("off() removes all listeners", () => {
    const adapter = new BabylonInputAdapter();
    let a = 0, b = 0;
    adapter.onAction("meleeAttack", () => { a++; });
    adapter.onAction("pause", () => { b++; });
    adapter.off();
    adapter.simulateAction("meleeAttack");
    adapter.simulateAction("pause");
    expect(a).toBe(0);
    expect(b).toBe(0);
  });

  // ── Key event handling ──────────────────────────────────────────────────────

  it("dispatches action on matching key-down event", () => {
    const bindings: InputBinding[] = [
      { key: "i", action: "toggleInventory", caseInsensitive: true },
    ];
    const adapter = new BabylonInputAdapter(bindings);
    let fired = 0;
    adapter.onAction("toggleInventory", () => { fired++; });

    const result = adapter.handleKeyEvent("i", "down");
    expect(result).toBe("toggleInventory");
    expect(fired).toBe(1);
  });

  it("case-insensitive matching works", () => {
    const bindings: InputBinding[] = [
      { key: "i", action: "toggleInventory", caseInsensitive: true },
    ];
    const adapter = new BabylonInputAdapter(bindings);
    let fired = 0;
    adapter.onAction("toggleInventory", () => { fired++; });

    adapter.handleKeyEvent("I", "down");
    expect(fired).toBe(1);
  });

  it("case-sensitive matching rejects wrong case", () => {
    const bindings: InputBinding[] = [
      { key: "i", action: "toggleInventory" },
    ];
    const adapter = new BabylonInputAdapter(bindings);
    let fired = 0;
    adapter.onAction("toggleInventory", () => { fired++; });

    const result = adapter.handleKeyEvent("I", "down");
    expect(result).toBeNull();
    expect(fired).toBe(0);
  });

  it("respects phase: up bindings fire on key-up", () => {
    const bindings: InputBinding[] = [
      { key: "r", action: "releaseBow", phase: "up", caseInsensitive: true },
    ];
    const adapter = new BabylonInputAdapter(bindings);
    let fired = 0;
    adapter.onAction("releaseBow", () => { fired++; });

    adapter.handleKeyEvent("r", "down"); // should not fire
    expect(fired).toBe(0);

    adapter.handleKeyEvent("r", "up");   // should fire
    expect(fired).toBe(1);
  });

  it("modifier guards: shift required", () => {
    const bindings: InputBinding[] = [
      { key: "O", action: "stableOrSaddlebag", shift: true },
    ];
    const adapter = new BabylonInputAdapter(bindings);
    let fired = 0;
    adapter.onAction("stableOrSaddlebag", () => { fired++; });

    adapter.handleKeyEvent("O", "down", {}); // no shift
    expect(fired).toBe(0);

    adapter.handleKeyEvent("O", "down", { shift: true });
    expect(fired).toBe(1);
  });

  it("modifier guards: ctrlOrMeta required", () => {
    const bindings: InputBinding[] = [
      { key: "s", action: "save", ctrlOrMeta: true },
    ];
    const adapter = new BabylonInputAdapter(bindings);
    let fired = 0;
    adapter.onAction("save", () => { fired++; });

    adapter.handleKeyEvent("s", "down", {});
    expect(fired).toBe(0);

    adapter.handleKeyEvent("s", "down", { ctrlOrMeta: true });
    expect(fired).toBe(1);
  });

  it("returns null when no binding matches", () => {
    const adapter = new BabylonInputAdapter([]);
    const result = adapter.handleKeyEvent("z", "down");
    expect(result).toBeNull();
  });

  // ── Active state tracking ───────────────────────────────────────────────────

  it("tracks active actions on key-down", () => {
    const bindings: InputBinding[] = [
      { key: "c", action: "toggleCrouch" },
    ];
    const adapter = new BabylonInputAdapter(bindings);

    expect(adapter.isActive("toggleCrouch")).toBe(false);
    adapter.handleKeyEvent("c", "down");
    expect(adapter.isActive("toggleCrouch")).toBe(true);
  });

  it("removes active actions on key-up", () => {
    const bindings: InputBinding[] = [
      { key: "r", action: "drawBow" },
      { key: "r", action: "releaseBow", phase: "up" },
    ];
    const adapter = new BabylonInputAdapter(bindings);

    adapter.handleKeyEvent("r", "down");
    expect(adapter.isActive("drawBow")).toBe(true);

    adapter.handleKeyEvent("r", "up");
    expect(adapter.isActive("releaseBow")).toBe(false);
  });

  it("reset() clears all active actions", () => {
    const bindings: InputBinding[] = [
      { key: "c", action: "toggleCrouch" },
    ];
    const adapter = new BabylonInputAdapter(bindings);
    adapter.handleKeyEvent("c", "down");
    expect(adapter.isActive("toggleCrouch")).toBe(true);

    adapter.reset();
    expect(adapter.isActive("toggleCrouch")).toBe(false);
    expect(adapter.activeActions.size).toBe(0);
  });

  // ── Pointer events ──────────────────────────────────────────────────────────

  it("left-click dispatches meleeAttack", () => {
    const adapter = new BabylonInputAdapter();
    let fired = 0;
    adapter.onAction("meleeAttack", () => { fired++; });

    const result = adapter.handlePointerEvent(0, "down");
    expect(result).toBe("meleeAttack");
    expect(fired).toBe(1);
    expect(adapter.isActive("meleeAttack")).toBe(true);
  });

  it("left-click release clears active state", () => {
    const adapter = new BabylonInputAdapter();
    adapter.handlePointerEvent(0, "down");
    adapter.handlePointerEvent(0, "up");
    expect(adapter.isActive("meleeAttack")).toBe(false);
  });

  it("right-click dispatches block then blockRelease", () => {
    const adapter = new BabylonInputAdapter();
    const actions: InputAction[] = [];
    adapter.onAction("block", (a) => { actions.push(a); });
    adapter.onAction("blockRelease", (a) => { actions.push(a); });

    adapter.handlePointerEvent(2, "down");
    expect(adapter.isActive("block")).toBe(true);

    adapter.handlePointerEvent(2, "up");
    expect(adapter.isActive("block")).toBe(false);
    expect(actions).toEqual(["block", "blockRelease"]);
  });

  it("middle-click returns null (unmapped)", () => {
    const adapter = new BabylonInputAdapter();
    expect(adapter.handlePointerEvent(1, "down")).toBeNull();
  });

  // ── Rebinding ───────────────────────────────────────────────────────────────

  it("rebind() replaces the binding table", () => {
    const adapter = new BabylonInputAdapter();
    expect(adapter.bindings.length).toBe(DEFAULT_BINDINGS.length);

    adapter.rebind([{ key: "x", action: "meleeAttack" }]);
    expect(adapter.bindings.length).toBe(1);

    let fired = 0;
    adapter.onAction("meleeAttack", () => { fired++; });
    adapter.handleKeyEvent("x", "down");
    expect(fired).toBe(1);
  });

  it("getBindingsForAction returns matching bindings", () => {
    const adapter = new BabylonInputAdapter([
      { key: "q", action: "castSpell" },
      { key: "q", action: "castSpell", phase: "up" },
      { key: "z", action: "cycleSpell" },
    ]);
    const bindings = adapter.getBindingsForAction("castSpell");
    expect(bindings.length).toBe(2);
  });

  // ── simulatePress ───────────────────────────────────────────────────────────

  it("simulatePress fires callback and cleans up active state", () => {
    const adapter = new BabylonInputAdapter();
    let fired = 0;
    adapter.onAction("save", () => { fired++; });
    adapter.simulatePress("save");
    expect(fired).toBe(1);
    expect(adapter.isActive("save")).toBe(false);
  });

  // ── Default bindings coverage ───────────────────────────────────────────────

  it("default bindings include common gameplay actions", () => {
    const actions = new Set(DEFAULT_BINDINGS.map(b => b.action));
    expect(actions.has("meleeAttack")).toBe(false); // melee is pointer, not keyboard
    expect(actions.has("toggleInventory")).toBe(true);
    expect(actions.has("pause")).toBe(true);
    expect(actions.has("save")).toBe(true);
    expect(actions.has("toggleMapEditor")).toBe(true);
  });
});
