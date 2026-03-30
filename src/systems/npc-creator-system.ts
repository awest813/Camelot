import type {
  NpcArchetypeDefinition,
  NpcRole,
  DamageType,
  NpcVoiceType,
  NpcPersonalityTrait,
  NpcAIProfile,
} from "../framework/content/content-types";

// ── Constants ─────────────────────────────────────────────────────────────────

export const NPC_ROLES: NpcRole[] = [
  "guard", "merchant", "innkeeper", "villager", "enemy", "boss", "companion",
  "bandit", "healer", "trainer", "beggar",
];

export const DAMAGE_TYPES: DamageType[] = ["physical", "fire", "frost", "shock"];

export const NPC_VOICE_TYPES: NpcVoiceType[] = [
  "neutral", "male_warrior", "female_warrior", "old_man", "old_woman",
  "merchant", "child", "beast", "undead",
];

export const NPC_PERSONALITY_TRAITS: NpcPersonalityTrait[] = [
  "brave", "cowardly", "aggressive", "friendly", "shy", "greedy", "noble", "cunning",
];

// ── Draft type ────────────────────────────────────────────────────────────────

export interface NpcCreatorDraft {
  id: string;
  name: string;
  description: string;
  role: NpcRole;
  factionId: string;
  isHostile: boolean;
  isMerchant: boolean;
  dialogueId: string;
  lootTableId: string;
  baseHealth: number;
  level: number;
  disposition: number;
  patrolGroupId: string;
  respawns: boolean;
  skills: Record<string, number>;
  damageResistances: Partial<Record<DamageType, number>>;
  damageWeaknesses: Partial<Record<DamageType, number>>;
  voiceType: NpcVoiceType;
  personalityTraits: NpcPersonalityTrait[];
  aiProfile: Partial<NpcAIProfile>;
  scheduleId: string;
  startingEquipment: string[];
}

