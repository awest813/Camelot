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

  it("modifier guards: shift:false rejects the shifted chord", () => {
    const adapter = new BabylonInputAdapter();
    let loaded = 0;
    adapter.onAction("load", () => { loaded++; });

    // Shift+F9 must fall through (null) so the legacy Faction Creator branch
    // runs — loading a save on a creator hotkey destroys player progress.
    expect(adapter.handleKeyEvent("F9", "down", { shift: true })).toBeNull();
    expect(loaded).toBe(0);

    expect(adapter.handleKeyEvent("F9", "down")).toBe("load");
    expect(loaded).toBe(1);
  });

  it("default bindings route Shift+E to powerAttack and E to interact", () => {
    const adapter = new BabylonInputAdapter();
    const fired: string[] = [];
    adapter.onAction("interact", () => { fired.push("interact"); });
    adapter.onAction("powerAttack", () => { fired.push("powerAttack"); });

    adapter.handleKeyEvent("e", "down", {});
    adapter.handleKeyEvent("e", "down", { shift: true });
    expect(fired).toEqual(["interact", "powerAttack"]);
  });

  it("default bindings fall through shifted/ctrl creator chords to legacy", () => {
    const adapter = new BabylonInputAdapter();
    // Shift+F5 / Shift+F8 belong to the legacy Bundle Merge / Loot Table creators
    expect(adapter.handleKeyEvent("F5", "down", { shift: true })).toBeNull();
    expect(adapter.handleKeyEvent("F8", "down", { shift: true })).toBeNull();
    // Ctrl+M / Ctrl+Shift+M belong to Scene Notes / Mod Manifest (legacy)
    expect(adapter.handleKeyEvent("m", "down", { ctrlOrMeta: true })).toBeNull();
    // Ctrl+Z / Ctrl+Y belong to editor undo/redo (legacy)
    expect(adapter.handleKeyEvent("z", "down", { ctrlOrMeta: true })).toBeNull();
    expect(adapter.handleKeyEvent("y", "down", { ctrlOrMeta: true })).toBeNull();
    // Unmodified chords still fire
    expect(adapter.handleKeyEvent("F5", "down")).toBe("save");
    expect(adapter.handleKeyEvent("F8", "down")).toBe("favoritesMenu");
    expect(adapter.handleKeyEvent("m", "down")).toBe("toggleMute");
    expect(adapter.handleKeyEvent("z", "down")).toBe("cycleSpell");
    expect(adapter.handleKeyEvent("y", "down")).toBe("toggleFastTravel");
  });

  it("permissive bindings still match while Shift is held (sprint-jump)", () => {
    const adapter = new BabylonInputAdapter();
    // Space/jump and the shifted-character archetype keys must keep working
    // while Shift is held — only bindings with an explicit modifier flag are strict.
    expect(adapter.handleKeyEvent(" ", "down", { shift: true })).toBe("jump");
    expect(adapter.handleKeyEvent("!", "down", { shift: true })).toBe("archetype1");
  });

  it("default bindings keep Shift+O / O disambiguation", () => {
    const adapter = new BabylonInputAdapter();
    expect(adapter.handleKeyEvent("O", "down", { shift: true })).toBe("stableOrSaddlebag");
    expect(adapter.handleKeyEvent("O", "down")).toBe("mountDismount");
  });

  it("default bindings route Shift+M to markPosition, M to mute", () => {
    const adapter = new BabylonInputAdapter();
    expect(adapter.handleKeyEvent("M", "down", { shift: true })).toBe("markPosition");
    expect(adapter.handleKeyEvent("m", "down")).toBe("toggleMute");
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
    expect(actions.has("toggleShoutMenu")).toBe(true);
    expect(actions.has("useShout")).toBe(true);
  });

  // ── Shout keys (N / Shift+N) ────────────────────────────────────────────────

  it("plain N fires toggleShoutMenu", () => {
    const adapter = new BabylonInputAdapter();
    const fired: InputAction[] = [];
    adapter.onAction("toggleShoutMenu", () => fired.push("toggleShoutMenu"));
    adapter.onAction("useShout", () => fired.push("useShout"));
    expect(adapter.handleKeyEvent("n", "down")).toBe("toggleShoutMenu");
    expect(adapter.handleKeyEvent("N", "down")).toBe("toggleShoutMenu");
    expect(fired).toEqual(["toggleShoutMenu", "toggleShoutMenu"]);
  });

  it("Shift+N fires useShout and not toggleShoutMenu", () => {
    const adapter = new BabylonInputAdapter();
    const fired: InputAction[] = [];
    adapter.onAction("toggleShoutMenu", () => fired.push("toggleShoutMenu"));
    adapter.onAction("useShout", () => fired.push("useShout"));
    expect(adapter.handleKeyEvent("n", "down", { shift: true })).toBe("useShout");
    expect(adapter.handleKeyEvent("N", "down", { shift: true })).toBe("useShout");
    expect(fired).toEqual(["useShout", "useShout"]);
  });

  it("useShout is not fired without Shift", () => {
    const adapter = new BabylonInputAdapter();
    const fired: InputAction[] = [];
    adapter.onAction("useShout", () => fired.push("useShout"));
    expect(adapter.handleKeyEvent("n", "down")).toBe("toggleShoutMenu");
    expect(fired).toEqual([]);
  });
});
