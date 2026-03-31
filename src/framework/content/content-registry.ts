import type { ItemDefinition } from "../inventory/inventory-types";
import { NpcArchetypeDefinition, RpgContentBundle } from "./content-types";

type ContentWithId = { id: string };
type DomainName = keyof RpgContentBundle;

interface RegistryRecord<T extends ContentWithId> {
  source: string;
  value: T;
}

export class ContentRegistry {
  private _dialogues = new Map<string, RegistryRecord<RpgContentBundle["dialogues"][number]>>();
  private _quests = new Map<string, RegistryRecord<RpgContentBundle["quests"][number]>>();
  private _items = new Map<string, RegistryRecord<RpgContentBundle["items"][number]>>();
  private _factions = new Map<string, RegistryRecord<RpgContentBundle["factions"][number]>>();
  private _npcArchetypes = new Map<string, RegistryRecord<NpcArchetypeDefinition>>();

  public loadBase(bundle: RpgContentBundle): void {
    this.registerBundle(bundle, "base", true);
  }

  public registerBundle(bundle: Partial<RpgContentBundle>, source: string, override: boolean = true): void {
    this._registerDomain("dialogues", bundle.dialogues ?? [], this._dialogues, source, override);
    this._registerDomain("quests", bundle.quests ?? [], this._quests, source, override);
    this._registerDomain("items", bundle.items ?? [], this._items, source, override);
    this._registerDomain("factions", bundle.factions ?? [], this._factions, source, override);
    this._registerDomain("npcArchetypes", bundle.npcArchetypes ?? [], this._npcArchetypes, source, override);
  }

  public toBundle(): RpgContentBundle {
    return {
      dialogues: Array.from(this._dialogues.values()).map((entry) => entry.value),
      quests: Array.from(this._quests.values()).map((entry) => entry.value),
      items: Array.from(this._items.values()).map((entry) => entry.value),
      factions: Array.from(this._factions.values()).map((entry) => entry.value),
      npcArchetypes: Array.from(this._npcArchetypes.values()).map((entry) => entry.value),
    };
  }

  /** Return a registered NPC archetype by id, or null. */
  public getNpcArchetype(id: string): NpcArchetypeDefinition | null {
    return this._npcArchetypes.get(id)?.value ?? null;
  }

  /** All registered NPC archetypes. */
  public getAllNpcArchetypes(): NpcArchetypeDefinition[] {
    return Array.from(this._npcArchetypes.values()).map(r => r.value);
  }

  /** Return a registered item definition by id, or `null` if unknown. */
  public getItemDefinition(id: string): ItemDefinition | null {
    return this._items.get(id)?.value ?? null;
  }

  public getSource(domain: DomainName, id: string): string | null {
    switch (domain) {
      case "dialogues":
        return this._dialogues.get(id)?.source ?? null;
      case "quests":
        return this._quests.get(id)?.source ?? null;
      case "items":
        return this._items.get(id)?.source ?? null;
      case "factions":
        return this._factions.get(id)?.source ?? null;
      case "npcArchetypes":
        return this._npcArchetypes.get(id)?.source ?? null;
    }
  }

  private _registerDomain<T extends ContentWithId>(
    domain: DomainName,
    entries: T[],
    target: Map<string, RegistryRecord<T>>,
    source: string,
    override: boolean
  ): void {
    for (const entry of entries) {
      const existing = target.get(entry.id);
      if (existing && !override) continue;
      target.set(entry.id, {
        source,
        value: this._cloneByDomain(domain, entry),
      });
    }
  }

  private _cloneByDomain<T extends ContentWithId>(domain: DomainName, entry: T): T {
    if (domain === "dialogues") {
      return {
        ...entry,
        nodes: (entry as unknown as { nodes: unknown[] }).nodes?.map((node) => ({
          ...(node as Record<string, unknown>),
          choices: ((node as { choices?: unknown[] }).choices ?? []).map((choice) => ({
            ...(choice as Record<string, unknown>),
            conditions: [ ...((choice as { conditions?: unknown[] }).conditions ?? []) ],
            effects: [ ...((choice as { effects?: unknown[] }).effects ?? []) ],
          })),
        })),
      };
    }

    if (domain === "quests") {
      return {
        ...entry,
        nodes: ((entry as unknown as { nodes?: unknown[] }).nodes ?? []).map((node) => ({
          ...(node as Record<string, unknown>),
          prerequisites: [ ...((node as { prerequisites?: string[] }).prerequisites ?? []) ],
          nextNodeIds: [ ...((node as { nextNodeIds?: string[] }).nextNodeIds ?? []) ],
        })),
        startNodeIds: [ ...((entry as unknown as { startNodeIds?: string[] }).startNodeIds ?? []) ],
        completionNodeIds: [ ...((entry as unknown as { completionNodeIds?: string[] }).completionNodeIds ?? []) ],
      };
    }

    if (domain === "items") {
      return {
        ...entry,
        tags: [ ...((entry as unknown as { tags?: string[] }).tags ?? []) ],
      };
    }

    return { ...entry };
  }
}
