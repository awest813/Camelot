import { FactionDefinition, FactionDisposition, FactionSnapshot } from "./faction-types";

const DEFAULT_HOSTILE_BELOW = -25;
const DEFAULT_FRIENDLY_AT = 25;
const DEFAULT_ALLIED_AT = 60;

export class FactionEngine {
  private _definitions: Map<string, FactionDefinition>;
  private _reputations: Map<string, number> = new Map();

  constructor(definitions: FactionDefinition[]) {
    this._definitions = new Map(definitions.map((faction) => [faction.id, faction]));
    for (const faction of definitions) {
      this._reputations.set(faction.id, faction.defaultReputation ?? 0);
    }
  }

  public getReputation(factionId: string): number {
    return this._reputations.get(factionId) ?? 0;
  }

  public setReputation(factionId: string, value: number): void {
    if (!this._definitions.has(factionId)) return;
    this._reputations.set(factionId, Math.round(value));
  }

  public adjustReputation(factionId: string, delta: number): number {
    const next = this.getReputation(factionId) + delta;
    this.setReputation(factionId, next);
    return this.getReputation(factionId);
  }

  public getDisposition(factionId: string): FactionDisposition {
    const rep = this.getReputation(factionId);
    const definition = this._definitions.get(factionId);
    if (!definition) return "neutral";

    const hostileBelow = definition.hostileBelow ?? DEFAULT_HOSTILE_BELOW;
    const friendlyAt = definition.friendlyAt ?? DEFAULT_FRIENDLY_AT;
    const alliedAt = definition.alliedAt ?? DEFAULT_ALLIED_AT;

    if (rep < hostileBelow) return "hostile";
    if (rep >= alliedAt) return "allied";
    if (rep >= friendlyAt) return "friendly";
    return "neutral";
  }

  public getSnapshot(): FactionSnapshot {
    return {
      reputations: Object.fromEntries(this._reputations.entries()),
    };
  }

  public restoreSnapshot(snapshot: FactionSnapshot): void {
    for (const [factionId, reputation] of Object.entries(snapshot.reputations)) {
      this.setReputation(factionId, reputation);
    }
  }
}
