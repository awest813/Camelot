import type { NpcCreatorSystem, NpcCreatorDraft } from "../systems/npc-creator-system";
import { NPC_ROLES, DAMAGE_TYPES, NPC_VOICE_TYPES, NPC_PERSONALITY_TRAITS } from "../systems/npc-creator-system";
import type { DamageType, NpcAIProfile } from "../framework/content/content-types";

const AI_FIELDS: { field: keyof NpcAIProfile; label: string; min: string; max: string; step: string }[] = [
  { field: "aggroRange",           label: "Aggro Range",             min: "0", max: "100", step: "0.5"  },
  { field: "attackRange",          label: "Attack Range",            min: "0", max: "20",  step: "0.1"  },
  { field: "attackDamage",         label: "Attack Damage",           min: "0", max: "999", step: "1"    },
  { field: "attackCooldown",       label: "Attack Cooldown (s)",     min: "0", max: "30",  step: "0.1"  },
  { field: "moveSpeed",            label: "Move Speed",              min: "0", max: "20",  step: "0.1"  },
  { field: "fleesBelowHealthPct",  label: "Flee Below Health (0–1)", min: "0", max: "1",   step: "0.05" },
];

/**
 * HTML-based NPC Archetype Creator overlay.
 *
 * Three-column layout:
 *   1. Identity  — id, name, description, role, flags
 *   2. Stats     — level, health, disposition, links (faction / dialogue / loot / patrol)
 *   3. Advanced  — skill overrides, damage resistances, damage weaknesses
 *
 * Actions: Validate, Export JSON ↓, Import JSON ↑, Reset, Close.
 */
export class NpcCreatorUI {
  public onClose: (() => void) | null = null;

  private readonly _sys: NpcCreatorSystem;
  private _root: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;

  // Identity inputs
  private _idInp!: HTMLInputElement;
  private _nameInp!: HTMLInputElement;
  private _descInp!: HTMLInputElement;
  private _roleSel!: HTMLSelectElement;
  private _hostileChk!: HTMLInputElement;
  private _merchantChk!: HTMLInputElement;
  private _respawnChk!: HTMLInputElement;

  // Stats inputs
  private _healthInp!: HTMLInputElement;
  private _levelInp!: HTMLInputElement;
  private _disposInp!: HTMLInputElement;
  private _factionInp!: HTMLInputElement;
  private _dialogueInp!: HTMLInputElement;
  private _lootInp!: HTMLInputElement;
  private _patrolInp!: HTMLInputElement;

  // Advanced dynamic sections
  private _skillsEl!: HTMLElement;
  private _resEl!: HTMLElement;
  private _weakEl!: HTMLElement;
  private _aiProfileEl!: HTMLElement;
  private _equipmentEl!: HTMLElement;

  // Identity extras
  private _voiceSel!: HTMLSelectElement;
  private _traitCheckboxes: Map<string, HTMLInputElement> = new Map();

  // Stats extras
  private _scheduleInp!: HTMLInputElement;

  constructor(system: NpcCreatorSystem) {
    this._sys = system;
  }

  get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  open(): void {
    if (this._root) {
      this._root.hidden = false;
      this._syncFromDraft();
      return;
    }
    this._build();
  }

  close(): void {
    if (this._root) this._root.hidden = true;
    this.onClose?.();
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private _build(): void {
    const root = document.createElement("div");
    root.className = "npc-creator";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "NPC Creator");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "npc-creator__panel";
    root.appendChild(panel);

    // Header
    const header = document.createElement("div");
    header.className = "npc-creator__header";
    const title = document.createElement("h2");
    title.className = "npc-creator__title";
    title.textContent = "NPC Creator";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className = "npc-creator__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close NPC creator");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body — three columns
    const body = document.createElement("div");
    body.className = "npc-creator__body";
    body.appendChild(this._buildIdentitySection());
    body.appendChild(this._buildStatsSection());
    body.appendChild(this._buildAdvancedSection());
    panel.appendChild(body);

    // Footer
    panel.appendChild(this._buildFooter());

