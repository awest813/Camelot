import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createSteamClient, resolveAppId } from "./steam.mjs";

describe("Steam client", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function userData(): string {
    const dir = mkdtempSync(join(tmpdir(), "camelot-steam-"));
    dirs.push(dir);
    return dir;
  }

  it("resolves an app id from the env, then a dev file, then the bake", () => {
    const dir = userData();
    expect(resolveAppId({ env: { STEAM_APP_ID: "480" }, execDir: dir, baked: 111 })).toBe(480);
    expect(resolveAppId({ env: {}, execDir: dir, baked: 0 })).toBe(0);
    writeFileSync(join(dir, "steam_appid.txt"), "480\n");
    expect(resolveAppId({ env: {}, execDir: dir, baked: 111 })).toBe(480);
    expect(resolveAppId({ env: {}, execDir: dir + "-missing", baked: 222 })).toBe(222);
    expect(resolveAppId({ env: { STEAM_APP_ID: "nope" }, baked: 0 })).toBe(0);
  });

  it("records unlocks offline and rejects unsafe ids", () => {
    const dir = userData();
    const client = createSteamClient({ appId: 0, userData: dir });
    expect(client.mode).toBe("offline");
    expect(client.status().cloud).toBe(false);
    expect(client.unlock("ACH_FIRST_BLOOD")).toBe(true);
    expect(client.unlock("ACH_FIRST_BLOOD")).toBe(false);
    expect(client.unlock("drop table")).toBe(false);
    expect(client.sync(["ACH_SADDLED", "not valid", "ACH_FIRST_BLOOD"])).toEqual([
      "ACH_FIRST_BLOOD",
      "ACH_SADDLED",
    ]);

    const restored = createSteamClient({ appId: 0, userData: dir });
    expect(restored.sync([])).toEqual(["ACH_FIRST_BLOOD", "ACH_SADDLED"]);
    const onDisk = JSON.parse(readFileSync(join(dir, "achievements.json"), "utf8"));
    expect(onDisk).toEqual(["ACH_FIRST_BLOOD", "ACH_SADDLED"]);
  });
});
