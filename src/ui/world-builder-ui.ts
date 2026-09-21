import {
  WorldBuilderSystem,
  type WorldGenConfig,
  type WorldRegion,
  type ChunkCellSample,
} from "../systems/world-builder-system";
import { manageDialogFocus, type DialogFocusSession } from "./dialog-focus";
import type { WorldSeed, WorldType, BiomeScale, StructureDensity } from "../world/world-seed";
import type { BiomeType } from "../world/world-manager";

// ── Biome Color Palette for Canvas Minimap ────────────────────────────────────

export const BIOME_PREVIEW_COLORS: Record<BiomeType, string> = {
  plains: "#4caf50",
  forest: "#1b5e20",
  desert: "#d97706",
  tundra: "#60a5fa",
};

/**
 * WorldBuilderUI — Graphical macro world authoring overlay.
 *
 * Provides:
 *   - Real-time 2D chunk grid minimap preview with interactive cell hover inspector
 *   - Live generation parameter controls (Seed, World Type, Biome Scale, Structure Density, Elevation, Vegetation, Temperature)
 *   - Preset loader and custom preset library
 *   - Custom region authoring (bounds, biome, danger level, encounter rate)
 *   - "Apply to Game World" action wired directly to the active WorldManager
 *   - JSON import / export
 */
export class WorldBuilderUI {
  public onClose: (() => void) | null = null;
  public onApplyToWorld: ((seed: WorldSeed, config: WorldGenConfig) => void) | null = null;

  private readonly _sys: WorldBuilderSystem;
  private _root: HTMLElement | null = null;
  private _focusSession: DialogFocusSession | null = null;

  // Form controls
  private _presetSelect!: HTMLSelectElement;
  private _seedInput!: HTMLInputElement;
  private _worldTypeSelect!: HTMLSelectElement;
  private _biomeScaleSelect!: HTMLSelectElement;
  private _structureDensitySelect!: HTMLSelectElement;
  private _startingBiomeSelect!: HTMLSelectElement;
  private _elevationInput!: HTMLInputElement;
  private _elevationValSpan!: HTMLElement;
  private _vegetationInput!: HTMLInputElement;
  private _vegetationValSpan!: HTMLElement;
  private _temperatureInput!: HTMLInputElement;
  private _temperatureValSpan!: HTMLElement;

  // Preview elements
  private _canvas: HTMLCanvasElement | null = null;
  private _tooltipEl: HTMLElement | null = null;
  private _radius: number = 7;
  private _cachedSamples: ChunkCellSample[][] | null = null;
  private _showRelief: boolean = true;
  private _showProvinces: boolean = true;
  private _showRoads: boolean = true;
  private _showRivers: boolean = true;

  // Region and Status elements
  private _regionListEl: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;

  constructor(system: WorldBuilderSystem) {
    this._sys = system;
  }

  public get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  public open(): void {
    if (this._root) {
      this._root.hidden = false;
      this._syncControlsFromConfig();
      this._renderRegions();
      this.renderPreview();
      if (!this._focusSession) {
        this._focusSession = manageDialogFocus(this._root);
      }
      return;
    }

    this._build();
    if (this._root && !this._focusSession) {
      this._focusSession = manageDialogFocus(this._root);
    }
  }

  public close(): void {
    if (this._root) {
      this._root.hidden = true;
    }
    this._focusSession?.release();
    this._focusSession = null;
    this.onClose?.();
  }

  public destroy(): void {
    this.close();
    if (this._root?.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
    this._root = null;
  }

  // ── Build DOM ──────────────────────────────────────────────────────────────

  private _build(): void {
    const root = document.createElement("div");
    root.className = "world-builder";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "World Builder");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "world-builder__panel";
    root.appendChild(panel);

    // Header
    const header = document.createElement("div");
    header.className = "world-builder__header";

    const title = document.createElement("h2");
    title.className = "world-builder__title";
    title.innerHTML = "<span>🌍</span> World Builder & Generator";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "world-builder__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close world builder");
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body: 2 Columns (Left: Config & Presets, Right: Minimap & Regions)
    const body = document.createElement("div");
    body.className = "world-builder__body";
    body.appendChild(this._buildConfigSection());
    body.appendChild(this._buildPreviewSection());
    panel.appendChild(body);

    // Footer
    panel.appendChild(this._buildFooter());

    document.body.appendChild(root);

