import { RpgContentBundle } from "../content/content-types";
import { mergeContent } from "./content-merge";
import { FetchLike, ModLoadFailure, ModLoadReport, ModManifest, RpgMod } from "./mod-types";

export class ModLoader {
  private _fetch: FetchLike;

  constructor(fetchImpl: FetchLike) {
    this._fetch = fetchImpl;
  }

  public async loadManifest(manifestUrl: string): Promise<ModManifest> {
    const raw = await this._loadJson(manifestUrl);
    if (!raw || typeof raw !== "object" || !Array.isArray((raw as ModManifest).mods)) {
      throw new Error(`Invalid mod manifest at ${manifestUrl}`);
    }
    const manifest = raw as ModManifest;
    return {
      mods: manifest.mods.filter((entry) => entry.enabled !== false),
    };
  }

  public async loadModsFromManifest(manifestUrl: string): Promise<{ mods: RpgMod[]; failures: ModLoadFailure[] }> {
    const manifest = await this.loadManifest(manifestUrl);
    const mods: RpgMod[] = [];
    const failures: ModLoadFailure[] = [];

    const loadPromises = manifest.mods.map(async (entry) => {
      try {
        const url = resolveUrl(entry.url, manifestUrl);
        const raw = await this._loadJson(url);
        const mod = validateMod(raw, entry.id);
        return { type: "success" as const, mod };
      } catch (error) {
        return {
          type: "failure" as const,
          failure: {
            modId: entry.id,
            reason: error instanceof Error ? error.message : "Unknown mod load error.",
          },
        };
      }
    });

    const results = await Promise.all(loadPromises);

    for (const result of results) {
      if (result.type === "success") {
        mods.push(result.mod);
      } else {
        failures.push(result.failure);
      }
    }

    return { mods, failures };
  }

  public async loadAndMerge(base: RpgContentBundle, manifestUrl: string): Promise<{ content: RpgContentBundle; report: ModLoadReport }> {
    const { mods, failures } = await this.loadModsFromManifest(manifestUrl);
    const mergeResult = mergeContent(base, mods);

    return {
      content: mergeResult.merged,
      report: {
        loadedModIds: mods.map((mod) => mod.id),
        failures,
        collisions: mergeResult.collisions,
      },
    };
  }

  private async _loadJson(url: string): Promise<unknown> {
    const response = await this._fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url} (status ${response.status}).`);
    }
    return response.json();
  }
}

const validateMod = (raw: unknown, fallbackId: string): RpgMod => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Mod descriptor is not an object.");
  }

  const source = raw as Record<string, unknown>;
  const id = typeof source.id === "string" ? source.id : fallbackId;
  const content = typeof source.content === "object" && source.content !== null
    ? (source.content as Partial<RpgContentBundle>)
    : {};

  return {
    id,
    name: typeof source.name === "string" ? source.name : undefined,
    version: typeof source.version === "string" ? source.version : undefined,
    content,
  };
};

const resolveUrl = (candidate: string, manifestUrl: string): string => {
  try {
    return new URL(candidate, manifestUrl).toString();
  } catch {
    return candidate;
  }
};
