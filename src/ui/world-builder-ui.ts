import {
  WorldBuilderSystem,
  BUILTIN_WORLD_PRESETS,
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
  private _deletePresetBtn!: HTMLButtonElement;
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
  private _showSettlements: boolean = true;
  private _showDungeons: boolean = true;
  private _showClimate: boolean = false;
  private _showDanger: boolean = false;
  private _showResources: boolean = false;
  private _selectedChunk: { cx: number; cz: number } | null = null;
  private _chunkInspectorEl: HTMLElement | null = null;
  private _expandedRegionId: string | null = null;

  // Region authoring & filter
  private _regionListEl: HTMLElement | null = null;
  private _regionCountBadge: HTMLElement | null = null;
  private _searchQuery: string = "";
  private _confirmDeleteRegionId: string | null = null;
  private _confirmDeleteTimer: ReturnType<typeof setTimeout> | null = null;

  // Status elements & timers
  private _statusEl: HTMLElement | null = null;
  private _statusTimer: ReturnType<typeof setTimeout> | null = null;
  private _onKeyDownBound: ((e: KeyboardEvent) => void) | null = null;

  constructor(system: WorldBuilderSystem) {
    this._sys = system;
  }

  public get isVisible(): boolean {
    return this._root !== null && !this._root.hidden;
  }

  public open(): void {
    if (!this._onKeyDownBound) {
      this._onKeyDownBound = (e: KeyboardEvent) => this._onKeyDown(e);
      window.addEventListener("keydown", this._onKeyDownBound);
    }

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
    if (this._onKeyDownBound) {
      window.removeEventListener("keydown", this._onKeyDownBound);
      this._onKeyDownBound = null;
    }
    if (this._confirmDeleteTimer) {
      clearTimeout(this._confirmDeleteTimer);
      this._confirmDeleteTimer = null;
    }
    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
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

  private _onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  }

  // ── Build DOM ──────────────────────────────────────────────────────────────

  private _build(): void {
    const root = document.createElement("div");
    root.className = "world-builder";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "world-builder-dialog-title");
    this._root = root;

    const panel = document.createElement("section");
    panel.className = "world-builder__panel";
    root.appendChild(panel);

    // Header
    const header = document.createElement("div");
    header.className = "world-builder__header";

    const title = document.createElement("h2");
    title.id = "world-builder-dialog-title";
    title.className = "world-builder__title";
    title.innerHTML = "<span>🌍</span> World Builder & Generator";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "world-builder__close-btn";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close World Builder");
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
    this._presetSelect.setAttribute("aria-label", "Select world preset");
    this._presetSelect.addEventListener("change", () => this._updateDeletePresetButtonVisibility());
    this._populatePresets();
    presetRow.appendChild(this._presetSelect);

    const loadPresetBtn = document.createElement("button");
    loadPresetBtn.type = "button";
    loadPresetBtn.className = "world-builder__btn world-builder__btn--primary world-builder__btn--sm";
    loadPresetBtn.textContent = "Load";
    loadPresetBtn.setAttribute("aria-label", "Load selected preset");
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

    const delPresetBtn = document.createElement("button");
    delPresetBtn.type = "button";
    delPresetBtn.className = "world-builder__btn world-builder__btn--danger world-builder__btn--sm";
    delPresetBtn.textContent = "Delete";
    delPresetBtn.title = "Delete this custom preset";
    delPresetBtn.setAttribute("aria-label", "Delete selected custom preset");
    delPresetBtn.style.display = "none";
    delPresetBtn.addEventListener("click", () => {
      const id = this._presetSelect.value;
      if (this._sys.deleteCustomPreset(id)) {
        this._populatePresets();
        this._syncControlsFromConfig();
        this._renderRegions();
        this.renderPreview();
        this._setStatus(`Deleted custom preset '${id}'.`, "info");
      }
    });
    this._deletePresetBtn = delPresetBtn;
    presetRow.appendChild(delPresetBtn);
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
      this._updateDeletePresetButtonVisibility();
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
    layerToggles.appendChild(makeToggle("🏘️ Towns", this._showSettlements, (v) => (this._showSettlements = v)));
    layerToggles.appendChild(makeToggle("🗝️ Dungeons", this._showDungeons, (v) => (this._showDungeons = v)));
    layerToggles.appendChild(makeToggle("🌡️ Climate", this._showClimate, (v) => (this._showClimate = v)));
    layerToggles.appendChild(makeToggle("☠️ Danger", this._showDanger, (v) => (this._showDanger = v)));
    layerToggles.appendChild(makeToggle("💎 Resources", this._showResources, (v) => (this._showResources = v)));
    mapCard.appendChild(layerToggles);

    // Canvas Container & Tooltip
    const canvasWrap = document.createElement("div");
    canvasWrap.className = "world-builder__canvas-wrap";

    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 360;
    canvas.className = "world-builder__canvas";
    canvas.setAttribute("tabindex", "0");
    canvas.setAttribute("role", "application");
    canvas.setAttribute(
      "aria-label",
      "World chunk minimap. Use arrow keys to navigate chunks, Enter or Space to inspect, Home to center on origin.",
    );
    this._canvas = canvas;

    const tooltip = document.createElement("div");
    tooltip.className = "world-builder__tooltip";
    tooltip.textContent = "Hover or click chunk cells to inspect (Arrow keys to navigate)";
    this._tooltipEl = tooltip;

    canvas.addEventListener("mousemove", (e) => this._onCanvasMouseMove(e));
    canvas.addEventListener("click", (e) => this._onCanvasClick(e));
    canvas.addEventListener("keydown", (e) => this._onCanvasKeyDown(e));
    canvas.addEventListener("mouseleave", () => {
      if (this._tooltipEl) {
        this._tooltipEl.textContent = "Hover or click chunk cells to inspect (Arrow keys to navigate)";
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
      <span class="world-builder__legend-item">🗝️ Barrow</span>
      <span class="world-builder__legend-item">💀 Crypt</span>
      <span class="world-builder__legend-item">🏛️ Catacomb</span>
      <span class="world-builder__legend-item">🦇 Cavern</span>
      <span class="world-builder__legend-item">💎 Resource</span>
      <span class="world-builder__legend-item">☠️ Danger Zone</span>
    `;
    mapCard.appendChild(legend);

    // Chunk Inspector Card (revealed on click)
    const inspector = document.createElement("div");
    inspector.className = "world-builder__chunk-inspector";
    this._chunkInspectorEl = inspector;
    mapCard.appendChild(inspector);
    section.appendChild(mapCard);

    // Region Authoring Card
    const regionCard = document.createElement("div");
    regionCard.className = "world-builder__card";

    const regionHeader = document.createElement("div");
    regionHeader.className = "world-builder__list-header";

    const regionTitle = document.createElement("h3");
    regionTitle.className = "world-builder__card-title";
    regionTitle.style.marginBottom = "0";
    regionTitle.innerHTML = `Custom Regions <span class="world-builder__badge">${this._sys.regions.length}</span>`;
    this._regionCountBadge = regionTitle.querySelector(".world-builder__badge");
    regionHeader.appendChild(regionTitle);

    const regionBtnGroup = document.createElement("div");
    regionBtnGroup.className = "world-builder__row";

    const addRegionBtn = document.createElement("button");
    addRegionBtn.type = "button";
    addRegionBtn.className = "world-builder__btn world-builder__btn--sm";
    addRegionBtn.textContent = "+ Add Region";
    addRegionBtn.setAttribute("aria-label", "Add new custom region");
    addRegionBtn.addEventListener("click", () => this._onAddRegion());
    regionBtnGroup.appendChild(addRegionBtn);

    const autoRegionBtn = document.createElement("button");
    autoRegionBtn.type = "button";
    autoRegionBtn.className = "world-builder__btn world-builder__btn--sm world-builder__btn--primary";
    autoRegionBtn.textContent = "🎲 Arthurian Region";
    autoRegionBtn.title = "Generate a procedurally named Arthurian region";
    autoRegionBtn.setAttribute("aria-label", "Generate procedural Arthurian region");
    autoRegionBtn.addEventListener("click", () => {
      const reg = this._sys.generateArthurianRegion();
      this._sys.addRegion(reg);
      this._renderRegions();
      this.renderPreview();
      this._setStatus(`Generated Arthurian region '${reg.name}'.`, "info");
    });
    regionBtnGroup.appendChild(autoRegionBtn);

    const kingdomBtn = document.createElement("button");
    kingdomBtn.type = "button";
    kingdomBtn.className = "world-builder__btn world-builder__btn--sm";
    kingdomBtn.textContent = "👑 Kingdom";
    kingdomBtn.title = "Generate a complete 5-region Arthurian Kingdom with authentic lore and danger zones";
    kingdomBtn.setAttribute("aria-label", "Generate Arthurian kingdom layout");
    kingdomBtn.addEventListener("click", () => {
      const regions = this._sys.generateArthurianKingdom();
      this._renderRegions();
      this.renderPreview();
      this._setStatus(
        `Generated 5 Arthurian Kingdom regions (${regions.map((r) => r.name).join(", ")}).`,
        "info",
      );
    });
    regionBtnGroup.appendChild(kingdomBtn);

    regionHeader.appendChild(regionBtnGroup);
    regionCard.appendChild(regionHeader);

    // Search filter for regions
    const searchWrap = document.createElement("div");
    searchWrap.className = "world-builder__search-wrap";
    const searchInp = document.createElement("input");
    searchInp.type = "search";
    searchInp.className = "world-builder__search-input";
    searchInp.placeholder = "🔍 Search regions by name, biome, or lore...";
    searchInp.setAttribute("aria-label", "Filter custom regions");
    searchInp.addEventListener("input", () => {
      this._searchQuery = searchInp.value.trim().toLowerCase();
      this._renderRegions();
    });
    searchWrap.appendChild(searchInp);
    regionCard.appendChild(searchWrap);

    const regionList = document.createElement("div");
    regionList.className = "world-builder__region-list";
    regionList.setAttribute("role", "list");
    regionList.setAttribute("aria-label", "Custom World Regions list");
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

    // World Analytics Modal
    const analyticsBtn = document.createElement("button");
    analyticsBtn.type = "button";
    analyticsBtn.className = "world-builder__btn";
    analyticsBtn.textContent = "📊 Analytics";
    analyticsBtn.addEventListener("click", () => this._showAnalyticsModal());
    actions.appendChild(analyticsBtn);

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
      const isCustom = !BUILTIN_WORLD_PRESETS.some((b) => b.id === p.id);
      opt.textContent = isCustom ? `★ ${p.name} (Custom)` : p.name;
      this._presetSelect.appendChild(opt);
    }
    this._updateDeletePresetButtonVisibility();
  }

  private _updateDeletePresetButtonVisibility(): void {
    if (!this._deletePresetBtn || !this._presetSelect) return;
    const id = this._presetSelect.value;
    const isCustom = !BUILTIN_WORLD_PRESETS.some((b) => b.id === id);
    this._deletePresetBtn.style.display = isCustom ? "inline-block" : "none";
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
    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
    }
    const icon = type === "error" ? "❌ " : type === "warn" ? "⚠️ " : "ℹ️ ";
    this._statusEl.textContent = `${icon}${message}`;
    this._statusEl.className = `world-builder__status world-builder__status--${type}`;
    this._statusTimer = setTimeout(() => {
      if (this._statusEl) {
        this._statusEl.textContent = "Ready.";
        this._statusEl.className = "world-builder__status";
      }
      this._statusTimer = null;
    }, 4500);
  }

  // ── Canvas Minimap Preview Painting ───────────────────────────────────────

  public renderPreview(): void {
    if (!this._canvas) return;
    const samples = this._sys.sampleGrid(this._radius, 0, 0);
    this._cachedSamples = samples;
    const gridSize = samples.length;
    if (gridSize === 0) return;

    const ctx = this._canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    const width = this._canvas.width;
    const height = this._canvas.height;
    ctx.clearRect(0, 0, width, height);

    const cellSize = width / gridSize;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = samples[r][c];
        const x = c * cellSize;
        const y = r * cellSize;

        // Base biome color vs Climate Heatmap
        if (this._showClimate) {
          const hue = Math.round(Math.max(0, Math.min(260, (1 - cell.temperature) * 260)));
          const sat = Math.round(45 + cell.moisture * 45);
          ctx.fillStyle = `hsl(${hue}, ${sat}%, 45%)`;
        } else {
          const baseColor = BIOME_PREVIEW_COLORS[cell.biome] || "#4caf50";
          ctx.fillStyle = baseColor;
        }
        ctx.fillRect(x, y, cellSize, cellSize);

        // Continuous Simplex elevation relief shading
        if (this._showRelief) {
          const elevAlpha = Math.max(0, Math.min(0.45, (cell.elevation - 0.25) * 0.5));
          if (elevAlpha > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${elevAlpha.toFixed(2)})`;
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        }

        // Danger Heatmap overlay
        if (this._showDanger) {
          const reg = this._sys.getRegionAt(cell.cx, cell.cz);
          const danger = reg
            ? reg.dangerLevel
            : Math.min(10, Math.max(1, Math.round(Math.sqrt(cell.cx * cell.cx + cell.cz * cell.cz))));
          const dangerAlpha = Math.min(0.65, 0.08 + (danger / 10) * 0.55);
          ctx.fillStyle = `rgba(220, 38, 38, ${dangerAlpha.toFixed(2)})`;
          ctx.fillRect(x, y, cellSize, cellSize);
        }

        // Cell border
        ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);

        // Resource Nodes indicator
        if (this._showResources && cell.resourceNodes && cell.resourceNodes.length > 0) {
          ctx.save();
          const primaryRes = cell.resourceNodes[0];
          let icon = "⛏️";
          if (primaryRes.type === "gold_deposit") icon = "🪙";
          else if (primaryRes.type === "mithril_ore") icon = "💎";
          else if (primaryRes.type === "mana_crystal") icon = "✨";
          else if (primaryRes.type === "kingsbloom") icon = "🌿";
          ctx.font = `${Math.max(9, Math.floor(cellSize * 0.45))}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(icon, x + cellSize * 0.72, y + cellSize * 0.72);
          ctx.restore();
        }

        // Selected chunk highlight (gold border)
        if (this._selectedChunk && cell.cx === this._selectedChunk.cx && cell.cz === this._selectedChunk.cz) {
          ctx.save();
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
          ctx.restore();
        }

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
    if (this._showSettlements) {
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
    }

    // Paint Procedural Dungeon POIs
    if (this._showDungeons) {
      for (const d of this._sys.dungeons) {
        const dx = (d.cx + this._radius + 0.5) * cellSize;
        const dy = (d.cz + this._radius + 0.5) * cellSize;
        if (dx >= 0 && dx <= width && dy >= 0 && dy <= height) {
          ctx.save();
          ctx.font = `${Math.max(11, Math.floor(cellSize * 0.7))}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          let icon = "🗝️";
          if (d.theme === "barrow") icon = "🗝️";
          else if (d.theme === "crypt") icon = "💀";
          else if (d.theme === "catacomb") icon = "🏛️";
          else if (d.theme === "cavern") icon = "🦇";
          ctx.fillText(icon, dx, dy);
          ctx.restore();
        }
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
    ctx.restore();
  }

  private _onCanvasMouseMove(e: MouseEvent): void {
    if (!this._canvas || !this._cachedSamples || !this._tooltipEl) return;
    const rect = this._canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;

    const gridSize = this._cachedSamples.length;
    if (gridSize === 0) return;

    const col = Math.floor(normX * gridSize);
    const row = Math.floor(normY * gridSize);

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

  private _onCanvasClick(e: MouseEvent): void {
    if (!this._canvas) return;
    if (!this._cachedSamples) {
      this._cachedSamples = this._sys.sampleGrid(this._radius, 0, 0);
    }
    const rect = this._canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;

    const gridSize = this._cachedSamples.length;
    if (gridSize === 0) return;

    const col = Math.floor(normX * gridSize);
    const row = Math.floor(normY * gridSize);

    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
      const cell = this._cachedSamples[row][col];
      this._selectedChunk = { cx: cell.cx, cz: cell.cz };
      this.renderPreview();
      this._renderChunkInspector(cell);
    }
  }

  private _onCanvasKeyDown(e: KeyboardEvent): void {
    if (!this._canvas) return;
    if (!this._cachedSamples) {
      this._cachedSamples = this._sys.sampleGrid(this._radius, 0, 0);
    }
    const gridSize = this._cachedSamples.length;
    if (gridSize === 0) return;

    let cx = this._selectedChunk ? this._selectedChunk.cx : 0;
    let cz = this._selectedChunk ? this._selectedChunk.cz : 0;

    let handled = false;
    switch (e.key) {
      case "ArrowLeft":
        cx = Math.max(-this._radius, cx - 1);
        handled = true;
        break;
      case "ArrowRight":
        cx = Math.min(this._radius, cx + 1);
        handled = true;
        break;
      case "ArrowUp":
        cz = Math.max(-this._radius, cz - 1);
        handled = true;
        break;
      case "ArrowDown":
        cz = Math.min(this._radius, cz + 1);
        handled = true;
        break;
      case "Home":
        cx = 0;
        cz = 0;
        handled = true;
        break;
      case "Enter":
      case " ":
        handled = true;
        break;
    }

    if (handled) {
      e.preventDefault();
      this._selectedChunk = { cx, cz };
      const col = cx + this._radius;
      const row = cz + this._radius;
      if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        const cell = this._cachedSamples[row][col];
        this.renderPreview();
        this._renderChunkInspector(cell);
        if (this._tooltipEl) {
          const reg = this._sys.getRegionAt(cell.cx, cell.cz);
          const regInfo = reg ? ` | Region: ${reg.name} (Danger: ${reg.dangerLevel}/10)` : "";
          this._tooltipEl.textContent = `Selected Chunk (${cell.cx}, ${cell.cz}) | Biome: ${cell.biome.toUpperCase()}${regInfo}`;
        }
      }
    }
  }

  private _renderChunkInspector(cell: ChunkCellSample): void {
    if (!this._chunkInspectorEl) return;
    this._chunkInspectorEl.style.display = "block";
    this._chunkInspectorEl.innerHTML = "";

    // Header Row
    const header = document.createElement("div");
    header.className = "world-builder__row world-builder__row--spaced";

    const titleWrap = document.createElement("div");
    titleWrap.className = "world-builder__row";
    titleWrap.style.gap = "8px";

    const title = document.createElement("h4");
    title.className = "world-builder__card-title";
    title.style.margin = "0";
    title.textContent = `Chunk (${cell.cx}, ${cell.cz})`;
    titleWrap.appendChild(title);

    const pill = document.createElement("span");
    pill.className = "world-builder__pill";
    pill.style.background = BIOME_PREVIEW_COLORS[cell.biome] || "#4caf50";
    pill.textContent = cell.biome.toUpperCase();
    titleWrap.appendChild(pill);
    header.appendChild(titleWrap);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "world-builder__btn world-builder__btn--sm";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close chunk inspector");
    closeBtn.addEventListener("click", () => {
      if (this._chunkInspectorEl) {
        this._chunkInspectorEl.style.display = "none";
      }
      this._selectedChunk = null;
      this.renderPreview();
    });
    header.appendChild(closeBtn);
    this._chunkInspectorEl.appendChild(header);

    // Metrics Grid (4 columns)
    const grid = document.createElement("div");
    grid.className = "world-builder__grid-4col";

    const reg = this._sys.getRegionAt(cell.cx, cell.cz);
    const danger = reg
      ? reg.dangerLevel
      : Math.min(10, Math.max(1, Math.round(Math.sqrt(cell.cx * cell.cx + cell.cz * cell.cz))));

    grid.innerHTML = `
      <div class="world-builder__bound-field">
        <span>Elevation</span>
        <strong style="color: #f8f0dc">${(cell.elevation * 100).toFixed(0)}%</strong>
      </div>
      <div class="world-builder__bound-field">
        <span>Temperature</span>
        <strong style="color: #f8f0dc">${(cell.temperature * 50).toFixed(0)}°C</strong>
      </div>
      <div class="world-builder__bound-field">
        <span>Moisture</span>
        <strong style="color: #f8f0dc">${(cell.moisture * 100).toFixed(0)}%</strong>
      </div>
      <div class="world-builder__bound-field">
        <span>Danger</span>
        <strong style="color: ${danger > 5 ? "#ef4444" : "#fbbf24"}">${danger}/10</strong>
      </div>
    `;
    this._chunkInspectorEl.appendChild(grid);

    // Features list
    const features = document.createElement("div");
    features.className = "world-builder__inspector-features";

    let hasFeature = false;
    if (cell.hasStructure) {
      hasFeature = true;
      const f = document.createElement("div");
      f.textContent = "🏰 Ancient Structure Ruins (Landmark / Stronghold)";
      features.appendChild(f);
    }

    if (cell.settlement) {
      hasFeature = true;
      const f = document.createElement("div");
      const icon = cell.settlement.type === "capital" ? "👑" : cell.settlement.type === "castle" ? "🛡️" : "🏘️";
      f.textContent = `${icon} Settlement: ${cell.settlement.name} (${cell.settlement.type}, ${cell.settlement.faction})`;
      features.appendChild(f);
    }

    if (cell.dungeon) {
      hasFeature = true;
      const f = document.createElement("div");
      const icon =
        cell.dungeon.theme === "barrow"
          ? "🗝️"
          : cell.dungeon.theme === "crypt"
            ? "💀"
            : cell.dungeon.theme === "catacomb"
              ? "🏛️"
              : "🦇";
      f.textContent = `${icon} Dungeon: ${cell.dungeon.name} (${cell.dungeon.theme}, Danger ${cell.dungeon.dangerLevel}/10, Boss: ${cell.dungeon.bossType})`;
      features.appendChild(f);
    }

    if (cell.isWaterBody || (cell.riverFlow ?? 0) > 0) {
      hasFeature = true;
      const w = this._sys.riverGen.getWaterInfoAt(cell.cx, cell.cz);
      const f = document.createElement("div");
      f.textContent = w.name
        ? `🌊 Waterbody: ${w.name} (Flow rate: ${Math.round(cell.riverFlow ?? 1)})`
        : `🌊 Water Channel (Flow rate: ${Math.round(cell.riverFlow ?? 1)})`;
      features.appendChild(f);
    }

    const prov = this._sys.getProvinceAt(cell.cx, cell.cz);
    if (prov) {
      hasFeature = true;
      const f = document.createElement("div");
      const capital = this._sys.settlements.find((s) => s.id === prov.settlementId);
      const capInfo = capital ? ` (Capital: ${capital.name})` : "";
      f.textContent = `🚩 Province: ${prov.name}${capInfo}`;
      features.appendChild(f);
    }

    if (reg) {
      hasFeature = true;
      const f = document.createElement("div");
      f.textContent = `📍 Region: ${reg.name} (${reg.biome}, Encounter Rate: ${Math.round(reg.encounterRate * 100)}%)`;
      features.appendChild(f);
    }

    if (cell.resourceNodes && cell.resourceNodes.length > 0) {
      hasFeature = true;
      const f = document.createElement("div");
      const resIcons: Record<string, string> = {
        iron_ore: "⛏️ Iron",
        silver_ore: "⛏️ Silver",
        mithril_ore: "💎 Mithril",
        gold_deposit: "🪙 Gold",
        kingsbloom: "🌿 Kingsbloom",
        mana_crystal: "✨ Mana Crystal",
      };
      const resLabels = cell.resourceNodes
        .map((r) => `${r.name || resIcons[r.type] || r.type} (Richness: ${r.richness}/5, ${r.rarity})`)
        .join(", ");
      f.textContent = `⛏️ Resource Deposits: ${resLabels}`;
      features.appendChild(f);
    }

    if (!hasFeature) {
      const f = document.createElement("div");
      f.style.color = "#a89880";
      f.textContent = "Open wilderness terrain. No settlements or dungeons detected.";
      features.appendChild(f);
    }
    this._chunkInspectorEl.appendChild(features);

    // Inspector Action Buttons Row
    const actionsRow = document.createElement("div");
    actionsRow.className = "world-builder__row";
    actionsRow.style.marginTop = "8px";

    const createRegBtn = document.createElement("button");
    createRegBtn.type = "button";
    createRegBtn.className = "world-builder__btn world-builder__btn--sm world-builder__btn--primary";
    createRegBtn.textContent = "+ Region Around Chunk";
    createRegBtn.addEventListener("click", () => {
      const id = `reg_${Date.now().toString(36)}`;
      const newReg: WorldRegion = {
        id,
        name: `Region near (${cell.cx}, ${cell.cz})`,
        bounds: { minCX: cell.cx - 1, minCZ: cell.cz - 1, maxCX: cell.cx + 1, maxCZ: cell.cz + 1 },
        biome: cell.biome,
        dangerLevel: danger,
        encounterRate: 1.0,
        description: `Authored around chunk (${cell.cx}, ${cell.cz}).`,
      };
      this._sys.addRegion(newReg);
      this._expandedRegionId = id;
      this._renderRegions();
      this.renderPreview();
      this._setStatus(`Created region '${newReg.name}' centered at (${cell.cx}, ${cell.cz}).`, "info");
      this._renderChunkInspector(cell);
    });
    actionsRow.appendChild(createRegBtn);

    const copyCoordsBtn = document.createElement("button");
    copyCoordsBtn.type = "button";
    copyCoordsBtn.className = "world-builder__btn world-builder__btn--sm";
    copyCoordsBtn.textContent = "📋 Copy Coords";
    copyCoordsBtn.title = "Copy chunk coordinates to clipboard";
    copyCoordsBtn.setAttribute("aria-label", "Copy chunk coordinates");
    copyCoordsBtn.addEventListener("click", () => {
      const text = `chunk: (${cell.cx}, ${cell.cz})`;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      this._setStatus(`Copied '${text}' to clipboard!`, "info");
    });
    actionsRow.appendChild(copyCoordsBtn);

    const deselectBtn = document.createElement("button");
    deselectBtn.type = "button";
    deselectBtn.className = "world-builder__btn world-builder__btn--sm";
    deselectBtn.textContent = "Deselect";
    deselectBtn.setAttribute("aria-label", "Deselect chunk");
    deselectBtn.addEventListener("click", () => {
      this._selectedChunk = null;
      if (this._chunkInspectorEl) {
        this._chunkInspectorEl.style.display = "none";
      }
      this.renderPreview();
    });
    actionsRow.appendChild(deselectBtn);

    if (reg) {
      const editRegBtn = document.createElement("button");
      editRegBtn.type = "button";
      editRegBtn.className = "world-builder__btn world-builder__btn--sm";
      editRegBtn.textContent = `Edit '${reg.name}'`;
      editRegBtn.addEventListener("click", () => {
        this._expandedRegionId = reg.id;
        this._renderRegions();
        this._regionListEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      actionsRow.appendChild(editRegBtn);
    }

    this._chunkInspectorEl.appendChild(actionsRow);
  }

  // ── Custom Region Authoring ───────────────────────────────────────────────

  private _renderRegions(): void {
    if (!this._regionListEl) return;
    this._regionListEl.innerHTML = "";

    const allRegions = this._sys.regions;
    if (this._regionCountBadge) {
      this._regionCountBadge.textContent = allRegions.length.toString();
    }
    const query = this._searchQuery.trim().toLowerCase();
    const regions = query
      ? allRegions.filter(
          (r) =>
            r.name.toLowerCase().includes(query) ||
            r.biome.toLowerCase().includes(query) ||
            (r.description && r.description.toLowerCase().includes(query)),
        )
      : allRegions;

    if (allRegions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "world-builder__empty";
      empty.textContent = "No custom regions defined. Click '+ Add Region' to author one.";
      this._regionListEl.appendChild(empty);
      return;
    }

    if (regions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "world-builder__empty";
      empty.textContent = `No regions match search "${this._searchQuery}".`;
      this._regionListEl.appendChild(empty);
      return;
    }

    for (const reg of regions) {
      this._regionListEl.appendChild(this._buildRegionItem(reg));
    }
  }

  private _buildRegionItem(reg: WorldRegion): HTMLElement {
    const item = document.createElement("div");
    const isExpanded = this._expandedRegionId === reg.id;
    item.className = `world-builder__region-item${isExpanded ? " world-builder__region-item--expanded" : ""}`;

    // Summary Header Row
    const topRow = document.createElement("div");
    topRow.className = "world-builder__row world-builder__row--spaced";
    topRow.style.cursor = "pointer";

    const titleGroup = document.createElement("div");
    titleGroup.className = "world-builder__region-summary";

    const chevron = document.createElement("span");
    chevron.className = "world-builder__chevron";
    chevron.textContent = isExpanded ? "▼" : "▶";
    titleGroup.appendChild(chevron);

    const swatch = document.createElement("span");
    swatch.className = "world-builder__region-swatch";
    swatch.style.background = BIOME_PREVIEW_COLORS[reg.biome] || "#4caf50";
    titleGroup.appendChild(swatch);

    const nameTitle = document.createElement("strong");
    nameTitle.className = "world-builder__region-name";
    nameTitle.textContent = reg.name;
    titleGroup.appendChild(nameTitle);

    const biomePill = document.createElement("span");
    biomePill.className = "world-builder__pill";
    biomePill.style.background = BIOME_PREVIEW_COLORS[reg.biome] || "#4caf50";
    biomePill.textContent = reg.biome.toUpperCase();
    titleGroup.appendChild(biomePill);

    const isWidthValid = reg.bounds.maxCX >= reg.bounds.minCX;
    const isHeightValid = reg.bounds.maxCZ >= reg.bounds.minCZ;
    const isNameValid = reg.name.trim().length > 0;
    if (!isWidthValid || !isHeightValid || !isNameValid) {
      const warnBadge = document.createElement("span");
      warnBadge.className = "world-builder__badge world-builder__badge--warn";
      warnBadge.textContent = "⚠️ Invalid";
      warnBadge.title = !isNameValid ? "Name cannot be empty" : "Bounds min cannot exceed max";
      titleGroup.appendChild(warnBadge);
    }

    topRow.appendChild(titleGroup);

    const btnGroup = document.createElement("div");
    btnGroup.className = "world-builder__row";
    btnGroup.style.gap = "6px";

    const dupBtn = document.createElement("button");
    dupBtn.type = "button";
    dupBtn.className = "world-builder__btn world-builder__btn--sm";
    dupBtn.textContent = "Duplicate";
    dupBtn.title = "Duplicate this region";
    dupBtn.setAttribute("aria-label", `Duplicate region ${reg.name}`);
    dupBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cloned = this._sys.duplicateRegion(reg.id);
      if (cloned) {
        this._expandedRegionId = cloned.id;
        this._renderRegions();
        this.renderPreview();
        this._setStatus(`Duplicated region '${reg.name}' as '${cloned.name}'.`, "info");
      }
    });
    btnGroup.appendChild(dupBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    const isConfirming = this._confirmDeleteRegionId === reg.id;
    deleteBtn.className = `world-builder__btn world-builder__btn--sm ${isConfirming ? "world-builder__btn--delete-confirm" : "world-builder__btn--danger"}`;
    deleteBtn.textContent = isConfirming ? "Confirm?" : "Remove";
    deleteBtn.setAttribute("aria-label", isConfirming ? `Confirm removal of region ${reg.name}` : `Remove region ${reg.name}`);
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this._confirmDeleteRegionId === reg.id) {
        if (this._confirmDeleteTimer) {
          clearTimeout(this._confirmDeleteTimer);
          this._confirmDeleteTimer = null;
        }
        this._confirmDeleteRegionId = null;
        this._sys.removeRegion(reg.id);
        if (this._expandedRegionId === reg.id) {
          this._expandedRegionId = null;
        }
        this._renderRegions();
        this.renderPreview();
        this._setStatus(`Removed region '${reg.name}'.`, "info");
      } else {
        if (this._confirmDeleteTimer) {
          clearTimeout(this._confirmDeleteTimer);
        }
        this._confirmDeleteRegionId = reg.id;
        this._confirmDeleteTimer = setTimeout(() => {
          this._confirmDeleteRegionId = null;
          this._confirmDeleteTimer = null;
          this._renderRegions();
        }, 3000);
        this._renderRegions();
      }
    });
    btnGroup.appendChild(deleteBtn);
    topRow.appendChild(btnGroup);

    topRow.addEventListener("click", () => {
      this._expandedRegionId = isExpanded ? null : reg.id;
      this._renderRegions();
    });
    item.appendChild(topRow);

    const metaRow = document.createElement("div");
    metaRow.className = "world-builder__region-meta";
    metaRow.textContent = `Danger: ${reg.dangerLevel}/10 | Bounds: [${reg.bounds.minCX}, ${reg.bounds.minCZ}] to [${reg.bounds.maxCX}, ${reg.bounds.maxCZ}]`;
    item.appendChild(metaRow);

    // If expanded, render the in-place editor form
    if (isExpanded) {
      const form = document.createElement("div");
      form.className = "world-builder__region-edit-form";

      // 1. Name Input
      const nameField = document.createElement("div");
      nameField.className = "world-builder__field";
      const nameLbl = document.createElement("label");
      nameLbl.className = "world-builder__label";
      nameLbl.textContent = "Region Name";
      nameField.appendChild(nameLbl);
      const nameInp = document.createElement("input");
      nameInp.type = "text";
      nameInp.className = "world-builder__input";
      nameInp.value = reg.name;
      nameInp.addEventListener("input", () => {
        reg.name = nameInp.value.trim() || reg.name;
        nameTitle.textContent = reg.name;
        this.renderPreview();
      });
      nameField.appendChild(nameInp);
      form.appendChild(nameField);

      // 2. Biome Select
      const biomeField = document.createElement("div");
      biomeField.className = "world-builder__field";
      const biomeLbl = document.createElement("label");
      biomeLbl.className = "world-builder__label";
      biomeLbl.textContent = "Primary Biome";
      biomeField.appendChild(biomeLbl);
      const biomeSel = document.createElement("select");
      biomeSel.className = "world-builder__select";
      for (const b of ["plains", "forest", "desert", "tundra"]) {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b.charAt(0).toUpperCase() + b.slice(1);
        if (b === reg.biome) opt.selected = true;
        biomeSel.appendChild(opt);
      }
      biomeSel.addEventListener("change", () => {
        reg.biome = biomeSel.value as any;
        biomePill.textContent = reg.biome.toUpperCase();
        biomePill.style.background = BIOME_PREVIEW_COLORS[reg.biome] || "#4caf50";
        this.renderPreview();
      });
      biomeField.appendChild(biomeSel);
      form.appendChild(biomeField);

      // 3. Danger Level Slider
      const dangerField = document.createElement("div");
      dangerField.className = "world-builder__field";
      const dangerLbl = document.createElement("label");
      dangerLbl.className = "world-builder__label world-builder__label--slider";
      const dangerSpan = document.createElement("span");
      dangerSpan.className = "world-builder__val-span";
      dangerSpan.textContent = reg.dangerLevel.toString();
      dangerLbl.innerHTML = "<span>Danger Level (1-10)</span>";
      dangerLbl.appendChild(dangerSpan);
      dangerField.appendChild(dangerLbl);
      const dangerInp = document.createElement("input");
      dangerInp.type = "range";
      dangerInp.min = "1";
      dangerInp.max = "10";
      dangerInp.step = "1";
      dangerInp.value = reg.dangerLevel.toString();
      dangerInp.className = "world-builder__range";
      dangerInp.addEventListener("input", () => {
        reg.dangerLevel = parseInt(dangerInp.value, 10);
        dangerSpan.textContent = dangerInp.value;
        metaRow.textContent = `Danger: ${reg.dangerLevel}/10 | Bounds: [${reg.bounds.minCX}, ${reg.bounds.minCZ}] to [${reg.bounds.maxCX}, ${reg.bounds.maxCZ}]`;
      });
      dangerField.appendChild(dangerInp);
      form.appendChild(dangerField);

      // 4. Encounter Rate Slider
      const encField = document.createElement("div");
      encField.className = "world-builder__field";
      const encLbl = document.createElement("label");
      encLbl.className = "world-builder__label world-builder__label--slider";
      const encSpan = document.createElement("span");
      encSpan.className = "world-builder__val-span";
      encSpan.textContent = `${(reg.encounterRate * 100).toFixed(0)}%`;
      encLbl.innerHTML = "<span>Encounter Rate Multiplier</span>";
      encLbl.appendChild(encSpan);
      encField.appendChild(encLbl);
      const encInp = document.createElement("input");
      encInp.type = "range";
      encInp.min = "0.2";
      encInp.max = "2.5";
      encInp.step = "0.1";
      encInp.value = reg.encounterRate.toString();
      encInp.className = "world-builder__range";
      encInp.addEventListener("input", () => {
        reg.encounterRate = parseFloat(encInp.value);
        encSpan.textContent = `${(reg.encounterRate * 100).toFixed(0)}%`;
      });
      encField.appendChild(encInp);
      form.appendChild(encField);

      // 5. Bounds Card with Steppers
      const boundsCard = document.createElement("div");
      boundsCard.className = "world-builder__bounds-card";

      const boundsHeader = document.createElement("div");
      boundsHeader.className = "world-builder__row world-builder__row--spaced";
      const boundsTitle = document.createElement("strong");
      boundsTitle.style.fontSize = "0.78rem";
      boundsTitle.style.color = "#d4a017";
      boundsTitle.textContent = "Chunk Grid Span (Bounds)";
      boundsHeader.appendChild(boundsTitle);

      const boundsActions = document.createElement("div");
      boundsActions.className = "world-builder__row";
      boundsActions.style.gap = "4px";

      const expBtn = document.createElement("button");
      expBtn.type = "button";
      expBtn.className = "world-builder__btn world-builder__btn--sm";
      expBtn.textContent = "+ Expand";
      expBtn.title = "Expand bounds by 1 chunk in all directions";
      expBtn.addEventListener("click", () => {
        this._sys.expandRegionBounds(reg.id, 1);
        this._renderRegions();
        this.renderPreview();
      });
      boundsActions.appendChild(expBtn);

      const cntBtn = document.createElement("button");
      cntBtn.type = "button";
      cntBtn.className = "world-builder__btn world-builder__btn--sm";
      cntBtn.textContent = "- Contract";
      cntBtn.title = "Contract bounds by 1 chunk in all directions";
      cntBtn.addEventListener("click", () => {
        this._sys.contractRegionBounds(reg.id, 1);
        this._renderRegions();
        this.renderPreview();
      });
      boundsActions.appendChild(cntBtn);
      boundsHeader.appendChild(boundsActions);
      boundsCard.appendChild(boundsHeader);

      // Bounds 4-col Steppers
      const boundsGrid = document.createElement("div");
      boundsGrid.className = "world-builder__grid-4col";

      const makeBoundStepper = (label: string, val: number, onDelta: (d: number) => void) => {
        const col = document.createElement("div");
        col.className = "world-builder__bound-field";
        const l = document.createElement("span");
        l.textContent = label;
        col.appendChild(l);

        const stepperRow = document.createElement("div");
        stepperRow.className = "world-builder__row";
        stepperRow.style.gap = "2px";

        const decBtn = document.createElement("button");
        decBtn.type = "button";
        decBtn.className = "world-builder__btn world-builder__btn--sm";
        decBtn.style.padding = "2px 6px";
        decBtn.textContent = "-";
        decBtn.addEventListener("click", () => onDelta(-1));
        stepperRow.appendChild(decBtn);

        const valEl = document.createElement("span");
        valEl.style.fontWeight = "700";
        valEl.style.color = "#f8f0dc";
        valEl.style.minWidth = "20px";
        valEl.style.textAlign = "center";
        valEl.textContent = val.toString();
        stepperRow.appendChild(valEl);

        const incBtn = document.createElement("button");
        incBtn.type = "button";
        incBtn.className = "world-builder__btn world-builder__btn--sm";
        incBtn.style.padding = "2px 6px";
        incBtn.textContent = "+";
        incBtn.addEventListener("click", () => onDelta(1));
        stepperRow.appendChild(incBtn);

        col.appendChild(stepperRow);
        return col;
      };

      boundsGrid.appendChild(
        makeBoundStepper("Min CX", reg.bounds.minCX, (d) => {
          this._sys.setRegionBounds(reg.id, { ...reg.bounds, minCX: reg.bounds.minCX + d });
          this._renderRegions();
          this.renderPreview();
        }),
      );
      boundsGrid.appendChild(
        makeBoundStepper("Max CX", reg.bounds.maxCX, (d) => {
          this._sys.setRegionBounds(reg.id, { ...reg.bounds, maxCX: reg.bounds.maxCX + d });
          this._renderRegions();
          this.renderPreview();
        }),
      );
      boundsGrid.appendChild(
        makeBoundStepper("Min CZ", reg.bounds.minCZ, (d) => {
          this._sys.setRegionBounds(reg.id, { ...reg.bounds, minCZ: reg.bounds.minCZ + d });
          this._renderRegions();
          this.renderPreview();
        }),
      );
      boundsGrid.appendChild(
        makeBoundStepper("Max CZ", reg.bounds.maxCZ, (d) => {
          this._sys.setRegionBounds(reg.id, { ...reg.bounds, maxCZ: reg.bounds.maxCZ + d });
          this._renderRegions();
          this.renderPreview();
        }),
      );
      boundsCard.appendChild(boundsGrid);

      // Center On Selected Cell button if selected chunk is available
      if (this._selectedChunk) {
        const centerBtn = document.createElement("button");
        centerBtn.type = "button";
        centerBtn.className = "world-builder__btn world-builder__btn--sm";
        centerBtn.style.marginTop = "6px";
        centerBtn.style.width = "100%";
        centerBtn.textContent = `🎯 Center Bounds on Selected Chunk (${this._selectedChunk.cx}, ${this._selectedChunk.cz})`;
        centerBtn.addEventListener("click", () => {
          if (!this._selectedChunk) return;
          const halfW = Math.max(1, Math.round(Math.abs(reg.bounds.maxCX - reg.bounds.minCX) / 2));
          const halfH = Math.max(1, Math.round(Math.abs(reg.bounds.maxCZ - reg.bounds.minCZ) / 2));
          this._sys.setRegionBounds(reg.id, {
            minCX: this._selectedChunk.cx - halfW,
            maxCX: this._selectedChunk.cx + halfW,
            minCZ: this._selectedChunk.cz - halfH,
            maxCZ: this._selectedChunk.cz + halfH,
          });
          this._renderRegions();
          this.renderPreview();
          this._setStatus(
            `Centered region '${reg.name}' on chunk (${this._selectedChunk.cx}, ${this._selectedChunk.cz}).`,
            "info",
          );
        });
        boundsCard.appendChild(centerBtn);
      }

      form.appendChild(boundsCard);

      // 6. Lore Description Input
      const descField = document.createElement("div");
      descField.className = "world-builder__field";
      const descLbl = document.createElement("label");
      descLbl.className = "world-builder__label";
      descLbl.textContent = "Region Lore / Description";
      descField.appendChild(descLbl);
      const descInp = document.createElement("input");
      descInp.type = "text";
      descInp.className = "world-builder__input";
      descInp.value = reg.description || "";
      descInp.placeholder = "Enter historical lore or regional notes...";
      descInp.addEventListener("input", () => {
        reg.description = descInp.value;
      });
      descField.appendChild(descInp);
      form.appendChild(descField);

      item.appendChild(form);
    }

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
    this._expandedRegionId = id;
    this._renderRegions();
    this.renderPreview();
    this._setStatus(`Added region '${newReg.name}'.`, "info");
  }

  private _showAnalyticsModal(): void {
    const stats = this._sys.computeWorldAnalytics(this._radius);

    const modal = document.createElement("div");
    modal.className = "world-builder__analytics-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "World Analytics");

    const content = document.createElement("div");
    content.className = "world-builder__analytics-content";

    const header = document.createElement("div");
    header.className = "world-builder__row world-builder__row--spaced";
    header.style.marginBottom = "14px";
    header.style.paddingBottom = "8px";
    header.style.borderBottom = "1px solid rgba(212, 160, 23, 0.3)";

    const title = document.createElement("h3");
    title.className = "world-builder__title";
    title.style.fontSize = "1.1rem";
    title.style.margin = "0";
    title.textContent = "📊 Realm Analytics & Demographics";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "world-builder__btn world-builder__btn--sm";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "Close analytics");
    closeBtn.addEventListener("click", () => modal.remove());
    header.appendChild(closeBtn);
    content.appendChild(header);

    // Body content: Overview metrics grid
    const statsGrid = document.createElement("div");
    statsGrid.className = "world-builder__grid-4col";
    statsGrid.style.marginBottom = "14px";
    statsGrid.innerHTML = `
      <div class="world-builder__bound-field">
        <span>Surveyed Area</span>
        <strong style="color: #f8f0dc">${stats.totalChunks} Chunks</strong>
      </div>
      <div class="world-builder__bound-field">
        <span>Avg Danger</span>
        <strong style="color: ${stats.averageDangerLevel > 5 ? "#ef4444" : "#fbbf24"}">${stats.averageDangerLevel.toFixed(1)} / 10</strong>
      </div>
      <div class="world-builder__bound-field">
        <span>Avg Elevation</span>
        <strong style="color: #f8f0dc">${(stats.averageElevation * 100).toFixed(0)}%</strong>
      </div>
      <div class="world-builder__bound-field">
        <span>Settlements</span>
        <strong style="color: #f8f0dc">${stats.totalSettlements}</strong>
      </div>
      <div class="world-builder__bound-field">
        <span>Dungeons</span>
        <strong style="color: #f8f0dc">${stats.totalDungeons}</strong>
      </div>
      <div class="world-builder__bound-field">
        <span>Water Bodies</span>
        <strong style="color: #f8f0dc">${stats.totalWaterways}</strong>
      </div>
      <div class="world-builder__bound-field">
        <span>Resource Veins</span>
        <strong style="color: #f8f0dc">${stats.totalResourceNodes}</strong>
      </div>
      <div class="world-builder__bound-field">
        <span>Avg Temp</span>
        <strong style="color: #f8f0dc">${(stats.averageTemperature * 50).toFixed(0)}°C</strong>
      </div>
    `;
    content.appendChild(statsGrid);

    // Biome Distribution section
    const biomeTitle = document.createElement("h4");
    biomeTitle.className = "world-builder__card-title";
    biomeTitle.style.marginBottom = "8px";
    biomeTitle.textContent = "Terrain & Biome Composition";
    content.appendChild(biomeTitle);

    const biomeList = document.createElement("div");
    biomeList.style.display = "flex";
    biomeList.style.flexDirection = "column";
    biomeList.style.gap = "6px";
    biomeList.style.marginBottom = "14px";

    for (const [b, info] of Object.entries(stats.biomeCoverage)) {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.fontSize = "0.82rem";

      const left = document.createElement("span");
      const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${BIOME_PREVIEW_COLORS[b as BiomeType] || "#4caf50"};margin-right:6px;vertical-align:middle;"></span>`;
      left.innerHTML = `${dot} ${b.charAt(0).toUpperCase() + b.slice(1)}`;

      const right = document.createElement("strong");
      right.style.color = "#f8f0dc";
      right.textContent = `${info.percentage.toFixed(1)}% (${info.count})`;

      row.appendChild(left);
      row.appendChild(right);
      biomeList.appendChild(row);
    }
    content.appendChild(biomeList);

    // Resource Breakdown section
    const resCounts: Record<string, number> = {};
    for (const r of this._sys.resourceNodes) {
      resCounts[r.type] = (resCounts[r.type] || 0) + 1;
    }

    if (Object.keys(resCounts).length > 0) {
      const resTitle = document.createElement("h4");
      resTitle.className = "world-builder__card-title";
      resTitle.style.marginBottom = "8px";
      resTitle.textContent = "Mineral & Botanical Reserves";
      content.appendChild(resTitle);

      const resList = document.createElement("div");
      resList.style.display = "grid";
      resList.style.gridTemplateColumns = "1fr 1fr";
      resList.style.gap = "6px";
      resList.style.fontSize = "0.8rem";

      const resLabels: Record<string, string> = {
        iron_ore: "⛏️ Iron Ore",
        silver_ore: "⛏️ Silver Ore",
        mithril_ore: "💎 Mithril Deposit",
        gold_deposit: "🪙 Gold Deposit",
        kingsbloom: "🌿 Kingsbloom",
        mana_crystal: "✨ Mana Crystal",
      };

      for (const [r, count] of Object.entries(resCounts)) {
        const item = document.createElement("div");
        item.style.color = "#a89880";
        item.innerHTML = `<span style="color:#f8f0dc">${resLabels[r] || r}</span>: <strong>${count}</strong>`;
        resList.appendChild(item);
      }
      content.appendChild(resList);
    }

    // Modal Footer close button
    const modalFooter = document.createElement("div");
    modalFooter.className = "world-builder__row";
    modalFooter.style.justifyContent = "flex-end";
    modalFooter.style.marginTop = "16px";

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "world-builder__btn world-builder__btn--primary";
    doneBtn.textContent = "Done";
    doneBtn.addEventListener("click", () => modal.remove());
    modalFooter.appendChild(doneBtn);
    content.appendChild(modalFooter);

    modal.appendChild(content);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    const parent = this._root ?? document.body;
    parent.appendChild(modal);
  }
}
