import type { ItemDefinition, EquipSlot } from "../framework/inventory/inventory-types";

// ── Constants ─────────────────────────────────────────────────────────────────

export const EQUIP_SLOTS: Array<EquipSlot | ""> = [
  "", "mainHand", "offHand", "head", "chest", "legs", "feet",
];

export const ITEM_TAGS = [
  "weapon", "armor", "shield", "consumable", "potion", "ingredient",
  "key", "misc", "book", "soul_gem", "enchanted", "quest", "gold",
] as const;

// ── Draft type ────────────────────────────────────────────────────────────────

export interface ItemCreatorDraft {
  id: string;
  name: string;
  description: string;
  stackable: boolean;
  maxStack: number;
  slot: EquipSlot | "";
  tags: string[];
}

export interface ItemValidationReport {
  valid: boolean;
  issues: string[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const BLANK_DRAFT: ItemCreatorDraft = {
  id:          "",
  name:        "",
  description: "",
  stackable:   false,
  maxStack:    1,
  slot:        "",
  tags:        [],
};

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Headless authoring system for item definitions.
 *
 * Manages a mutable `ItemCreatorDraft` with helpers for tags,
 * validation, and JSON / file export-import.
 */
export class ItemCreatorSystem {
  private _draft: ItemCreatorDraft;

  constructor(initial?: Partial<ItemCreatorDraft>) {
    this._draft = {
      ...BLANK_DRAFT,
      ...initial,
      tags: [...(initial?.tags ?? [])],
    };
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  /** Apply a partial set of field updates to the draft. */
  setMeta(fields: Partial<ItemCreatorDraft>): void {
    if (fields.id          !== undefined) this._draft.id          = fields.id.trim();
    if (fields.name        !== undefined) this._draft.name        = fields.name.trim();
    if (fields.description !== undefined) this._draft.description = fields.description.trim();
    if (fields.stackable   !== undefined) this._draft.stackable   = fields.stackable;
    if (fields.maxStack    !== undefined) this._draft.maxStack    = Math.max(1, Math.round(fields.maxStack));
    if (fields.slot        !== undefined) this._draft.slot        = fields.slot;
    if (fields.tags        !== undefined) this._draft.tags        = [...fields.tags];
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  /** Add a tag (no-op if already present or empty). */
  addTag(tag: string): void {
    const t = tag.trim();
    if (!t || this._draft.tags.includes(t)) return;
    this._draft.tags.push(t);
  }

  /** Remove a tag. */
  removeTag(tag: string): void {
    this._draft.tags = this._draft.tags.filter(t => t !== tag);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /** Validate the current draft for required fields. */
  validate(): ItemValidationReport {
    const issues: string[] = [];
    if (!this._draft.id)          issues.push("Item ID is required.");
    if (!this._draft.name)        issues.push("Item name is required.");
    if (!this._draft.description) issues.push("Item description is required.");
    if (this._draft.stackable && this._draft.maxStack < 2) {
      issues.push("Stackable items should have max stack ≥ 2.");
    }
    return { valid: issues.length === 0, issues };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /** Convert the draft to an `ItemDefinition`. */
  toDefinition(): ItemDefinition {
    return {
      id:          this._draft.id,
      name:        this._draft.name,
      description: this._draft.description,
      stackable:   this._draft.stackable,
      maxStack:    this._draft.stackable ? this._draft.maxStack : undefined,
      slot:        this._draft.slot      || undefined,
      tags:        this._draft.tags.length > 0 ? [...this._draft.tags] : undefined,
    };
  }

  /** Serialize the draft as pretty-printed JSON. */
  exportToJson(): string {
    return JSON.stringify(this.toDefinition(), null, 2);
  }

  /** Trigger a browser file-download of the draft. No-op in non-browser environments. */
  exportToFile(filename?: string): void {
    if (typeof document === "undefined") return;
    const json = this.exportToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename ?? `${this._draft.id || "item"}.item.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /** Load an `ItemDefinition` from a JSON string. Returns `true` on success. */
  importFromJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as ItemDefinition;
      if (!parsed || typeof parsed.id !== "string") return false;
      this._draft = {
        id:          parsed.id,
        name:        parsed.name,
        description: parsed.description,
        stackable:   parsed.stackable,
        maxStack:    parsed.maxStack ?? 1,
        slot:        parsed.slot    ?? "",
        tags:        parsed.tags    ? [...parsed.tags] : [],
      };
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
    this._draft = { ...BLANK_DRAFT, tags: [] };
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get draft(): Readonly<ItemCreatorDraft> { return this._draft; }
}
