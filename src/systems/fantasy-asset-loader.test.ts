import { describe, it, expect } from "vitest";
import { FantasyAssetLoader, getRemoteCdnAssetKeys, isRemoteAssetKey, setInstanceScale } from "./fantasy-asset-loader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

describe("getRemoteCdnAssetKeys", () => {
  it("lists Babylon CDN keys and omits self-hosted Quaternius paths", () => {
    const keys = getRemoteCdnAssetKeys();
    expect(keys).toContain("runeSword");
    expect(keys).toContain("obelisk");
    expect(keys).not.toContain("qKnight");
  });
});

describe("FantasyAssetLoader offline mode", () => {
  it("classifies remote vs local keys", () => {
    expect(isRemoteAssetKey("inn")).toBe(true);
    expect(isRemoteAssetKey("qForge")).toBe(false);
  });

  it("resolves remote keys as failed without fetching when allowRemote is false", () => {
    const loader = new FantasyAssetLoader({} as never, { allowRemote: false });
    let result: unknown = "pending";
    loader.getInstance("runeSword", (root) => { result = root; });
    expect(result).toBeNull();
    expect(loader.isReady("runeSword")).toBe(true);
    expect(loader.isLoaded("runeSword")).toBe(false);
    loader.preload(getRemoteCdnAssetKeys());
    expect(loader.isLoaded("inn")).toBe(false);
  });
});

describe("setInstanceScale", () => {
  it("sets the magnitude but keeps the glTF handedness flip", () => {
    const root = { scaling: new Vector3(0.5, 0.5, -0.5) } as never;
    setInstanceScale(root, 2.5);
    expect((root as { scaling: Vector3 }).scaling.asArray()).toEqual([2.5, 2.5, -2.5]);
  });
});
