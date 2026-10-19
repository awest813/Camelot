import { createRequire } from "module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);

/** Steamworks API names: uppercase, digits, underscores, 1–64 chars. */
export const ACHIEVEMENT_ID = /^[A-Z0-9_]{1,64}$/;

export function readAchievementFile(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string" && ACHIEVEMENT_ID.test(id));
  } catch {
    return [];
  }
}

export function writeAchievementFile(filePath, ids) {
  mkdirSync(dirname(filePath), { recursive: true });
  const unique = [];
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== "string" || !ACHIEVEMENT_ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  writeFileSync(filePath, JSON.stringify(unique, null, 2));
  return unique;
}

function readAppIdFile(filePath) {
  try {
    const text = readFileSync(filePath, "utf8").trim();
    if (!/^\d+$/.test(text)) return 0;
    return Number(text);
  } catch {
    return 0;
  }
}

/**
 * Resolve the Steam app id. 0 means "do not init Steamworks".
 * Order: STEAM_APP_ID env, steam_appid.txt beside the executable (dev only),
 * then the baked desktop/steam-app-id.json value. 480 (Spacewar) is never
 * the default — a publisher sets the real id before uploading the depot.
 */
export function resolveAppId({ env = process.env, execDir, baked = 0 } = {}) {
  const fromEnv = Number(env.STEAM_APP_ID);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  if (execDir) {
    const fromFile = readAppIdFile(join(execDir, "steam_appid.txt"));
    if (fromFile > 0) return fromFile;
  }
  const fromBake = Number(baked);
  if (Number.isInteger(fromBake) && fromBake > 0) return fromBake;
  return 0;
}

/**
 * Achievement + presence client. Uses steamworks.js when it is installed and
 * an app id is configured; otherwise records unlocks in userData so the
 * Steam depot still has a working offline path.
 */
export function createSteamClient({ appId, userData }) {
  const filePath = join(userData, "achievements.json");
  const unlocked = new Set(existsSync(filePath) ? readAchievementFile(filePath) : []);
  let mode = "offline";
  let api = null;
  let persona = null;
  const numericId = Number(appId);

  if (Number.isInteger(numericId) && numericId > 0) {
    try {
      const steamworks = require("steamworks.js");
      api = steamworks.init(numericId);
      mode = "steamworks";
      try {
        persona = api.localplayer.getName();
      } catch {
        persona = null;
      }
      try {
        api.localplayer.setRichPresence("steam_display", "In Camelot");
      } catch {
        // Rich presence is optional and varies by steamworks.js version.
      }
    } catch {
      mode = "offline";
      api = null;
    }
  }

  function activate(id) {
    if (!api) return;
    try {
      api.achievement.activate(id);
    } catch {
      // Unknown ids are rejected by Steamworks; the local file still records them.
    }
  }

  return {
    get mode() {
      return mode;
    },
    status() {
      return {
        mode,
        appId: String(numericId > 0 ? numericId : 0),
        persona,
        cloud: mode === "steamworks",
      };
    },
    unlock(achievementId) {
      if (typeof achievementId !== "string" || !ACHIEVEMENT_ID.test(achievementId)) return false;
      const already = unlocked.has(achievementId);
      unlocked.add(achievementId);
      writeAchievementFile(filePath, [...unlocked]);
      if (!already) activate(achievementId);
      return !already;
    },
    sync(ids) {
      const incoming = Array.isArray(ids) ? ids : [];
      for (const achievementId of incoming) {
        if (typeof achievementId !== "string" || !ACHIEVEMENT_ID.test(achievementId)) continue;
        if (unlocked.has(achievementId)) continue;
        unlocked.add(achievementId);
        activate(achievementId);
      }
      return writeAchievementFile(filePath, [...unlocked]);
    },
  };
}
