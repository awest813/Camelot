import { describe, it, expect } from "vitest";
import { FantasyAssetLoader, getRemoteCdnAssetKeys, isRemoteAssetKey } from "./fantasy-asset-loader";

describe("getRemoteCdnAssetKeys", () => {
  it("lists Babylon CDN keys and omits self-hosted Quaternius paths", () => {
    const keys = getRemoteCdnAssetKeys();
    expect(keys).toContain("runeSword");
    expect(keys).toContain("underwaterScene");
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