    this._syncControlsFromConfig();
    this._renderRegions();
    this.renderPreview();
  }

  // ── Left Column: Config & Presets ──────────────────────────────────────────

  private _buildConfigSection(): HTMLElement {
    const section = document.createElement("div");
    section.className = "world-builder__section world-builder__section--config";

    // Presets Bar
    const presetCard = document.createElement("div");
    presetCard.className = "world-builder__card";

    const presetTitle = document.createElement("h3");
    presetTitle.className = "world-builder__card-title";
    presetTitle.textContent = "World Presets";
    presetCard.appendChild(presetTitle);

    const presetRow = document.createElement("div");
    presetRow.className = "world-builder__row";

    this._presetSelect = document.createElement("select");
    this._presetSelect.className = "world-builder__select";
    this._populatePresets();
    presetRow.appendChild(this._presetSelect);

    const loadPresetBtn = document.createElement("button");
    loadPresetBtn.type = "button";
    loadPresetBtn.className = "world-builder__btn world-builder__btn--primary world-builder__btn--sm";
    loadPresetBtn.textContent = "Load";
    loadPresetBtn.addEventListener("click", () => {
      const id = this._presetSelect.value;
      if (this._sys.applyPreset(id)) {
        this._syncControlsFromConfig();
        this._renderRegions();
        this.renderPreview();
        this._setStatus(`Loaded preset '${id}'`, "info");
      }
    });
    presetRow.appendChild(loadPresetBtn);
    presetCard.appendChild(presetRow);

    // Save Custom Preset Row
    const savePresetRow = document.createElement("div");
    savePresetRow.className = "world-builder__row world-builder__row--spaced";

    const savePresetInp = document.createElement("input");
    savePresetInp.type = "text";
    savePresetInp.className = "world-builder__input world-builder__input--preset-name";
    savePresetInp.setAttribute("data-field", "preset-name");
    savePresetInp.placeholder = "Custom preset name...";
    savePresetRow.appendChild(savePresetInp);

    const savePresetBtn = document.createElement("button");
    savePresetBtn.type = "button";
    savePresetBtn.className = "world-builder__btn world-builder__btn--sm";
    savePresetBtn.textContent = "Save Preset";
    savePresetBtn.addEventListener("click", () => {
      const name = savePresetInp.value.trim();
      if (!name) {
        this._setStatus("Please enter a preset name.", "warn");
        return;
      }
      const id = name.toLowerCase().replace(/\s+/g, "_");
      this._sys.saveCustomPreset({
        id,
        name,
        description: `User-defined preset: ${name}`,
        config: { ...this._sys.config },
        regions: [...this._sys.regions],
      });
      this._populatePresets();
      this._presetSelect.value = id;
      savePresetInp.value = "";
      this._setStatus(`Saved custom preset '${name}'.`, "info");
    });
    savePresetRow.appendChild(savePresetBtn);
    presetCard.appendChild(savePresetRow);
    section.appendChild(presetCard);

    // Generation Parameters Card
    const genCard = document.createElement("div");
    genCard.className = "world-builder__card";

    const genTitle = document.createElement("h3");
    genTitle.className = "world-builder__card-title";
    genTitle.textContent = "Generation Parameters";
    genCard.appendChild(genTitle);

    // Seed Input + Randomizer
    const seedGroup = document.createElement("div");
    seedGroup.className = "world-builder__field";
    const seedLbl = document.createElement("label");
    seedLbl.className = "world-builder__label";
    seedLbl.textContent = "World Seed";
    seedGroup.appendChild(seedLbl);

    const seedRow = document.createElement("div");
    seedRow.className = "world-builder__row";
    this._seedInput = document.createElement("input");
    this._seedInput.type = "text";
    this._seedInput.className = "world-builder__input world-builder__input--seed";
    this._seedInput.setAttribute("data-field", "seed");
    this._seedInput.addEventListener("input", () => {
      this._sys.setSeed(this._seedInput.value);
      this.renderPreview();
    });
    seedRow.appendChild(this._seedInput);

    const randBtn = document.createElement("button");
    randBtn.type = "button";
    randBtn.className = "world-builder__btn world-builder__btn--sm";
    randBtn.textContent = "🎲 Rand";
    randBtn.title = "Generate random seed";
    randBtn.addEventListener("click", () => {
      const s = this._sys.randomizeSeed();
      this._seedInput.value = s;
      this.renderPreview();
    });
    seedRow.appendChild(randBtn);
    seedGroup.appendChild(seedRow);
    genCard.appendChild(seedGroup);

    // World Type
    genCard.appendChild(
      this._buildSelectField(
        "World Type",
        ["normal", "flat", "amplified", "island"],
        (val) => {
          this._sys.setWorldType(val as WorldType);
          this.renderPreview();
        },
        (sel) => (this._worldTypeSelect = sel),
      ),
    );

    // Biome Scale
    genCard.appendChild(
      this._buildSelectField(
        "Biome Scale",
        ["small", "medium", "large", "huge"],
        (val) => {
          this._sys.setBiomeScale(val as BiomeScale);
          this.renderPreview();
        },
        (sel) => (this._biomeScaleSelect = sel),
      ),
    );

    // Structure Density
    genCard.appendChild(
      this._buildSelectField(
        "Structure Density",
        ["none", "rare", "normal", "abundant"],
        (val) => {
          this._sys.setStructureDensity(val as StructureDensity);
          this.renderPreview();
        },
        (sel) => (this._structureDensitySelect = sel),
      ),
    );

    // Starting Biome
    genCard.appendChild(
      this._buildSelectField(
        "Starting Biome Override",
        ["(procedural)", "plains", "forest", "desert", "tundra"],
        (val) => {
          const biome = val === "(procedural)" ? null : (val as BiomeType);
          this._sys.setStartingBiome(biome);
          this.renderPreview();
        },
        (sel) => (this._startingBiomeSelect = sel),
      ),
    );

    // Elevation Scale Slider
    const elevGroup = document.createElement("div");
    elevGroup.className = "world-builder__field";
    const elevLbl = document.createElement("label");
    elevLbl.className = "world-builder__label world-builder__label--slider";
    elevLbl.innerHTML = `<span>Elevation Scale</span>`;
    this._elevationValSpan = document.createElement("span");
    this._elevationValSpan.className = "world-builder__val-span";
    elevLbl.appendChild(this._elevationValSpan);
    elevGroup.appendChild(elevLbl);

    this._elevationInput = document.createElement("input");
    this._elevationInput.type = "range";
    this._elevationInput.min = "0.5";
    this._elevationInput.max = "3.0";
    this._elevationInput.step = "0.1";
    this._elevationInput.className = "world-builder__range";
    this._elevationInput.addEventListener("input", () => {
      const v = parseFloat(this._elevationInput.value);
      this._elevationValSpan.textContent = v.toFixed(1);
      this._sys.setElevationScale(v);
      this.renderPreview();
    });
    elevGroup.appendChild(this._elevationInput);
    genCard.appendChild(elevGroup);

    // Vegetation Density Slider
    const vegGroup = document.createElement("div");
    vegGroup.className = "world-builder__field";
    const vegLbl = document.createElement("label");
    vegLbl.className = "world-builder__label world-builder__label--slider";
    vegLbl.innerHTML = `<span>Vegetation Density</span>`;
    this._vegetationValSpan = document.createElement("span");
    this._vegetationValSpan.className = "world-builder__val-span";
    vegLbl.appendChild(this._vegetationValSpan);
    vegGroup.appendChild(vegLbl);

    this._vegetationInput = document.createElement("input");
    this._vegetationInput.type = "range";
    this._vegetationInput.min = "0.0";
    this._vegetationInput.max = "2.5";
    this._vegetationInput.step = "0.1";
    this._vegetationInput.className = "world-builder__range";
    this._vegetationInput.addEventListener("input", () => {
      const v = parseFloat(this._vegetationInput.value);
      this._vegetationValSpan.textContent = v.toFixed(1);
      this._sys.setVegetationDensity(v);
      this.renderPreview();
    });
    vegGroup.appendChild(this._vegetationInput);
    genCard.appendChild(vegGroup);

    // Temperature Shift Slider
    const tempGroup = document.createElement("div");
    tempGroup.className = "world-builder__field";
    const tempLbl = document.createElement("label");
    tempLbl.className = "world-builder__label world-builder__label--slider";
    tempLbl.innerHTML = `<span>Temperature Bias</span>`;
    this._temperatureValSpan = document.createElement("span");
    this._temperatureValSpan.className = "world-builder__val-span";
    tempLbl.appendChild(this._temperatureValSpan);
    tempGroup.appendChild(tempLbl);

    this._temperatureInput = document.createElement("input");
    this._temperatureInput.type = "range";
    this._temperatureInput.min = "-1.0";
    this._temperatureInput.max = "1.0";
    this._temperatureInput.step = "0.1";
    this._temperatureInput.className = "world-builder__range";
    this._temperatureInput.addEventListener("input", () => {
      const v = parseFloat(this._temperatureInput.value);
      this._temperatureValSpan.textContent = v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
      this._sys.setTemperatureShift(v);
      this.renderPreview();
    });
    tempGroup.appendChild(this._temperatureInput);
    genCard.appendChild(tempGroup);

    section.appendChild(genCard);
    return section;
  }

  // ── Right Column: Minimap & Regions ────────────────────────────────────────

  private _buildPreviewSection(): HTMLElement {
    const section = document.createElement("div");
    section.className = "world-builder__section world-builder__section--preview";

    // Minimap Card
    const mapCard = document.createElement("div");
    mapCard.className = "world-builder__card";

    const mapHeader = document.createElement("div");
    mapHeader.className = "world-builder__map-header";

    const mapTitle = document.createElement("h3");
    mapTitle.className = "world-builder__card-title";
    mapTitle.textContent = "World Minimap (2D Chunk Preview)";
    mapHeader.appendChild(mapTitle);

    const radiusSelect = document.createElement("select");
    radiusSelect.className = "world-builder__select world-builder__select--sm";
    radiusSelect.innerHTML = `
      <option value="5">11 × 11 Chunks</option>
      <option value="7" selected>15 × 15 Chunks</option>
      <option value="10">21 × 21 Chunks</option>
    `;
    radiusSelect.addEventListener("change", () => {
      this._radius = parseInt(radiusSelect.value, 10);
      this.renderPreview();
    });
    mapHeader.appendChild(radiusSelect);
    mapCard.appendChild(mapHeader);

    // Layer Toggles (Simplex Relief, Voronoi Provinces, Delaunay Roads)
    const layerToggles = document.createElement("div");
    layerToggles.className = "world-builder__layer-toggles";

    const makeToggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => {
      const lbl = document.createElement("label");
      lbl.className = "world-builder__layer-toggle";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = checked;
      chk.addEventListener("change", () => {
        onChange(chk.checked);
        this.renderPreview();
      });
      lbl.appendChild(chk);
      lbl.appendChild(document.createTextNode(` ${label}`));
      return lbl;
    };

    layerToggles.appendChild(makeToggle("⛰️ Relief", this._showRelief, (v) => (this._showRelief = v)));
    layerToggles.appendChild(makeToggle("🌊 Rivers", this._showRivers, (v) => (this._showRivers = v)));
    layerToggles.appendChild(makeToggle("🚩 Provinces", this._showProvinces, (v) => (this._showProvinces = v)));
    layerToggles.appendChild(makeToggle("🛤️ Roads", this._showRoads, (v) => (this._showRoads = v)));
    mapCard.appendChild(layerToggles);

    // Canvas Container & Tooltip
    const canvasWrap = document.createElement("div");
    canvasWrap.className = "world-builder__canvas-wrap";

    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 360;
    canvas.className = "world-builder__canvas";
    this._canvas = canvas;

    const tooltip = document.createElement("div");
    tooltip.className = "world-builder__tooltip";
    tooltip.textContent = "Hover over chunk cells to inspect";
    this._tooltipEl = tooltip;

    canvas.addEventListener("mousemove", (e) => this._onCanvasMouseMove(e));
    canvas.addEventListener("mouseleave", () => {
      if (this._tooltipEl) {
        this._tooltipEl.textContent = "Hover over chunk cells to inspect";
      }
    });

    canvasWrap.appendChild(canvas);
    canvasWrap.appendChild(tooltip);
    mapCard.appendChild(canvasWrap);

    // Legend
    const legend = document.createElement("div");
    legend.className = "world-builder__legend";
    legend.innerHTML = `
      <span class="world-builder__legend-item"><i style="background: ${BIOME_PREVIEW_COLORS.plains}"></i> Plains</span>
      <span class="world-builder__legend-item"><i style="background: ${BIOME_PREVIEW_COLORS.forest}"></i> Forest</span>
      <span class="world-builder__legend-item"><i style="background: ${BIOME_PREVIEW_COLORS.desert}"></i> Desert</span>
      <span class="world-builder__legend-item"><i style="background: ${BIOME_PREVIEW_COLORS.tundra}"></i> Tundra</span>
      <span class="world-builder__legend-item"><i class="world-builder__legend-icon">🏰</i> Structure</span>
      <span class="world-builder__legend-item"><i class="world-builder__legend-origin"></i> Origin</span>
      <span class="world-builder__legend-item">🌊 River / Lake</span>
      <span class="world-builder__legend-item">👑 Capital</span>
      <span class="world-builder__legend-item">🛡️ Castle</span>
      <span class="world-builder__legend-item">🏘️ Town</span>
    `;
    mapCard.appendChild(legend);
    section.appendChild(mapCard);

    // Region Authoring Card
    const regionCard = document.createElement("div");
    regionCard.className = "world-builder__card";

    const regionHeader = document.createElement("div");
    regionHeader.className = "world-builder__list-header";

    const regionTitle = document.createElement("h3");
    regionTitle.className = "world-builder__card-title";
    regionTitle.textContent = "Custom World Regions";
    regionHeader.appendChild(regionTitle);

    const regionBtnGroup = document.createElement("div");
    regionBtnGroup.className = "world-builder__row";

    const addRegionBtn = document.createElement("button");
    addRegionBtn.type = "button";
    addRegionBtn.className = "world-builder__btn world-builder__btn--sm";
    addRegionBtn.textContent = "+ Add Region";
    addRegionBtn.addEventListener("click", () => this._onAddRegion());
    regionBtnGroup.appendChild(addRegionBtn);

    const autoRegionBtn = document.createElement("button");
    autoRegionBtn.type = "button";
    autoRegionBtn.className = "world-builder__btn world-builder__btn--sm world-builder__btn--primary";
    autoRegionBtn.textContent = "🎲 Arthurian Region";
    autoRegionBtn.title = "Generate a procedurally named Arthurian region";
    autoRegionBtn.addEventListener("click", () => {
      const reg = this._sys.generateArthurianRegion();
      this._sys.addRegion(reg);
      this._renderRegions();
      this.renderPreview();
      this._setStatus(`Generated Arthurian region '${reg.name}'.`, "info");
    });
    regionBtnGroup.appendChild(autoRegionBtn);

    regionHeader.appendChild(regionBtnGroup);
    regionCard.appendChild(regionHeader);

    const regionList = document.createElement("div");
    regionList.className = "world-builder__region-list";
    this._regionListEl = regionList;
    regionCard.appendChild(regionList);

    section.appendChild(regionCard);
    return section;
  }

  // ── Footer & Action Bar ───────────────────────────────────────────────────

  private _buildFooter(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = "world-builder__footer";

    const statusEl = document.createElement("div");
    statusEl.className = "world-builder__status";
    statusEl.textContent = "Ready.";
    this._statusEl = statusEl;
    footer.appendChild(statusEl);

    const actions = document.createElement("div");
    actions.className = "world-builder__actions";

    // Validate Button
    const valBtn = document.createElement("button");
    valBtn.type = "button";
    valBtn.className = "world-builder__btn";
    valBtn.textContent = "Validate";
    valBtn.addEventListener("click", () => {
      const rep = this._sys.validate();
      if (rep.isValid && rep.issues.length === 0) {
        this._setStatus("Validation passed! All world parameters and regions are valid.", "info");
      } else if (rep.isValid) {
        this._setStatus(`Valid with warnings: ${rep.issues.map((i) => i.message).join(" ")}`, "warn");
      } else {
        this._setStatus(`Validation failed: ${rep.issues.map((i) => i.message).join(" ")}`, "error");
      }
    });
    actions.appendChild(valBtn);

    // Export JSON
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "world-builder__btn";
    exportBtn.textContent = "Export JSON ↓";
    exportBtn.addEventListener("click", () => {
      this._sys.exportToFile();
      this._setStatus("Exported world configuration to JSON.", "info");
    });
    actions.appendChild(exportBtn);

    // Import JSON (hidden file input)
    const importInp = document.createElement("input");
    importInp.type = "file";
    importInp.accept = ".json,.world.json";
    importInp.style.display = "none";
    importInp.addEventListener("change", async () => {
      const file = importInp.files?.[0];
      if (!file) return;
      const ok = await this._sys.importFromFile(file);
      if (ok) {
        this._syncControlsFromConfig();
        this._renderRegions();
        this.renderPreview();
        this._setStatus(`Imported world configuration from '${file.name}'.`, "info");
      } else {
        this._setStatus("Failed to import world configuration from file.", "error");
      }
      importInp.value = "";
    });
    actions.appendChild(importInp);

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "world-builder__btn";
    importBtn.textContent = "Import JSON ↑";
    importBtn.addEventListener("click", () => importInp.click());
    actions.appendChild(importBtn);

    // Apply to Game World Action
    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "world-builder__btn world-builder__btn--primary";
    applyBtn.textContent = "🚀 Apply to Game World";
    applyBtn.addEventListener("click", () => {
      const seed = this._sys.toWorldSeed();
      if (this.onApplyToWorld) {
        this.onApplyToWorld(seed, this._sys.config);
        this._setStatus("World configuration applied to active game world!", "info");
      } else {
        this._setStatus("World configuration updated (no active game runner hook).", "info");
      }
    });
    actions.appendChild(applyBtn);

    // Close Button
    const closeFooterBtn = document.createElement("button");
    closeFooterBtn.type = "button";
    closeFooterBtn.className = "world-builder__btn";
    closeFooterBtn.textContent = "Close";
    closeFooterBtn.addEventListener("click", () => this.close());
    actions.appendChild(closeFooterBtn);

    footer.appendChild(actions);
    return footer;
  }

  // ── Helper Form Builders ──────────────────────────────────────────────────

  private _buildSelectField(
    label: string,
    options: string[],
    onChange: (val: string) => void,
    assigner: (sel: HTMLSelectElement) => void,
  ): HTMLElement {
    const group = document.createElement("div");
    group.className = "world-builder__field";

    const lbl = document.createElement("label");
    lbl.className = "world-builder__label";
    lbl.textContent = label;
    group.appendChild(lbl);

    const sel = document.createElement("select");
    sel.className = "world-builder__select";
    for (const opt of options) {
      const el = document.createElement("option");
      el.value = opt;
      el.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      sel.appendChild(el);
    }
    sel.addEventListener("change", () => onChange(sel.value));
    assigner(sel);
    group.appendChild(sel);
    return group;
  }

  private _populatePresets(): void {
    if (!this._presetSelect) return;
    this._presetSelect.innerHTML = "";
    const presets = this._sys.getAllPresets();
    for (const p of presets) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      this._presetSelect.appendChild(opt);
    }
  }

  private _syncControlsFromConfig(): void {
    const cfg = this._sys.config;
    if (this._seedInput) this._seedInput.value = cfg.seed;
    if (this._worldTypeSelect) this._worldTypeSelect.value = cfg.worldType;
    if (this._biomeScaleSelect) this._biomeScaleSelect.value = cfg.biomeScale;
    if (this._structureDensitySelect) this._structureDensitySelect.value = cfg.structureDensity;
    if (this._startingBiomeSelect) {
      this._startingBiomeSelect.value = cfg.startingBiome ?? "(procedural)";
    }
    if (this._elevationInput && this._elevationValSpan) {
      this._elevationInput.value = cfg.elevationScale.toString();
      this._elevationValSpan.textContent = cfg.elevationScale.toFixed(1);
    }
    if (this._vegetationInput && this._vegetationValSpan) {
      this._vegetationInput.value = cfg.vegetationDensity.toString();
      this._vegetationValSpan.textContent = cfg.vegetationDensity.toFixed(1);
    }
    if (this._temperatureInput && this._temperatureValSpan) {
      this._temperatureInput.value = cfg.temperatureShift.toString();
      this._temperatureValSpan.textContent =
        cfg.temperatureShift >= 0 ? `+${cfg.temperatureShift.toFixed(1)}` : cfg.temperatureShift.toFixed(1);
    }
  }

  private _setStatus(message: string, type: "info" | "warn" | "error" = "info"): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.className = `world-builder__status world-builder__status--${type}`;
  }

  // ── Canvas Minimap Preview Painting ───────────────────────────────────────

  public renderPreview(): void {
    if (!this._canvas) return;
    const ctx = this._canvas.getContext("2d");
    if (!ctx) return;

    const width = this._canvas.width;
    const height = this._canvas.height;
    ctx.clearRect(0, 0, width, height);

    const samples = this._sys.sampleGrid(this._radius, 0, 0);
    this._cachedSamples = samples;
    const gridSize = samples.length;
    if (gridSize === 0) return;

    const cellSize = width / gridSize;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = samples[r][c];
        const x = c * cellSize;
        const y = r * cellSize;

        // Base biome color
        const baseColor = BIOME_PREVIEW_COLORS[cell.biome] || "#4caf50";
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y, cellSize, cellSize);

        // Continuous Simplex elevation relief shading
        if (this._showRelief) {
          const elevAlpha = Math.max(0, Math.min(0.45, (cell.elevation - 0.25) * 0.5));
          if (elevAlpha > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${elevAlpha.toFixed(2)})`;
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        }

        // Cell border
        ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);

        // Starting chunk highlight (Origin)
        if (cell.cx === 0 && cell.cz === 0) {
          ctx.strokeStyle = "#e11d48";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

          ctx.fillStyle = "#e11d48";
          ctx.beginPath();
          ctx.arc(x + cellSize / 2, y + cellSize / 2, Math.max(2, cellSize / 5), 0, Math.PI * 2);
          ctx.fill();
        }

        // Structure indicator
        if (cell.hasStructure) {
          ctx.fillStyle = "#facc15";
          ctx.strokeStyle = "#78350f";
          ctx.lineWidth = 1;
          const cx = x + cellSize / 2;
          const cy = y + cellSize / 2;
          const s = Math.max(3, cellSize * 0.28);
          ctx.beginPath();
          ctx.moveTo(cx, cy - s);
          ctx.lineTo(cx + s, cy);
          ctx.lineTo(cx, cy + s);
          ctx.lineTo(cx - s, cy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Paint Voronoi Province Boundaries
    if (this._showProvinces) {
      for (const prov of this._sys.provinces) {
        if (prov.polygon.length >= 3) {
          ctx.save();
          ctx.beginPath();
          let first = true;
          for (const pt of prov.polygon) {
            const px = (pt[0] + this._radius + 0.5) * cellSize;
            const py = (pt[1] + this._radius + 0.5) * cellSize;
            if (first) {
              ctx.moveTo(px, py);
              first = false;
            } else {
              ctx.lineTo(px, py);
            }
          }
          ctx.closePath();
          ctx.strokeStyle = prov.color;
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.fillStyle = `${prov.color}14`;
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Paint Rivers and Lake Basins
    if (this._showRivers) {
      // 1. Lakes
      for (const lake of this._sys.lakes) {
        const lx = (lake.cx + this._radius + 0.5) * cellSize;
        const ly = (lake.cz + this._radius + 0.5) * cellSize;
        if (lx >= 0 && lx <= width && ly >= 0 && ly <= height) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(lx, ly, Math.max(3, lake.surfaceArea * 2.2), 0, Math.PI * 2);
          ctx.fillStyle = "rgba(14, 165, 233, 0.6)";
          ctx.fill();
          ctx.strokeStyle = "rgba(2, 132, 199, 0.85)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      }

      // 2. Rivers
      ctx.save();
      ctx.strokeStyle = "rgba(14, 165, 233, 0.85)";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const river of this._sys.rivers) {
        if (river.waypoints.length < 2) continue;
        ctx.beginPath();
        const first = river.waypoints[0];
        ctx.moveTo((first.cx + this._radius + 0.5) * cellSize, (first.cz + this._radius + 0.5) * cellSize);
        for (let i = 1; i < river.waypoints.length; i++) {
          const wp = river.waypoints[i];
          ctx.lineTo((wp.cx + this._radius + 0.5) * cellSize, (wp.cz + this._radius + 0.5) * cellSize);
        }
        ctx.lineWidth = Math.min(5, Math.max(1.5, Math.sqrt(river.maxFlow) * 0.75));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Paint Delaunay Road Networks
    if (this._showRoads) {
      ctx.save();
      ctx.strokeStyle = "rgba(180, 83, 9, 0.75)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      for (const road of this._sys.roads) {
        const sA = this._sys.settlements.find((s) => s.id === road.fromId);
        const sB = this._sys.settlements.find((s) => s.id === road.toId);
        if (sA && sB) {
          const x1 = (sA.cx + this._radius + 0.5) * cellSize;
          const y1 = (sA.cz + this._radius + 0.5) * cellSize;
          const x2 = (sB.cx + this._radius + 0.5) * cellSize;
          const y2 = (sB.cz + this._radius + 0.5) * cellSize;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Paint Settlements
    for (const s of this._sys.settlements) {
      const sx = (s.cx + this._radius + 0.5) * cellSize;
      const sy = (s.cz + this._radius + 0.5) * cellSize;
      if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
        ctx.save();
        ctx.font = `${Math.max(11, Math.floor(cellSize * 0.7))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let icon = "🏘️";
        if (s.type === "capital") icon = "👑";
        else if (s.type === "castle") icon = "🛡️";
        else if (s.type === "shrine") icon = "✨";
        else if (s.type === "outpost") icon = "⛺";
        ctx.fillText(icon, sx, sy);
        ctx.restore();
      }
    }

    // Paint Region bounding boxes
    for (const reg of this._sys.regions) {
      const minCol = reg.bounds.minCX + this._radius;
      const maxCol = reg.bounds.maxCX + this._radius;
      const minRow = reg.bounds.minCZ + this._radius;
      const maxRow = reg.bounds.maxCZ + this._radius;

      if (maxCol < 0 || minCol >= gridSize || maxRow < 0 || minRow >= gridSize) {
        continue;
      }

      const rx = Math.max(0, minCol) * cellSize;
      const ry = Math.max(0, minRow) * cellSize;
      const rw = (Math.min(gridSize - 1, maxCol) - Math.max(0, minCol) + 1) * cellSize;
      const rh = (Math.min(gridSize - 1, maxRow) - Math.max(0, minRow) + 1) * cellSize;

      ctx.save();
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);

      ctx.fillStyle = "rgba(168, 85, 247, 0.15)";
      ctx.fillRect(rx + 1, ry + 1, rw - 2, rh - 2);
      ctx.restore();
    }
  }

  private _onCanvasMouseMove(e: MouseEvent): void {
    if (!this._canvas || !this._cachedSamples || !this._tooltipEl) return;
    const rect = this._canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const gridSize = this._cachedSamples.length;
    if (gridSize === 0) return;
    const cellSize = this._canvas.width / gridSize;

    const col = Math.floor(mx / cellSize);
    const row = Math.floor(my / cellSize);

    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
      const cell = this._cachedSamples[row][col];
      const reg = this._sys.getRegionAt(cell.cx, cell.cz);
      const regInfo = reg ? ` | Region: ${reg.name} (Danger: ${reg.dangerLevel}/10)` : "";
      const structInfo = cell.hasStructure ? " | 🏰 Structure" : "";

      // Proximity check for settlements
      let settlInfo = "";
      for (const s of this._sys.settlements) {
        if (Math.abs(s.cx - cell.cx) <= 0.6 && Math.abs(s.cz - cell.cz) <= 0.6) {
          settlInfo = ` | 🏛️ ${s.name} (${s.type.toUpperCase()})`;
          break;
        }
      }

      let waterInfo = "";
      if (cell.isWaterBody || (cell.riverFlow ?? 0) > 0) {
        const w = this._sys.riverGen.getWaterInfoAt(cell.cx, cell.cz);
        if (w.name) {
          waterInfo = ` | 🌊 ${w.name} (Flow: ${Math.round(cell.riverFlow ?? 1)})`;
        } else if (cell.isWaterBody) {
          waterInfo = ` | 🌊 Water Channel (Flow: ${Math.round(cell.riverFlow ?? 1)})`;
        }
      }

      const climInfo = ` | Temp: ${(cell.temperature * 50).toFixed(0)}°C, Moist: ${(cell.moisture * 100).toFixed(0)}%`;
      this._tooltipEl.textContent = `Chunk (${cell.cx}, ${cell.cz}) | Biome: ${cell.biome.toUpperCase()} | Elevation: ${(cell.elevation * 100).toFixed(0)}%${structInfo}${regInfo}${settlInfo}${waterInfo}${climInfo}`;
    }
  }

  // ── Custom Region Authoring ───────────────────────────────────────────────

  private _renderRegions(): void {
    if (!this._regionListEl) return;
    this._regionListEl.innerHTML = "";

    const regions = this._sys.regions;
    if (regions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "world-builder__empty";
      empty.textContent = "No custom regions defined. Click '+ Add Region' to author one.";
      this._regionListEl.appendChild(empty);
      return;
    }

    for (const reg of regions) {
      this._regionListEl.appendChild(this._buildRegionItem(reg));
    }
  }

  private _buildRegionItem(reg: WorldRegion): HTMLElement {
    const item = document.createElement("div");
    item.className = "world-builder__region-item";

    const topRow = document.createElement("div");
    topRow.className = "world-builder__row world-builder__row--spaced";

    const nameTitle = document.createElement("strong");
    nameTitle.className = "world-builder__region-name";
    nameTitle.textContent = reg.name;
    topRow.appendChild(nameTitle);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "world-builder__btn world-builder__btn--sm world-builder__btn--danger";
    deleteBtn.textContent = "Remove";
    deleteBtn.addEventListener("click", () => {
      this._sys.removeRegion(reg.id);
      this._renderRegions();
      this.renderPreview();
    });
    topRow.appendChild(deleteBtn);
    item.appendChild(topRow);

    const metaRow = document.createElement("div");
    metaRow.className = "world-builder__region-meta";
    metaRow.textContent = `Biome: ${reg.biome} | Danger: ${reg.dangerLevel}/10 | Bounds: [${reg.bounds.minCX}, ${reg.bounds.minCZ}] to [${reg.bounds.maxCX}, ${reg.bounds.maxCZ}]`;
    item.appendChild(metaRow);

    return item;
  }

  private _onAddRegion(): void {
    const id = `reg_${Date.now().toString(36)}`;
    const newReg: WorldRegion = {
      id,
      name: `Region ${this._sys.regions.length + 1}`,
      bounds: { minCX: -2, minCZ: -2, maxCX: 2, maxCZ: 2 },
      biome: "forest",
      dangerLevel: 3,
      encounterRate: 1.0,
      description: "Custom authored region.",
    };
    this._sys.addRegion(newReg);
    this._renderRegions();
    this.renderPreview();
    this._setStatus(`Added region '${newReg.name}'.`, "info");
  }
}
