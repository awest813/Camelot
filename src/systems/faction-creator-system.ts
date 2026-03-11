import type {
  FactionDefinition,
  FactionDisposition,
} from "../framework/factions/faction-types";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default reputation thresholds matching FactionEngine defaults. */
export const DEFAULT_HOSTILE_BELOW = -25;
export const DEFAULT_FRIENDLY_AT   = 25;
export const DEFAULT_ALLIED_AT     = 60;

export const FACTION_DISPOSITIONS: FactionDisposition[] = [
  "hostile", "neutral", "friendly", "allied",
];

// ── Draft types ───────────────────────────────────────────────────────────────

/**
 * A directed relationship from this faction toward another faction.
 * Stored as part of the faction draft for documentation / export purposes.
 */
export interface FactionRelationDraft {
  /** Target faction ID. */
  targetId: string;
  /** Standing of *this* faction toward `targetId`. */
  disposition: FactionDisposition;
  /** Optional note explaining the relationship. */
  note: string;
}

export interface FactionCreatorDraft {
  id:                string;
  name:              string;
  description:       string;
  defaultReputation: number;
  hostileBelow:      number;
  friendlyAt:        number;
  alliedAt:          number;
  /** Relationships toward other factions. */
  relations:         FactionRelationDraft[];
}

export interface FactionValidationReport {
  valid:  boolean;
  issues: string[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const BLANK_DRAFT: FactionCreatorDraft = {
  id:                "",
  name:              "",
  description:       "",
  defaultReputation: 0,
  hostileBelow:      DEFAULT_HOSTILE_BELOW,
  friendlyAt:        DEFAULT_FRIENDLY_AT,
  alliedAt:          DEFAULT_ALLIED_AT,
  relations:         [],
};

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Headless authoring system for faction definitions.
 *
 * Manages a mutable `FactionCreatorDraft` with helpers for reputation
 * thresholds, inter-faction relationship authoring, validation, and
 * JSON / file export-import.
 *
 * The produced `FactionDefinition` is compatible with the framework
 * `FactionEngine`.
 */
export class FactionCreatorSystem {
  private _draft: FactionCreatorDraft;
  private _relationCounter = 0;

  constructor(initial?: Partial<FactionCreatorDraft>) {
    this._draft = {
      ...BLANK_DRAFT,
      ...initial,
      relations: [...(initial?.relations ?? [])],
    };
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  /**
   * Apply a partial set of field updates to the draft.
   * Threshold values are clamped to the range [−100, 100].
   * `defaultReputation` is clamped to [−100, 100].
   */
  setMeta(fields: Partial<Omit<FactionCreatorDraft, "relations">>): void {
    if (fields.id          !== undefined) this._draft.id          = fields.id.trim();
    if (fields.name        !== undefined) this._draft.name        = fields.name.trim();
    if (fields.description !== undefined) this._draft.description = fields.description.trim();

    const clamp = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));

    if (fields.defaultReputation !== undefined)
      this._draft.defaultReputation = clamp(fields.defaultReputation);
    if (fields.hostileBelow !== undefined)
      this._draft.hostileBelow = clamp(fields.hostileBelow);
    if (fields.friendlyAt !== undefined)
      this._draft.friendlyAt = clamp(fields.friendlyAt);
    if (fields.alliedAt !== undefined)
      this._draft.alliedAt = clamp(fields.alliedAt);
  }

  // ── Faction relations ──────────────────────────────────────────────────────

  /**
   * Append a new relation to the draft.
   * `partial.targetId` is used when supplied; otherwise a unique auto-key is
   * generated.  Returns the final targetId key used.
   */
  addRelation(partial: Partial<FactionRelationDraft> = {}): string {
    const targetId = partial.targetId?.trim() || `faction_${++this._relationCounter}`;
    const relation: FactionRelationDraft = {
      targetId,
      disposition: partial.disposition ?? "neutral",
      note:        partial.note        ?? "",
    };
    this._draft.relations.push(relation);
    return targetId;
  }

  /**
   * Update an existing relation by targetId.
   * Returns `false` when `targetId` is not found.
   */
  updateRelation(
    targetId: string,
    updates: Partial<Omit<FactionRelationDraft, "targetId">>,
  ): boolean {
    const rel = this._draft.relations.find(r => r.targetId === targetId);
    if (!rel) return false;
    if (updates.disposition !== undefined) rel.disposition = updates.disposition;
    if (updates.note        !== undefined) rel.note        = updates.note;
    return true;
  }

  /**
   * Remove a relation by targetId.
   * Returns `false` when `targetId` is not found.
   */
  removeRelation(targetId: string): boolean {
    const idx = this._draft.relations.findIndex(r => r.targetId === targetId);
    if (idx === -1) return false;
    this._draft.relations.splice(idx, 1);
    return true;
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /** Validate the current draft for required fields and sane threshold ordering. */
  validate(): FactionValidationReport {
    const issues: string[] = [];

    if (!this._draft.id)   issues.push("Faction ID is required.");
    if (!this._draft.name) issues.push("Faction name is required.");

    if (this._draft.hostileBelow >= this._draft.friendlyAt) {
      issues.push("hostileBelow must be less than friendlyAt.");
    }
    if (this._draft.friendlyAt >= this._draft.alliedAt) {
      issues.push("friendlyAt must be less than alliedAt.");
    }

    // Check for duplicate relation targets
    const seen = new Set<string>();
    for (const rel of this._draft.relations) {
      if (!rel.targetId) {
        issues.push("Relation has an empty target faction ID.");
      } else if (seen.has(rel.targetId)) {
        issues.push(`Duplicate relation target: "${rel.targetId}".`);
      } else {
        seen.add(rel.targetId);
      }
      if (rel.targetId === this._draft.id) {
        issues.push(`Faction cannot have a relation to itself ("${rel.targetId}").`);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /** Convert the draft to a `FactionDefinition` ready for the `FactionEngine`. */
  toDefinition(): FactionDefinition {
    return {
      id:                this._draft.id,
      name:              this._draft.name,
      description:       this._draft.description || undefined,
      defaultReputation: this._draft.defaultReputation,
      hostileBelow:      this._draft.hostileBelow,
      friendlyAt:        this._draft.friendlyAt,
      alliedAt:          this._draft.alliedAt,
    };
  }

  /**
   * Serialize the full draft (including relations metadata) as a JSON string.
   * The `relations` field is Camelot-editor metadata; it is not part of the
   * raw `FactionDefinition` schema used by `FactionEngine` at runtime.
   */
  exportToJson(): string {
    return JSON.stringify(
      { ...this.toDefinition(), relations: this._draft.relations },
      null,
      2,
    );
  }

  /** Trigger a browser file-download of the draft. No-op in non-browser environments. */
  exportToFile(filename?: string): void {
    if (typeof document === "undefined") return;
    const json = this.exportToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? `${this._draft.id || "faction"}.faction.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /** Load a faction definition from a JSON string. Returns `true` on success. */
  importFromJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as FactionDefinition & {
        relations?: FactionRelationDraft[];
      };
      if (!parsed || typeof parsed.id !== "string") return false;
      this._draft = {
        id:                parsed.id,
        name:              parsed.name,
        description:       parsed.description       ?? "",
        defaultReputation: parsed.defaultReputation ?? 0,
        hostileBelow:      parsed.hostileBelow      ?? DEFAULT_HOSTILE_BELOW,
        friendlyAt:        parsed.friendlyAt        ?? DEFAULT_FRIENDLY_AT,
        alliedAt:          parsed.alliedAt          ?? DEFAULT_ALLIED_AT,
        relations:         Array.isArray(parsed.relations)
          ? parsed.relations.map(r => ({
              targetId:    r.targetId    ?? "",
              disposition: r.disposition ?? "neutral",
              note:        r.note        ?? "",
            }))
          : [],
      };
      this._relationCounter = 0;
      return true;
    } catch {
      return false;
    }
  }

  /** Read a browser `File` and import its JSON content. */
  importFromFile(file: File): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload  = (e) => {
        const text = e.target?.result;
        if (typeof text !== "string") { resolve(false); return; }
        resolve(this.importFromJson(text));
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  /** Discard the current draft and start fresh. */
  reset(): void {
    this._draft = { ...BLANK_DRAFT, relations: [] };
    this._relationCounter = 0;
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get draft(): Readonly<FactionCreatorDraft> { return this._draft; }

  get relations(): readonly FactionRelationDraft[] { return this._draft.relations; }
}
