import { ContentCollision, RpgContentBundle } from "../content/content-types";

export interface ModManifestEntry {
  id: string;
  url: string;
  enabled?: boolean;
}

export interface ModManifest {
  mods: ModManifestEntry[];
}

export interface RpgMod {
  id: string;
  name?: string;
  version?: string;
  content: Partial<RpgContentBundle>;
}

export interface ModLoadFailure {
  modId: string;
  reason: string;
}

export interface ModLoadReport {
  loadedModIds: string[];
  failures: ModLoadFailure[];
  collisions: ContentCollision[];
}

export interface ContentMergeResult {
  merged: RpgContentBundle;
  collisions: ContentCollision[];
}

export type FetchLike = (input: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;