    document.body.appendChild(root);
    this._syncFromDraft();
  }

  // ── Sections ───────────────────────────────────────────────────────────────

  private _buildIdentitySection(): HTMLElement {
    const sec = this._makeSection("Identity");

    this._idInp   = this._addField(sec, "NPC ID",      "text",   "e.g. npc_innkeeper_01");
    this._nameInp = this._addField(sec, "Name",         "text",   "e.g. Roland the Innkeeper");
    this._descInp = this._addField(sec, "Description",  "text",   "Brief flavour text");

    // Role select
    const roleWrap = document.createElement("div");
    roleWrap.className = "npc-creator__field";
    const roleLbl = document.createElement("label");
    roleLbl.className   = "npc-creator__label";
    roleLbl.textContent = "Role";
    this._roleSel = document.createElement("select");
    this._roleSel.className = "npc-creator__select";
    for (const r of NPC_ROLES) {
      const opt = document.createElement("option");
      opt.value = opt.textContent = r;
      this._roleSel.appendChild(opt);
    }
    roleLbl.htmlFor = this._roleSel.id = "npcc_role";
    this._roleSel.addEventListener("change", () => this._sys.setMeta({ role: this._roleSel.value as NpcCreatorDraft["role"] }));
    roleWrap.appendChild(roleLbl);
    roleWrap.appendChild(this._roleSel);
    sec.appendChild(roleWrap);

    // Flags
    this._hostileChk  = this._addCheckbox(sec, "Hostile on sight", "npcc_hostile");
    this._merchantChk = this._addCheckbox(sec, "Offers merchant services", "npcc_merchant");
    this._respawnChk  = this._addCheckbox(sec, "Respawns after death", "npcc_respawn");

    // Voice type
    const voiceWrap = document.createElement("div");
    voiceWrap.className = "npc-creator__field";
    const voiceLbl = document.createElement("label");
    voiceLbl.className   = "npc-creator__label";
    voiceLbl.textContent = "Voice Type";
    this._voiceSel = document.createElement("select");
    this._voiceSel.className = "npc-creator__select";
    for (const v of NPC_VOICE_TYPES) {
      const opt = document.createElement("option");
      opt.value = opt.textContent = v;
      this._voiceSel.appendChild(opt);
    }
    voiceLbl.htmlFor = this._voiceSel.id = "npcc_voice_type";
    this._voiceSel.addEventListener("change", () => this._sys.setMeta({ voiceType: this._voiceSel.value as NpcCreatorDraft["voiceType"] }));
    voiceWrap.appendChild(voiceLbl);
    voiceWrap.appendChild(this._voiceSel);
    sec.appendChild(voiceWrap);

    // Personality traits
    const traitTitle = document.createElement("p");
    traitTitle.className   = "npc-creator__section-sep";
    traitTitle.textContent = "Personality Traits";
    sec.appendChild(traitTitle);

    const traitsWrap = document.createElement("div");
    traitsWrap.className = "npc-creator__traits-grid";
    for (const trait of NPC_PERSONALITY_TRAITS) {
      const chk = this._addCheckbox(traitsWrap, trait, `npcc_trait_${trait}`);
      this._traitCheckboxes.set(trait, chk);
      chk.addEventListener("change", () => {
        if (chk.checked) {
          this._sys.addPersonalityTrait(trait as NpcCreatorDraft["personalityTraits"][number]);
        } else {
          this._sys.removePersonalityTrait(trait as NpcCreatorDraft["personalityTraits"][number]);
        }
      });
    }
    sec.appendChild(traitsWrap);

    // Sync flags on change
    this._hostileChk.addEventListener("change",  () => this._sys.setMeta({ isHostile:  this._hostileChk.checked }));
    this._merchantChk.addEventListener("change", () => this._sys.setMeta({ isMerchant: this._merchantChk.checked }));
    this._respawnChk.addEventListener("change",  () => this._sys.setMeta({ respawns:   this._respawnChk.checked }));

    // Sync string fields on input
    const syncStr = () => this._sys.setMeta({
      id:          this._idInp.value,
      name:        this._nameInp.value,
      description: this._descInp.value,
    });
    this._idInp.addEventListener("input",   syncStr);
    this._nameInp.addEventListener("input", syncStr);
    this._descInp.addEventListener("input", syncStr);

    return sec;
  }

  private _buildStatsSection(): HTMLElement {
    const sec = this._makeSection("Stats & Links");

    this._levelInp  = this._addField(sec, "Level",              "number", "1");
    this._healthInp = this._addField(sec, "Base Health",         "number", "100");
    this._disposInp = this._addField(sec, "Disposition (0–100)", "number", "50");

    const sepLabel = document.createElement("p");
    sepLabel.className   = "npc-creator__section-sep";
    sepLabel.textContent = "Linked IDs (optional)";
    sec.appendChild(sepLabel);

    this._factionInp  = this._addField(sec, "Faction ID",      "text", "e.g. faction_guards");
    this._dialogueInp = this._addField(sec, "Dialogue ID",     "text", "e.g. dlg_innkeeper_greeting");
    this._lootInp     = this._addField(sec, "Loot Table ID",   "text", "e.g. humanoid_common");
    this._patrolInp   = this._addField(sec, "Patrol Group ID", "text", "e.g. patrol_group_01");
    this._scheduleInp = this._addField(sec, "Schedule ID",     "text", "e.g. sched_innkeeper");

    const syncNum = () => this._sys.setMeta({
      level:       parseFloat(this._levelInp.value)  || 1,
      baseHealth:  parseFloat(this._healthInp.value) || 100,
      disposition: parseFloat(this._disposInp.value) || 50,
    });
    const syncLinks = () => this._sys.setMeta({
      factionId:    this._factionInp.value,
      dialogueId:   this._dialogueInp.value,
      lootTableId:  this._lootInp.value,
      patrolGroupId: this._patrolInp.value,
      scheduleId:   this._scheduleInp.value,
    });

    for (const el of [this._levelInp, this._healthInp, this._disposInp]) el.addEventListener("input", syncNum);
    for (const el of [this._factionInp, this._dialogueInp, this._lootInp, this._patrolInp, this._scheduleInp]) el.addEventListener("input", syncLinks);

    return sec;
  }

  private _buildAdvancedSection(): HTMLElement {
    const sec = this._makeSection("Advanced");

    // Skills
    const skillTitle = document.createElement("p");
    skillTitle.className   = "npc-creator__section-sep";
    skillTitle.textContent = "Skill Overrides";
    sec.appendChild(skillTitle);

    this._skillsEl = document.createElement("div");
    this._skillsEl.className = "npc-creator__kv-list";
    sec.appendChild(this._skillsEl);

    sec.appendChild(this._buildAddKvRow("Add Skill", "skill ID", "rank (1–100)", (k, v) => {
      this._sys.setSkill(k, parseFloat(v) || 50);
      this._renderSkills();
    }));

    // Resistances
    const resTitle = document.createElement("p");
    resTitle.className   = "npc-creator__section-sep";
    resTitle.textContent = "Damage Resistances (0–1)";
    sec.appendChild(resTitle);

    this._resEl = document.createElement("div");
    this._resEl.className = "npc-creator__kv-list";
    sec.appendChild(this._resEl);

    sec.appendChild(this._buildDamageTypeRow("Add Resistance", (type, val) => {
      this._sys.setResistance(type, val);
      this._renderResistances();
    }));

    // Weaknesses
    const weakTitle = document.createElement("p");
    weakTitle.className   = "npc-creator__section-sep";
    weakTitle.textContent = "Damage Weaknesses (0–2)";
    sec.appendChild(weakTitle);

    this._weakEl = document.createElement("div");
    this._weakEl.className = "npc-creator__kv-list";
    sec.appendChild(this._weakEl);

    sec.appendChild(this._buildDamageTypeRow("Add Weakness", (type, val) => {
      this._sys.setWeakness(type, val);
      this._renderWeaknesses();
    }));

    // AI Profile overrides
    const aiTitle = document.createElement("p");
    aiTitle.className   = "npc-creator__section-sep";
    aiTitle.textContent = "AI Profile Overrides";
    sec.appendChild(aiTitle);

    this._aiProfileEl = document.createElement("div");
    this._aiProfileEl.className = "npc-creator__kv-list";
    sec.appendChild(this._aiProfileEl);

    for (const { field, label, min, max, step } of AI_FIELDS) {
      const row = document.createElement("div");
      row.className = "npc-creator__add-kv-row";
      const lbl = document.createElement("label");
      lbl.className   = "npc-creator__label npc-creator__label--sm";
      lbl.textContent = label;
      const inp = document.createElement("input");
      inp.type        = "number";
      inp.className   = "npc-creator__input npc-creator__input--sm";
      inp.placeholder = "default";
      inp.min = min; inp.max = max; inp.step = step;
      inp.id = `npcc_ai_${field}`;
      lbl.htmlFor = inp.id;
      const setBtn = document.createElement("button");
      setBtn.className   = "npc-creator__btn npc-creator__btn--sm";
      setBtn.textContent = "Set";
      setBtn.addEventListener("click", () => {
        if (inp.value === "") return;
        this._sys.setAIProfileField(field, parseFloat(inp.value) as NpcAIProfile[typeof field]);
        this._renderAIProfile();
      });
      const clrBtn = document.createElement("button");
      clrBtn.className   = "npc-creator__btn npc-creator__btn--sm npc-creator__btn--danger";
      clrBtn.textContent = "Clear";
      clrBtn.addEventListener("click", () => {
        this._sys.removeAIProfileField(field);
        inp.value = "";
        this._renderAIProfile();
      });
      row.appendChild(lbl);
      row.appendChild(inp);
      row.appendChild(setBtn);
      row.appendChild(clrBtn);
      sec.appendChild(row);
    }

    // Starting Equipment
    const equipTitle = document.createElement("p");
    equipTitle.className   = "npc-creator__section-sep";
    equipTitle.textContent = "Starting Equipment";
    sec.appendChild(equipTitle);

    this._equipmentEl = document.createElement("div");
    this._equipmentEl.className = "npc-creator__kv-list";
    sec.appendChild(this._equipmentEl);

    sec.appendChild(this._buildAddKvRow("Add Item", "item ID", "", (k) => {
      this._sys.addStartingEquipment(k);
      this._renderEquipment();
    }));

    return sec;
  }

  // ── Dynamic sub-renderers ──────────────────────────────────────────────────

  private _renderSkills(): void {
    if (!this._skillsEl) return;
    this._skillsEl.innerHTML = "";
    const skills = this._sys.draft.skills;
    for (const [skillId, rank] of Object.entries(skills)) {
      this._skillsEl.appendChild(
        this._makeKvRow(skillId, String(rank), () => {
          this._sys.removeSkill(skillId);
          this._renderSkills();
        }),
      );
    }
    if (Object.keys(skills).length === 0) {
      const empty = document.createElement("p");
      empty.className   = "npc-creator__empty";
      empty.textContent = "No overrides — NPC uses default skill values.";
      this._skillsEl.appendChild(empty);
    }
  }

  private _renderResistances(): void {
    if (!this._resEl) return;
    this._resEl.innerHTML = "";
    const res = this._sys.draft.damageResistances;
    const hasAny = DAMAGE_TYPES.some(t => res[t] !== undefined);
    for (const type of DAMAGE_TYPES) {
      if (res[type] === undefined) continue;
      this._resEl.appendChild(
        this._makeKvRow(type, String(res[type]), () => {
          this._sys.removeResistance(type);
          this._renderResistances();
        }),
      );
    }
    if (!hasAny) {
      const empty = document.createElement("p");
      empty.className   = "npc-creator__empty";
      empty.textContent = "No resistances — all damage types unmodified.";
      this._resEl.appendChild(empty);
    }
  }

  private _renderWeaknesses(): void {
    if (!this._weakEl) return;
    this._weakEl.innerHTML = "";
    const weak = this._sys.draft.damageWeaknesses;
    const hasAny = DAMAGE_TYPES.some(t => weak[t] !== undefined);
    for (const type of DAMAGE_TYPES) {
      if (weak[type] === undefined) continue;
      this._weakEl.appendChild(
        this._makeKvRow(type, String(weak[type]), () => {
          this._sys.removeWeakness(type);
          this._renderWeaknesses();
        }),
      );
    }
    if (!hasAny) {
      const empty = document.createElement("p");
      empty.className   = "npc-creator__empty";
      empty.textContent = "No weaknesses.";
      this._weakEl.appendChild(empty);
    }
  }

  private _renderAIProfile(): void {
    if (!this._aiProfileEl) return;
    this._aiProfileEl.innerHTML = "";
    const ai = this._sys.draft.aiProfile;
    const keys = Object.keys(ai) as (keyof typeof ai)[];
    if (keys.length === 0) {
      const empty = document.createElement("p");
      empty.className   = "npc-creator__empty";
      empty.textContent = "No overrides — NPC uses role/entity defaults.";
      this._aiProfileEl.appendChild(empty);
      return;
    }
    for (const key of keys) {
      this._aiProfileEl.appendChild(
        this._makeKvRow(key, String(ai[key]), () => {
          this._sys.removeAIProfileField(key);
          this._renderAIProfile();
        }),
      );
    }
  }

  private _renderEquipment(): void {
    if (!this._equipmentEl) return;
    this._equipmentEl.innerHTML = "";
    const items = this._sys.draft.startingEquipment;
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className   = "npc-creator__empty";
      empty.textContent = "No starting equipment.";
      this._equipmentEl.appendChild(empty);
      return;
    }
    for (const itemId of items) {
      this._equipmentEl.appendChild(
        this._makeKvRow(itemId, "", () => {
          this._sys.removeStartingEquipment(itemId);
          this._renderEquipment();
        }),
      );
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────────

  private _buildFooter(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "npc-creator__footer";

    const status = document.createElement("p");
    status.className = "npc-creator__status";
    this._statusEl = status;
    footer.appendChild(status);

    const actions = document.createElement("div");
    actions.className = "npc-creator__actions";

    actions.appendChild(this._makeBtn("Validate",     "npc-creator__btn",                          () => this._handleValidate()));
    actions.appendChild(this._makeBtn("Export JSON ↓","npc-creator__btn npc-creator__btn--primary", () => this._handleExport()));
    actions.appendChild(this._makeBtn("Import JSON ↑","npc-creator__btn",                          () => this._handleImport()));
    actions.appendChild(this._makeBtn("Reset",        "npc-creator__btn npc-creator__btn--danger",  () => this._handleReset()));

    footer.appendChild(actions);
    return footer;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _makeSection(title: string): HTMLElement {
    const sec = document.createElement("div");
    sec.className = "npc-creator__section";
    const h3 = document.createElement("h3");
    h3.className   = "npc-creator__section-title";
    h3.textContent = title;
    sec.appendChild(h3);
    return sec;
  }

  private _addField(container: HTMLElement, label: string, type: string, placeholder: string): HTMLInputElement {
    const wrap = document.createElement("div");
    wrap.className = "npc-creator__field";
    const lbl = document.createElement("label");
    lbl.className   = "npc-creator__label";
    lbl.textContent = label;
    const inp = document.createElement("input");
    inp.type        = type;
    inp.className   = "npc-creator__input";
    inp.placeholder = placeholder;
    if (type === "number") { inp.min = "0"; inp.step = "1"; }
    lbl.htmlFor = inp.id = `npcc_${label.replace(/\s+/g, "_").toLowerCase()}`;
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    container.appendChild(wrap);
    return inp;
  }

  private _addCheckbox(container: HTMLElement, label: string, id: string): HTMLInputElement {
    const row = document.createElement("div");
    row.className = "npc-creator__field npc-creator__field--inline";
    const chk = document.createElement("input");
    chk.type      = "checkbox";
    chk.id        = id;
    chk.className = "npc-creator__checkbox";
    const lbl = document.createElement("label");
    lbl.htmlFor     = id;
    lbl.className   = "npc-creator__label";
    lbl.textContent = label;
    row.appendChild(chk);
    row.appendChild(lbl);
    container.appendChild(row);
    return chk;
  }

  private _buildAddKvRow(
    btnLabel: string,
    kPlaceholder: string,
    vPlaceholder: string,
    onAdd: (k: string, v: string) => void,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "npc-creator__add-kv-row";
    const kInp = document.createElement("input");
    kInp.className   = "npc-creator__input npc-creator__input--sm";
    kInp.placeholder = kPlaceholder;
    kInp.type        = "text";
    const vInp = document.createElement("input");
    vInp.className   = "npc-creator__input npc-creator__input--sm";
    vInp.placeholder = vPlaceholder;
    vInp.type        = "text";
    const btn = document.createElement("button");
    btn.className   = "npc-creator__btn npc-creator__btn--sm";
    btn.textContent = btnLabel;
    btn.addEventListener("click", () => {
      if (!kInp.value.trim()) return;
      onAdd(kInp.value.trim(), vInp.value.trim());
      kInp.value = "";
      vInp.value = "";
    });
    row.appendChild(kInp);
    row.appendChild(vInp);
    row.appendChild(btn);
    return row;
  }

  private _buildDamageTypeRow(
    btnLabel: string,
    onAdd: (type: DamageType, val: number) => void,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "npc-creator__add-kv-row";

    const typeSel = document.createElement("select");
    typeSel.className = "npc-creator__select npc-creator__select--sm";
    for (const t of DAMAGE_TYPES) {
      const opt = document.createElement("option");
      opt.value = opt.textContent = t;
      typeSel.appendChild(opt);
    }

    const valInp = document.createElement("input");
    valInp.className   = "npc-creator__input npc-creator__input--sm";
    valInp.placeholder = "0.0 – 1.0";
    valInp.type        = "number";
    valInp.min         = "0";
    valInp.max         = "2";
    valInp.step        = "0.05";

    const btn = document.createElement("button");
    btn.className   = "npc-creator__btn npc-creator__btn--sm";
    btn.textContent = btnLabel;
    btn.addEventListener("click", () => {
      onAdd(typeSel.value as DamageType, parseFloat(valInp.value) || 0);
      valInp.value = "";
    });

    row.appendChild(typeSel);
    row.appendChild(valInp);
    row.appendChild(btn);
    return row;
  }

  private _makeKvRow(key: string, value: string, onRemove: () => void): HTMLElement {
    const row = document.createElement("div");
    row.className = "npc-creator__kv-row";
    const keyEl = document.createElement("code");
    keyEl.className   = "npc-creator__kv-key";
    keyEl.textContent = key;
    const valEl = document.createElement("span");
    valEl.className   = "npc-creator__kv-val";
    valEl.textContent = value;
    const rmBtn = document.createElement("button");
    rmBtn.className   = "npc-creator__btn npc-creator__btn--sm npc-creator__btn--danger";
    rmBtn.textContent = "✕";
    rmBtn.setAttribute("aria-label", "Remove");
    rmBtn.addEventListener("click", onRemove);
    row.appendChild(keyEl);
    row.appendChild(valEl);
    row.appendChild(rmBtn);
    return row;
  }

  private _makeBtn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className   = cls;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  private _handleValidate(): void {
    const report = this._sys.validate();
    if (report.valid) {
      this._setStatus("✔ Validation passed — NPC definition is valid.", "ok");
    } else {
      this._setStatus(`✖ ${report.issues.join(" | ")}`, "error");
    }
  }

  private _handleExport(): void {
    this._sys.exportToFile();
    this._setStatus("NPC archetype exported as JSON file.", "ok");
  }

  private _handleImport(): void {
    const input = document.createElement("input");
    input.type   = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const ok = await this._sys.importFromFile(file);
      if (ok) {
        this._syncFromDraft();
        this._setStatus(`Imported NPC "${this._sys.draft.name}" successfully.`, "ok");
      } else {
        this._setStatus("Import failed — invalid NPC JSON file.", "error");
      }
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }

  private _handleReset(): void {
    this._sys.reset();
    this._syncFromDraft();
    this._setStatus("Draft reset to blank.", "ok");
  }

  // ── Sync ───────────────────────────────────────────────────────────────────

  private _syncFromDraft(): void {
    const d = this._sys.draft;
    this._idInp.value        = d.id;
    this._nameInp.value      = d.name;
    this._descInp.value      = d.description;
    this._roleSel.value      = d.role;
    this._hostileChk.checked  = d.isHostile;
    this._merchantChk.checked = d.isMerchant;
    this._respawnChk.checked  = d.respawns;
    this._voiceSel.value     = d.voiceType;
    for (const [trait, chk] of this._traitCheckboxes) {
      chk.checked = d.personalityTraits.includes(trait as NpcCreatorDraft["personalityTraits"][number]);
    }
    this._healthInp.value    = String(d.baseHealth);
    this._levelInp.value     = String(d.level);
    this._disposInp.value    = String(d.disposition);
    this._factionInp.value   = d.factionId;
    this._dialogueInp.value  = d.dialogueId;
    this._lootInp.value      = d.lootTableId;
    this._patrolInp.value    = d.patrolGroupId;
    this._scheduleInp.value  = d.scheduleId;
    this._renderSkills();
    this._renderResistances();
    this._renderWeaknesses();
    this._renderAIProfile();
    this._renderEquipment();
  }

  private _setStatus(message: string, type: "ok" | "error" | ""): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.className = `npc-creator__status${type ? ` npc-creator__status--${type}` : ""}`;
  }
}
