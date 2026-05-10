import { describe, it, expect } from "vitest";
import { getRemoteCdnAssetKeys } from "./fantasy-asset-loader";

describe("getRemoteCdnAssetKeys", () => {
  it("lists Babylon CDN keys and omits self-hosted Quaternius paths", () => {
    const keys = getRemoteCdnAssetKeys();
    expect(keys).toContain("runeSword");
    expect(keys).toContain("underwaterScene");
    expect(keys).not.toContain("qKnight");
  });
});