export interface NpcValidationReport {
  valid: boolean;
  issues: string[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const BLANK_DRAFT: NpcCreatorDraft = {
  id:               "",
  name:             "",
  description:      "",
  role:             "villager",
  factionId:        "",
  isHostile:        false,
  isMerchant:       false,
  dialogueId:       "",
  lootTableId:      "",
  baseHealth:       100,
  level:            1,
  disposition:      50,
  patrolGroupId:    "",
  respawns:         false,
  skills:           {},
  damageResistances: {},
  damageWeaknesses:  {},
  voiceType:        "neutral",
  personalityTraits: [],
  aiProfile:        {},
  scheduleId:       "",
  startingEquipment: [],
};

// ── System ────────────────────────────────────────────────────────────────────

/**
 * Headless authoring system for NPC archetype definitions.
 *
 * Manages a mutable `NpcCreatorDraft` with helpers for skills,
 * resistances/weaknesses, personality traits, AI profile overrides,
 * starting equipment, validation, and JSON / file export-import.
 */
export class NpcCreatorSystem {
  private _draft: NpcCreatorDraft;

  constructor(initial?: Partial<NpcCreatorDraft>) {
    this._draft = {
      ...BLANK_DRAFT,
      ...initial,
      skills:            { ...(initial?.skills            ?? {}) },
      damageResistances: { ...(initial?.damageResistances ?? {}) },
      damageWeaknesses:  { ...(initial?.damageWeaknesses  ?? {}) },
      personalityTraits: [ ...(initial?.personalityTraits ?? []) ],
      aiProfile:         { ...(initial?.aiProfile         ?? {}) },
      startingEquipment: [ ...(initial?.startingEquipment ?? []) ],
    };
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  /** Apply a partial set of field updates to the draft. */
  setMeta(fields: Partial<NpcCreatorDraft>): void {
    const strFields  = [
      "id", "name", "description", "factionId", "dialogueId",
      "lootTableId", "patrolGroupId", "scheduleId",
    ] as const;
    const numFields  = ["baseHealth", "level", "disposition"] as const;
    const boolFields = ["isHostile", "isMerchant", "respawns"] as const;

    for (const f of strFields) {
      if (fields[f] !== undefined) (this._draft as unknown as Record<string, unknown>)[f] = (fields[f] as string).trim();
    }
    for (const f of numFields) {
      if (fields[f] !== undefined) (this._draft as unknown as Record<string, unknown>)[f] = Math.max(0, fields[f] as number);
    }
    for (const f of boolFields) {
      if (fields[f] !== undefined) (this._draft as unknown as Record<string, unknown>)[f] = fields[f];
    }
    if (fields.role      !== undefined) this._draft.role      = fields.role;
    if (fields.voiceType !== undefined) this._draft.voiceType = fields.voiceType;
  }

  // ── Skills ────────────────────────────────────────────────────────────────

  /** Set a skill override (clamped to 1–100). */
  setSkill(skillId: string, value: number): void {
    if (!skillId.trim()) return;
    this._draft.skills[skillId.trim()] = Math.max(1, Math.min(100, Math.round(value)));
  }

  /** Remove a skill override. */
  removeSkill(skillId: string): void {
    delete this._draft.skills[skillId];
  }

  // ── Resistances / Weaknesses ──────────────────────────────────────────────

  /** Set a damage resistance (clamped 0–1). */
  setResistance(type: DamageType, value: number): void {
    this._draft.damageResistances[type] = Math.max(0, Math.min(1, value));
  }

  /** Remove a damage resistance entry. */
  removeResistance(type: DamageType): void {
    delete this._draft.damageResistances[type];
  }

  /** Set a damage weakness (clamped 0–2). */
  setWeakness(type: DamageType, value: number): void {
    this._draft.damageWeaknesses[type] = Math.max(0, Math.min(2, value));
  }

  /** Remove a damage weakness entry. */
  removeWeakness(type: DamageType): void {
    delete this._draft.damageWeaknesses[type];
  }

  // ── Personality Traits ────────────────────────────────────────────────────

  /** Add a personality trait. Duplicate traits are silently ignored. */
  addPersonalityTrait(trait: NpcPersonalityTrait): void {
    if (!this._draft.personalityTraits.includes(trait)) {
      this._draft.personalityTraits.push(trait);
    }
  }

  /** Remove a personality trait. No-op if the trait is not present. */
  removePersonalityTrait(trait: NpcPersonalityTrait): void {
    this._draft.personalityTraits = this._draft.personalityTraits.filter(t => t !== trait);
  }

  /** Remove all personality traits from the draft. */
  clearPersonalityTraits(): void {
    this._draft.personalityTraits = [];
  }

  // ── AI Profile ────────────────────────────────────────────────────────────

  /**
   * Set a single AI profile field override.
   * Values are clamped to >= 0 for all fields; fleesBelowHealthPct is additionally clamped to <= 1.
   * Note: validation will flag zero values for fields like aggroRange as invalid.
   */
  setAIProfileField<K extends keyof NpcAIProfile>(field: K, value: NpcAIProfile[K]): void {
    if (field === "fleesBelowHealthPct") {
      (this._draft.aiProfile as Record<string, unknown>)[field] = Math.max(0, Math.min(1, value as number));
    } else {
      (this._draft.aiProfile as Record<string, unknown>)[field] = Math.max(0, value as number);
    }
  }

  /** Remove a single AI profile field, reverting it to the role/entity default. */
  removeAIProfileField(field: keyof NpcAIProfile): void {
    delete (this._draft.aiProfile as Record<string, unknown>)[field];
  }

  /** Clear all AI profile overrides, reverting to role/entity defaults. */
  clearAIProfile(): void {
    this._draft.aiProfile = {};
  }

  // ── Starting Equipment ────────────────────────────────────────────────────

  /** Add an item ID to the starting equipment list. Duplicates are silently ignored. */
  addStartingEquipment(itemId: string): void {
    const trimmed = itemId.trim();
    if (!trimmed) return;
    if (!this._draft.startingEquipment.includes(trimmed)) {
      this._draft.startingEquipment.push(trimmed);
    }
  }

  /** Remove an item ID from the starting equipment list. */
  removeStartingEquipment(itemId: string): void {
    this._draft.startingEquipment = this._draft.startingEquipment.filter(id => id !== itemId);
  }

  /** Clear all starting equipment entries. */
  clearStartingEquipment(): void {
    this._draft.startingEquipment = [];
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /** Validate the current draft for required fields and sane ranges. */
  validate(): NpcValidationReport {
    const issues: string[] = [];
    if (!this._draft.id)   issues.push("NPC ID is required.");
    if (!this._draft.name) issues.push("NPC name is required.");
    if (this._draft.level < 1)         issues.push("Level must be at least 1.");
    if (this._draft.baseHealth < 1)    issues.push("Base health must be at least 1.");
    if (this._draft.disposition < 0 || this._draft.disposition > 100) {
      issues.push("Disposition must be between 0 and 100.");
    }
    const ai = this._draft.aiProfile;
    if (ai.aggroRange      !== undefined && ai.aggroRange      <= 0) issues.push("AI aggroRange must be > 0.");
    if (ai.attackRange     !== undefined && ai.attackRange     <= 0) issues.push("AI attackRange must be > 0.");
    if (ai.attackDamage    !== undefined && ai.attackDamage    <= 0) issues.push("AI attackDamage must be > 0.");
    if (ai.attackCooldown  !== undefined && ai.attackCooldown  <= 0) issues.push("AI attackCooldown must be > 0.");
    if (ai.moveSpeed       !== undefined && ai.moveSpeed       <= 0) issues.push("AI moveSpeed must be > 0.");
    if (ai.fleesBelowHealthPct !== undefined && (ai.fleesBelowHealthPct < 0 || ai.fleesBelowHealthPct > 1)) {
      issues.push("AI fleesBelowHealthPct must be between 0 and 1.");
    }
    return { valid: issues.length === 0, issues };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /** Convert the draft to an `NpcArchetypeDefinition`. */
  toDefinition(): NpcArchetypeDefinition {
    return {
      id:               this._draft.id,
      name:             this._draft.name,
      description:      this._draft.description  || undefined,
      role:             this._draft.role,
      factionId:        this._draft.factionId    || undefined,
      isHostile:        this._draft.isHostile,
      isMerchant:       this._draft.isMerchant,
      dialogueId:       this._draft.dialogueId   || undefined,
      lootTableId:      this._draft.lootTableId  || undefined,
      baseHealth:       this._draft.baseHealth,
      level:            this._draft.level,
      skills:           Object.keys(this._draft.skills).length > 0
                          ? { ...this._draft.skills }
                          : undefined,
      disposition:      this._draft.disposition,
      patrolGroupId:    this._draft.patrolGroupId || undefined,
      respawns:         this._draft.respawns      || undefined,
      damageResistances: Object.keys(this._draft.damageResistances).length > 0
                          ? { ...this._draft.damageResistances }
                          : undefined,
      damageWeaknesses:  Object.keys(this._draft.damageWeaknesses).length > 0
                          ? { ...this._draft.damageWeaknesses }
                          : undefined,
      voiceType:         this._draft.voiceType !== "neutral" ? this._draft.voiceType : undefined,
      personalityTraits: this._draft.personalityTraits.length > 0
                          ? [...this._draft.personalityTraits]
                          : undefined,
      aiProfile:         Object.keys(this._draft.aiProfile).length > 0
                          ? { ...this._draft.aiProfile }
                          : undefined,
      scheduleId:        this._draft.scheduleId || undefined,
      startingEquipment: this._draft.startingEquipment.length > 0
                          ? [...this._draft.startingEquipment]
                          : undefined,
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
    a.download = filename ?? `${this._draft.id || "npc"}.npc.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /** Load an `NpcArchetypeDefinition` from a JSON string. Returns `true` on success. */
  importFromJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as NpcArchetypeDefinition;
      if (!parsed || typeof parsed.id !== "string") return false;
      this._draft = {
        id:               parsed.id,
        name:             parsed.name,
        description:      parsed.description   ?? "",
        role:             parsed.role,
        factionId:        parsed.factionId     ?? "",
        isHostile:        parsed.isHostile,
        isMerchant:       parsed.isMerchant,
        dialogueId:       parsed.dialogueId    ?? "",
        lootTableId:      parsed.lootTableId   ?? "",
        baseHealth:       parsed.baseHealth,
        level:            parsed.level,
        disposition:      parsed.disposition   ?? 50,
        patrolGroupId:    parsed.patrolGroupId ?? "",
        respawns:         parsed.respawns      ?? false,
        skills:            parsed.skills            ? { ...parsed.skills }            : {},
        damageResistances: parsed.damageResistances ? { ...parsed.damageResistances } : {},
        damageWeaknesses:  parsed.damageWeaknesses  ? { ...parsed.damageWeaknesses }  : {},
        voiceType:         parsed.voiceType         ?? "neutral",
        personalityTraits: parsed.personalityTraits ? [...parsed.personalityTraits]  : [],
        aiProfile:         parsed.aiProfile         ? { ...parsed.aiProfile }         : {},
        scheduleId:        parsed.scheduleId        ?? "",
        startingEquipment: parsed.startingEquipment ? [...parsed.startingEquipment]  : [],
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
    this._draft = {
      ...BLANK_DRAFT,
      skills: {}, damageResistances: {}, damageWeaknesses: {},
      personalityTraits: [], aiProfile: {}, startingEquipment: [],
    };
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get draft(): Readonly<NpcCreatorDraft> { return this._draft; }
}
