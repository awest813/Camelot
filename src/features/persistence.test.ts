import { describe, it, expect, vi } from "vitest";
import { Kernel, type Feature } from "../core/kernel";
import { declareStateless, ownSave, ownTransient, persistenceOf, undeclaredFeatures } from "./services";

const feature = (id: string, install: Feature["install"]): Feature => ({ id, install });

describe("persistence declarations", () => {
  it("every feature says what happens to its state on load; the silent ones are listed", () => {
    const k = new Kernel();
    k.install(feature("saver", (ctx) => ownSave(ctx, { key: "saver", save: () => 1, load: () => {} })));
    k.install(feature("raids", (ctx) => ownTransient(ctx, "a raid in progress", () => {})));
    k.install(feature("sites", (ctx) => declareStateless(ctx, "comes from the seed")));
    k.install(feature("quiet", () => {}));
    expect(undeclaredFeatures(k)).toEqual(["quiet"]);
    expect(persistenceOf(k).get("raids")).toEqual([{ kind: "transient", what: "a raid in progress" }]);
    expect(persistenceOf(k).get("saver")).toEqual([{ kind: "saved", key: "saver" }]);
  });

  it("a transient reset runs after a load; uninstalling drops the declaration and the reset", () => {
    const k = new Kernel();
    const reset = vi.fn();
    k.install(feature("raids", (ctx) => ownTransient(ctx, "a raid", reset)));
    k.events.emit("save:loaded", {});
    expect(reset).toHaveBeenCalledOnce();
    k.uninstall("raids");
    k.events.emit("save:loaded", {});
    expect(reset).toHaveBeenCalledOnce();
    expect(persistenceOf(k).has("raids")).toBe(false);
    expect(k.installed()).toEqual([]);
  });
});
