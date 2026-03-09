import { ContentCollision, RpgContentBundle } from "../content/content-types";
import { ContentMergeResult, RpgMod } from "./mod-types";

type ContentWithId = { id: string };
type DomainName = keyof RpgContentBundle;

export const mergeContent = (base: RpgContentBundle, mods: RpgMod[]): ContentMergeResult => {
  const merged: RpgContentBundle = {
    dialogues: base.dialogues.map(clone),
    quests: base.quests.map(clone),
    items: base.items.map(clone),
    factions: base.factions.map(clone),
    npcArchetypes: (base.npcArchetypes ?? []).map(clone),
  };
  const collisions: ContentCollision[] = [];

  const domainSources = new Map<string, string>();
  primeSources("dialogues", merged.dialogues, "base", domainSources);
  primeSources("quests", merged.quests, "base", domainSources);
  primeSources("items", merged.items, "base", domainSources);
  primeSources("factions", merged.factions, "base", domainSources);
  primeSources("npcArchetypes", merged.npcArchetypes, "base", domainSources);

  for (const mod of mods) {
    mergeDomain("dialogues", merged.dialogues, mod.content.dialogues ?? [], mod.id, domainSources, collisions);
    mergeDomain("quests", merged.quests, mod.content.quests ?? [], mod.id, domainSources, collisions);
    mergeDomain("items", merged.items, mod.content.items ?? [], mod.id, domainSources, collisions);
    mergeDomain("factions", merged.factions, mod.content.factions ?? [], mod.id, domainSources, collisions);
    mergeDomain("npcArchetypes", merged.npcArchetypes, mod.content.npcArchetypes ?? [], mod.id, domainSources, collisions);
  }

  return { merged, collisions };
};

const primeSources = <T extends ContentWithId>(
  domain: DomainName,
  target: T[],
  source: string,
  sourceMap: Map<string, string>
): void => {
  for (const entry of target) {
    sourceMap.set(key(domain, entry.id), source);
  }
};

const mergeDomain = <T extends ContentWithId>(
  domain: DomainName,
  target: T[],
  incoming: T[],
  source: string,
  sourceMap: Map<string, string>,
  collisions: ContentCollision[]
): void => {
  const targetIdMap = new Map<string, number>();
  for (let i = 0; i < target.length; i++) {
    targetIdMap.set(target[i].id, i);
  }

  for (const entry of incoming) {
    const existingIndex = targetIdMap.get(entry.id) ?? -1;
    const sourceKey = key(domain, entry.id);

    if (existingIndex >= 0) {
      collisions.push({
        domain,
        id: entry.id,
        replacedSource: sourceMap.get(sourceKey) ?? "unknown",
        incomingSource: source,
      });
      target[existingIndex] = clone(entry);
    } else {
      const newIndex = target.push(clone(entry)) - 1;
      targetIdMap.set(entry.id, newIndex);
    }

    sourceMap.set(sourceKey, source);
  }
};

const key = (domain: DomainName, id: string): string => `${domain}:${id}`;
const clone = <T extends ContentWithId>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
