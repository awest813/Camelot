/**
 * EditorSuite — the in-game editor tools: map editor and its panels, the
 * quest / dialogue / NPC / item / faction / loot / spawn creators, world
 * builder, content bundles, asset browser, bundle merge, mod manifest,
 * workspace drafts and the editor hub.
 *
 * Moved out of game.ts as one unit (engine overhaul, Phase 1).  Phase 9
 * turns this into the separate editor app; until then it is constructed by
 * the game and talks to it through {@link EditorHost}.
 */
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { NPC } from "../../entities/npc";
import { Loot } from "../../entities/loot";
import { frameworkBaseContent } from "../../framework/content/base-content";
import { MapEditorSystem } from "../../systems/map-editor-system";
import { MapEditorPropertyPanel } from "../../ui/map-editor-property-panel";
import { MapEditorToolbar } from "../../ui/map-editor-toolbar";
import { MapEditorHierarchyPanel } from "../../ui/map-editor-hierarchy-panel";
import { MapEditorValidationPanel } from "../../ui/map-editor-validation-panel";
import { MapEditorPalettePanel } from "../../ui/map-editor-palette-panel";
import { MapEditorLayerPanel } from "../../ui/map-editor-layer-panel";
import { MapEditorNotesPanel } from "../../ui/map-editor-notes-panel";
import { CellManager } from "../../world/cell-manager";
import { QuestCreatorSystem } from "../../systems/quest-creator-system";
import { QuestCreatorUI } from "../../ui/quest-creator-ui";
import { DialogueCreatorSystem } from "../../systems/dialogue-creator-system";
import { DialogueCreatorUI } from "../../ui/dialogue-creator-ui";
import { NpcCreatorSystem } from "../../systems/npc-creator-system";
import { NpcCreatorUI } from "../../ui/npc-creator-ui";
import { ItemCreatorSystem } from "../../systems/item-creator-system";
import { ItemCreatorUI } from "../../ui/item-creator-ui";
import { FactionCreatorSystem } from "../../systems/faction-creator-system";
import { FactionCreatorUI } from "../../ui/faction-creator-ui";
import { LootTableCreatorSystem } from "../../systems/loot-table-creator-system";
import { LootTableCreatorUI } from "../../ui/loot-table-creator-ui";
import { SpawnCreatorSystem } from "../../systems/spawn-creator-system";
import { SpawnCreatorUI } from "../../ui/spawn-creator-ui";
import { WorldBuilderSystem } from "../../systems/world-builder-system";
import { WorldBuilderUI } from "../../ui/world-builder-ui";
import { DungeonGenerator } from "../../world/dungeon-generator";
import { ContentBundleSystem } from "../../systems/content-bundle-system";
import { ContentBundleUI } from "../../ui/content-bundle-ui";
import { EditorHubUI, type EditorToolId } from "../../ui/editor-hub-ui";
import { EditorLayout } from "../../ui/editor-layout";
import { AssetBrowserSystem } from "../../systems/asset-browser-system";
import { AssetBrowserUI } from "../../ui/asset-browser-ui";
import { BundleMergeSystem } from "../../systems/bundle-merge-system";
import { BundleMergeUI } from "../../ui/bundle-merge-ui";
import { WorkspaceDraftSystem } from "../../systems/workspace-draft-system";
import { ModManifestSystem } from "../../systems/mod-manifest-system";
import { ModManifestUI } from "../../ui/mod-manifest-ui";
import type { Item } from "../../systems/inventory-system";
import type { Game } from "../../game";

/** What the editors use from the game. */
export type EditorHost = Pick<Game, "canvas" | "cellManager" | "fastTravelSystem" | "frameworkRuntime" | "interactionSystem" | "isPaused" | "lootTableSystem" | "player" | "scene" | "ui" | "world">;

/** Game input hand-off and notifications the editors need. */
export interface EditorHooks {
  /** Give input to a panel (release the pointer, stop the camera). */
  suspendGameplay(): void;
  /** Give input back to play. */
  restoreGameplay(): void;
  /** The map editor turned on or off (e.g. refresh the help overlay). */
  modeChanged(): void;
}

/** A tool window that opens and closes. */
interface ToolWindow { readonly isVisible: boolean; open(): void; close(): void }

const MAP_EDITOR_AUTHOR_STORAGE_KEY = "camelot_map_editor_author";

/**
 * Asset Browser type → hub tool for the "Insert" action (opens the asset's
 * authoring tool through the same dispatch as the Editor Hub).
 */
const ASSET_TYPE_TO_EDITOR_TOOL: Readonly<Record<string, EditorToolId>> = {
  item: "item",
  npc: "npc",
  quest: "quest",
  dialogue: "dialogue",
  faction: "faction",
  lootTable: "lootTable",
  spawn: "spawn",
  map: "map",
};

export class EditorSuite {
  public mapEditorSystem!: MapEditorSystem;
  public mapEditorPropertyPanel!: MapEditorPropertyPanel;
  public mapEditorToolbar!: MapEditorToolbar;
  public mapEditorHierarchyPanel!: MapEditorHierarchyPanel;
  public mapEditorValidationPanel!: MapEditorValidationPanel;
  public mapEditorPalettePanel!: MapEditorPalettePanel;
  public mapEditorLayerPanel!: MapEditorLayerPanel;
  public mapEditorNotesPanel!: MapEditorNotesPanel;
  public questCreatorSystem!: QuestCreatorSystem;
  public questCreatorUI!: QuestCreatorUI;
  public dialogueCreatorSystem!: DialogueCreatorSystem;
  public dialogueCreatorUI!: DialogueCreatorUI;
  public npcCreatorSystem!: NpcCreatorSystem;
  public npcCreatorUI!: NpcCreatorUI;
  public itemCreatorSystem!: ItemCreatorSystem;
  public itemCreatorUI!: ItemCreatorUI;
  public factionCreatorSystem!: FactionCreatorSystem;
  public factionCreatorUI!: FactionCreatorUI;
  public lootTableCreatorSystem!: LootTableCreatorSystem;
  public lootTableCreatorUI!: LootTableCreatorUI;
  public spawnCreatorSystem!: SpawnCreatorSystem;
  public spawnCreatorUI!: SpawnCreatorUI;
  public worldBuilderSystem!: WorldBuilderSystem;
  public worldBuilderUI!: WorldBuilderUI;
  public contentBundleSystem!: ContentBundleSystem;
  public contentBundleUI!: ContentBundleUI;
  public assetBrowserSystem!: AssetBrowserSystem;
  public assetBrowserUI!: AssetBrowserUI;
  public bundleMergeSystem!: BundleMergeSystem;
  public bundleMergeUI!: BundleMergeUI;
  public modManifestSystem!: ModManifestSystem;
  public modManifestUI!: ModManifestUI;
  public workspaceDraftSystem!: WorkspaceDraftSystem;
  public editorHubUI!: EditorHubUI;
  public editorLayout!: EditorLayout;

  constructor(private readonly host: EditorHost, private readonly hooks: EditorHooks) {
    this.mapEditorSystem = new MapEditorSystem(this.host.scene);
    this.mapEditorSystem.currentAuthor = this.loadAuthor();

    // ── Editor layout — panel registry and unified selection model ────────────
    this.editorLayout = new EditorLayout();
    this.editorLayout.registerPanel("hierarchy",  { side: "left",   size: 240, isVisible: false });
    this.editorLayout.registerPanel("palette",    { side: "left",   size: 220, isVisible: false });
    this.editorLayout.registerPanel("layers",     { side: "left",   size: 220, isVisible: false });
    this.editorLayout.registerPanel("notes",      { side: "float",             isVisible: false });
    this.editorLayout.registerPanel("properties", { side: "right",  size: 300, isVisible: false });
    this.editorLayout.registerPanel("validation", { side: "bottom", size: 200, isVisible: false });

    // ── Map editor property panel ─────────────────────────────────────────────
    this.mapEditorPropertyPanel = new MapEditorPropertyPanel(this.host.ui.uiTexture);
    this.mapEditorPropertyPanel.onApply = (entityId, props, layerName) => {
      this.mapEditorSystem.setEntityProperties(entityId, props);
      this.mapEditorSystem.setEntityLayer(entityId, layerName);
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
      this.refreshLayerPanel();
      this.host.ui.showNotification("Properties applied", 1200);
    };
    this.mapEditorPropertyPanel.onDelete = (entityId) => {
      this.mapEditorSystem.removeEntity(entityId);
      this.host.ui.showNotification("Entity deleted", 1200);
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
      this.refreshLayerPanel();
      this.refreshToolbar();
    };
    // Route entity selection through the unified EditorLayout selection model.
    this.mapEditorSystem.onEntitySelectionChanged = (entityId) => {
      this.editorLayout.setSelection(entityId);
    };
    this.editorLayout.onSelectionChanged = (entityId) => {
      if (entityId === null) {
        this.mapEditorPropertyPanel.hide();
        this.editorLayout.setVisible("properties", false);
        this.mapEditorHierarchyPanel.setSelection(null);
        return;
      }
      const entity = this.mapEditorSystem.getEntityProperties(entityId);
      const mesh = this.host.scene.getMeshByName(entityId);
      const type = mesh?.metadata?.editorType;
      const position = this.mapEditorSystem.getEntityPosition(entityId) ?? undefined;
      if (type && entity !== null) {
        this.mapEditorPropertyPanel.show(
          entityId,
          type,
          entity,
          position,
          this.mapEditorSystem.getEntityLayer(entityId) ?? "objects",
        );
        this.editorLayout.setVisible("properties", true);
      }
      this.mapEditorHierarchyPanel.setSelection(entityId);
    };
    // Drive panel show/hide from layout changes (enables hideAll() to work).
    this.editorLayout.onLayoutChanged = (state) => {
      switch (state.panelId) {
        case "hierarchy":
          state.isVisible ? this.mapEditorHierarchyPanel.show() : this.mapEditorHierarchyPanel.hide();
          break;
        case "palette":
          state.isVisible ? this.mapEditorPalettePanel.show() : this.mapEditorPalettePanel.hide();
          break;
        case "layers":
          if (state.isVisible) {
            this.refreshLayerPanel();
            this.mapEditorLayerPanel.show();
          } else {
            this.mapEditorLayerPanel.hide();
          }
          break;
        case "notes":
          state.isVisible
            ? this.mapEditorNotesPanel.show(this.mapEditorSystem.notes)
            : this.mapEditorNotesPanel.hide();
          break;
        case "properties":
          if (!state.isVisible) this.mapEditorPropertyPanel.hide();
          break;
        case "validation":
          if (!state.isVisible) this.mapEditorValidationPanel.hide();
          break;
      }
    };

    // ── Map editor toolbar ────────────────────────────────────────────────────
    this.mapEditorToolbar = new MapEditorToolbar(this.host.ui.uiTexture);
    this.mapEditorToolbar.onPlacementTypeChange = (ptype) => {
      this.mapEditorSystem.currentPlacementType = ptype;
      this.refreshToolbar();
    };
    this.mapEditorToolbar.onGizmoModeChange = (gmode) => {
      this.mapEditorSystem.setGizmoMode(gmode);
      this.refreshToolbar();
    };
    this.mapEditorToolbar.onSnapSizeChange = (delta) => {
      const SNAP_MIN = 0.25;
      const SNAP_MAX = 16;
      this.mapEditorSystem.snapSize = Math.min(SNAP_MAX, Math.max(SNAP_MIN, this.mapEditorSystem.snapSize + delta));
      this.refreshToolbar();
    };

    // ── Map editor hierarchy panel ────────────────────────────────────────────
    this.mapEditorHierarchyPanel = new MapEditorHierarchyPanel(this.host.ui.uiTexture);
    this.mapEditorHierarchyPanel.onEntityClick = (entityId) => {
      this.mapEditorSystem.selectEntityById(entityId);
    };

    // ── Map editor validation panel ───────────────────────────────────────────
    this.mapEditorValidationPanel = new MapEditorValidationPanel(this.host.ui.uiTexture);
    this.mapEditorValidationPanel.onRevalidate = () => {
      const report = this.mapEditorSystem.validateMap(0.5, {
        knownLootTableIds: this.host.lootTableSystem.getTableIds(),
      });
      this.mapEditorValidationPanel.update(report);
    };
    this.mapEditorValidationPanel.onEntityFocus = (entityId) => {
      this.mapEditorSystem.selectEntityById(entityId);
    };

    // ── Map editor palette panel ──────────────────────────────────────────────
    this.mapEditorPalettePanel = new MapEditorPalettePanel(this.host.ui.uiTexture);
    this.mapEditorPalettePanel.onPlacementTypeChange = (ptype) => {
      this.mapEditorSystem.currentPlacementType = ptype;
      this.refreshToolbar();
    };
    this.mapEditorPalettePanel.onPlace = (ptype) => {
      this.mapEditorSystem.currentPlacementType = ptype;
      const placeAt = this.host.player.camera.position.add(this.host.player.getForwardDirection(8).scale(4));
      placeAt.y = Math.max(1, placeAt.y);
      this.mapEditorSystem.placeEntity(placeAt, ptype);
      this.host.ui.showNotification(`Placed: ${ptype}`, 1200);
      this.refreshToolbar();
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
      this.refreshLayerPanel();
    };
    this.mapEditorPalettePanel.onDuplicate = () => {
      const selId = this.mapEditorSystem.selectedEntityId;
      if (!selId) {
        this.host.ui.showNotification("No entity selected", 1200);
        return;
      }
      const newMesh = this.mapEditorSystem.duplicateEntity(selId);
      if (newMesh) {
        this.host.ui.showNotification("Entity duplicated", 1200);
        this.refreshToolbar();
        this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
        this.refreshLayerPanel();
      }
    };
    this.mapEditorPalettePanel.onDelete = () => {
      const selId = this.mapEditorSystem.selectedEntityId;
      if (!selId) {
        this.host.ui.showNotification("No entity selected", 1200);
        return;
      }
      this.mapEditorSystem.removeEntity(selId);
      this.host.ui.showNotification("Entity deleted", 1200);
      this.refreshToolbar();
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
      this.refreshLayerPanel();
    };

    // ── Map editor property panel: copy ID + position ─────────────────────────
    this.mapEditorPropertyPanel.onCopyId = (entityId) => {
      this.host.ui.showNotification(`Copied: ${entityId}`, 1200);
    };

    // ── Map editor system: entity moved (gizmo drag-end) ──────────────────────
    this.mapEditorSystem.onEntityMoved = (_entityId, position) => {
      this.mapEditorPropertyPanel.updatePosition(position);
      this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
    };

    // ── Map editor layer panel ────────────────────────────────────────────────
    this.mapEditorLayerPanel = new MapEditorLayerPanel(this.host.ui.uiTexture);
    this.mapEditorLayerPanel.onLayerVisibilityChange = (name, visible) => {
      this.mapEditorSystem.setLayerVisible(name, visible);
      this.refreshLayerPanel();
    };
    this.mapEditorLayerPanel.onLayerActivate = (name) => {
      const next = this.mapEditorSystem.activeLayerName === name ? null : name;
      this.mapEditorSystem.setActiveLayer(next);
      this.refreshLayerPanel();
      const msg = next === null
        ? "Layer targeting reset to placement defaults"
        : `New placements now target "${name}"`;
      this.host.ui.showNotification(msg, 1400);
    };
    this.mapEditorLayerPanel.onLayerLockChange = (name, locked) => {
      this.mapEditorSystem.setLayerLocked(name, locked);
      this.refreshLayerPanel();
      const msg = locked ? `Layer "${name}" locked` : `Layer "${name}" unlocked`;
      this.host.ui.showNotification(msg, 1200);
    };
    this.mapEditorLayerPanel.onLayerOwnerChange = (name, owner) => {
      this.mapEditorSystem.setLayerOwner(name, owner);
      this.persistAuthor(this.mapEditorSystem.currentAuthor);
      this.refreshLayerPanel();
      const trimmedOwner = owner.trim();
      const msg = trimmedOwner === ""
        ? `Cleared owner for "${name}"`
        : `Layer "${name}" claimed by ${trimmedOwner}`;
      this.host.ui.showNotification(msg, 1400);
    };
    this.mapEditorSystem.onLayerChanged = () => {
      this.refreshLayerPanel();
    };

    // ── Map editor notes panel ────────────────────────────────────────────────
    this.mapEditorNotesPanel = new MapEditorNotesPanel(this.host.ui.uiTexture);
    this.mapEditorNotesPanel.onSave = (text) => {
      this.mapEditorSystem.notes = text;
      this.host.ui.showNotification("Scene notes saved", 1200);
    };

    // ── Toolbar: camera frame callbacks ──────────────────────────────────────
    this.mapEditorToolbar.onFrameSelected = () => {
      const selId = this.mapEditorSystem.selectedEntityId;
      if (!selId) { this.host.ui.showNotification("No entity selected", 1000); return; }
      const pos = this.mapEditorSystem.getEntityPosition(selId);
      if (pos) {
        this.host.player.camera.target.set(pos.x, pos.y, pos.z);
        this.host.ui.showNotification("Framed selected entity", 1000);
      }
    };
    this.mapEditorToolbar.onFrameAll = () => {
      const summaries = this.mapEditorSystem.listEntitySummaries();
      if (summaries.length === 0) { this.host.ui.showNotification("No entities to frame", 1000); return; }
      let cx = 0, cy = 0, cz = 0;
      for (const s of summaries) { cx += s.position.x; cy += s.position.y; cz += s.position.z; }
      cx /= summaries.length; cy /= summaries.length; cz /= summaries.length;
      this.host.player.camera.target.set(cx, cy, cz);
      this.host.ui.showNotification(`Framed ${summaries.length} entities`, 1000);
    };

    // ── Quest Creator ──────────────────────────────────────────────────────────
    this.questCreatorSystem = new QuestCreatorSystem();
    this.questCreatorUI = new QuestCreatorUI(this.questCreatorSystem);
    this.questCreatorUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Dialogue Creator ───────────────────────────────────────────────────────
    this.dialogueCreatorSystem = new DialogueCreatorSystem();
    this.dialogueCreatorUI = new DialogueCreatorUI(this.dialogueCreatorSystem);
    this.dialogueCreatorUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── NPC Creator ────────────────────────────────────────────────────────────
    this.npcCreatorSystem = new NpcCreatorSystem();
    this.npcCreatorUI = new NpcCreatorUI(this.npcCreatorSystem);
    this.npcCreatorUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Item Creator ───────────────────────────────────────────────────────────
    this.itemCreatorSystem = new ItemCreatorSystem();
    this.itemCreatorUI = new ItemCreatorUI(this.itemCreatorSystem);
    this.itemCreatorUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Faction Creator ────────────────────────────────────────────────────────
    this.factionCreatorSystem = new FactionCreatorSystem();
    this.factionCreatorUI = new FactionCreatorUI(this.factionCreatorSystem);
    this.factionCreatorUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Loot Table Creator ─────────────────────────────────────────────────────
    this.lootTableCreatorSystem = new LootTableCreatorSystem();
    this.lootTableCreatorUI = new LootTableCreatorUI(this.lootTableCreatorSystem);
    this.lootTableCreatorUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── Spawn Creator ──────────────────────────────────────────────────────────
    this.spawnCreatorSystem = new SpawnCreatorSystem();
    this.spawnCreatorUI = new SpawnCreatorUI(this.spawnCreatorSystem);
    this.spawnCreatorUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
    };

    // ── World Builder ───────────────────────────────────────────────────────────
    this.worldBuilderSystem = new WorldBuilderSystem();
    this.worldBuilderUI = new WorldBuilderUI(this.worldBuilderSystem);
    this.worldBuilderUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      this.workspaceDraftSystem.markDirty();
      if (this.mapEditorSystem.isEnabled || this.host.isPaused) return;
      this.host.canvas.requestPointerLock();
      this.host.player.camera.attachControl(this.host.canvas, true);
    };
    this.worldBuilderUI.onApplyToWorld = (worldSeed, config) => {
      this.host.world.setSeed(worldSeed);
      if (config) {
        this.host.world.vegetationDensity = config.vegetationDensity;
        this.host.world.elevationScale = config.elevationScale;
      }
      this.host.world.setRegions(this.worldBuilderSystem.regions);

      // Register procedural settlements as discoverable fast-travel landmarks
      if (this.host.fastTravelSystem && this.worldBuilderSystem.settlements.length > 0) {
        for (const s of this.worldBuilderSystem.settlements) {
          const wp = new Vector3(s.cx * this.host.world.chunkSize, 2, s.cz * this.host.world.chunkSize);
          this.host.fastTravelSystem.discoverLocation(`settlement_${s.id}`, s.name, wp);
        }
      }

      // Generate seeded Arthurian barrows & crypts and register with CellManager and fast travel
      if (this.host.cellManager) {
        for (const d of this.worldBuilderSystem.dungeons) {
          const dungeonGen = new DungeonGenerator({
            seed: `${worldSeed.seedString}_${d.id}`,
            dangerLevel: d.dangerLevel,
            maxRooms: d.roomCount,
            theme: d.theme,
          });
          const cellDef = dungeonGen.toCellDefinition();
          cellDef.id = d.id;
          cellDef.name = d.name;
          this.host.cellManager.registerCell(cellDef);

          if (this.host.fastTravelSystem) {
            const dwp = new Vector3(d.cx * this.host.world.chunkSize, 2, d.cz * this.host.world.chunkSize);
            this.host.fastTravelSystem.discoverLocation(`dungeon_${d.id}`, d.name, dwp);
          }
        }
      }

      this.host.ui.showNotification(
        `Applied world seed: ${worldSeed.seedString} (${worldSeed.options.worldType} / ${worldSeed.options.biomeScale})`,
        3000,
      );
    };

    // ── Content Bundle ─────────────────────────────────────────────────────────
    this.contentBundleSystem = new ContentBundleSystem();
    this.contentBundleSystem
      .attachQuest(this.questCreatorSystem)
      .attachDialogue(this.dialogueCreatorSystem)
      .attachFaction(this.factionCreatorSystem)
      .attachLootTable(this.lootTableCreatorSystem)
      .attachNpc(this.npcCreatorSystem)
      .attachItem(this.itemCreatorSystem)
      .attachSpawn(this.spawnCreatorSystem)
      .attachWorldBuilder(this.worldBuilderSystem);
    this.contentBundleUI = new ContentBundleUI(this.contentBundleSystem);
    this.contentBundleUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.host.isPaused) return;
      this.host.canvas.requestPointerLock();
      this.host.player.camera.attachControl(this.host.canvas, true);
    };
    this.contentBundleUI.onPlayFromHere = (systemId) => {
      this.host.interactionSystem.isBlocked = true;
      document.exitPointerLock();
      this.host.player.camera.detachControl();
      switch (systemId) {
        case "map":
          if (!this.mapEditorSystem.isEnabled) {
            this.mapEditorSystem.toggle();
            this.mapEditorToolbar.show();
            this.editorLayout.setVisible("hierarchy", true);
            this.editorLayout.setVisible("palette", true);
            this.editorLayout.setVisible("layers", true);
            this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
            this.refreshToolbar();
          }
          break;
        case "quest":        this.questCreatorUI.open();        break;
        case "dialogue":     this.dialogueCreatorUI.open();     break;
        case "faction":      this.factionCreatorUI.open();      break;
        case "lootTable":    this.lootTableCreatorUI.open();    break;
        case "npc":          this.npcCreatorUI.open();          break;
        case "item":         this.itemCreatorUI.open();         break;
        case "spawn":        this.spawnCreatorUI.open();        break;
        case "worldBuilder": this.worldBuilderUI.open();        break;
        default: break;
      }
    };

    // ── Asset Browser ──────────────────────────────────────────────────────────
    this.assetBrowserSystem = new AssetBrowserSystem();
    this.assetBrowserUI = new AssetBrowserUI(this.assetBrowserSystem);
    this.assetBrowserUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.host.isPaused) return;
      this.host.canvas.requestPointerLock();
      this.host.player.camera.attachControl(this.host.canvas, true);
    };
    // Insert opens the asset's authoring tool (same dispatch as the hub).
    this.assetBrowserUI.onInsert = (asset) => {
      const tool = ASSET_TYPE_TO_EDITOR_TOOL[asset.type];
      if (tool) this.openTool(tool);
    };
    this.assetBrowserUI.onImportBundle = () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = ".json,.bundle.json";
      inp.addEventListener("change", () => {
        const file = inp.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result as string);
            const n = this.assetBrowserSystem.importFromBundle(parsed);
            this.assetBrowserUI.refresh();
            this.editorHubUI.setBadge("assets", this.assetBrowserSystem.size);
            this.host.ui.showNotification(`Asset Browser: imported ${n} asset${n !== 1 ? "s" : ""} from bundle.`, 2500);
          } catch {
            this.host.ui.showNotification("Asset Browser: failed to parse bundle JSON.", 2500);
          }
        };
        reader.readAsText(file);
      });
      inp.click();
    };

    // ── Bundle Merge ────────────────────────────────────────────────────────────
    this.bundleMergeSystem = new BundleMergeSystem();
    this.bundleMergeUI = new BundleMergeUI(this.bundleMergeSystem);
    this.bundleMergeUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.host.isPaused) return;
      this.host.canvas.requestPointerLock();
      this.host.player.camera.attachControl(this.host.canvas, true);
    };

    // ── Mod Manifest ────────────────────────────────────────────────────────────
    this.modManifestSystem = new ModManifestSystem();
    this.modManifestUI = new ModManifestUI(this.modManifestSystem);
    this.modManifestUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
      if (this.mapEditorSystem.isEnabled || this.host.isPaused) return;
      this.host.canvas.requestPointerLock();
      this.host.player.camera.attachControl(this.host.canvas, true);
    };

    // ── Workspace Draft ─────────────────────────────────────────────────────────
    this.workspaceDraftSystem = new WorkspaceDraftSystem();
    this.workspaceDraftSystem
      .attachQuest(this.questCreatorSystem)
      .attachDialogue(this.dialogueCreatorSystem)
      .attachFaction(this.factionCreatorSystem)
      .attachLootTable(this.lootTableCreatorSystem)
      .attachNpc(this.npcCreatorSystem)
      .attachItem(this.itemCreatorSystem)
      .attachSpawn(this.spawnCreatorSystem)
      .attachMap(this.mapEditorSystem)
      .attachWorldBuilder(this.worldBuilderSystem);
    this.workspaceDraftSystem.onSaved = () => {
      this.host.ui.showNotification("Workspace draft auto-saved.", 1500);
    };

    // ── Editor Hub ─────────────────────────────────────────────────────────────
    this.editorHubUI = new EditorHubUI({
      onOpen: (tool) => this.openTool(tool),
    });
    this.editorHubUI.onClose = () => {
      this.host.interactionSystem.isBlocked = this.mapEditorSystem.isEnabled;
    };
    this.seedAssetBrowser();
  }

  public refreshToolbar(): void {
    const { undo, redo } = this.mapEditorSystem.historySize;
    this.mapEditorToolbar.update({
      placementType:      this.mapEditorSystem.currentPlacementType,
      gizmoMode:          this.mapEditorSystem.mode,
      terrainTool:        this.mapEditorSystem.terrainTool,
      entityCount:        this.mapEditorSystem.entityCount,
      activePatrolGroupId: this.mapEditorSystem.activePatrolGroupId,
      snapSize:           this.mapEditorSystem.snapSize,
      undoCount:          undo,
      redoCount:          redo,
      typeCounts:         this.mapEditorSystem.getTypeCounts(),
    });
    this.mapEditorPalettePanel.setActivePlacementType(this.mapEditorSystem.currentPlacementType);
  }

  /** Refresh the layer panel after any layer or entity change. */
  public refreshLayerPanel(): void {
    this.mapEditorLayerPanel.currentAuthor = this.mapEditorSystem.currentAuthor;
    this.mapEditorLayerPanel.activeLayerName = this.mapEditorSystem.activeLayerName;
    this.mapEditorLayerPanel.refresh(
      this.mapEditorSystem.getLayers(),
      this.mapEditorSystem.getLayerEntityCounts(),
    );
  }

  /**
   * Open an editor tool: suspends gameplay input, then dispatches to the
   * matching creator UI. Shared by the Editor Hub and Asset Browser Insert.
   */
  public openTool(tool: EditorToolId): void {
      this.host.interactionSystem.isBlocked = true;
      document.exitPointerLock();
      this.host.player.camera.detachControl();
      switch (tool) {
        case "map":
          if (!this.mapEditorSystem.isEnabled) {
            this.mapEditorSystem.toggle();
            this.mapEditorToolbar.show();
            this.editorLayout.setVisible("hierarchy", true);
            this.editorLayout.setVisible("palette", true);
            this.editorLayout.setVisible("layers", true);
            this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
            this.refreshToolbar();
            this.host.ui.showNotification("Map Editor enabled (F2 to exit)", 2500);
          }
          break;
        case "quest":
          this.questCreatorUI.open();
          break;
        case "dialogue":
          this.dialogueCreatorUI.open();
          break;
        case "npc":
          this.npcCreatorUI.open();
          break;
        case "item":
          this.itemCreatorUI.open();
          break;
        case "faction":
          this.factionCreatorUI.open();
          break;
        case "lootTable":
          this.lootTableCreatorUI.open();
          break;
        case "spawn":
          this.spawnCreatorUI.open();
          break;
        case "worldBuilder":
          this.worldBuilderUI.open();
          break;
        case "bundle":
          this.contentBundleUI.open();
          break;
        case "assets":
          this.assetBrowserUI.open();
          break;
        case "merge":
          this.bundleMergeUI.open();
          break;
        case "modManifest":
          this.modManifestUI.open();
          break;
      }
  }

  /**
   * Register shipped base content so the Asset Browser opens populated
   * instead of empty (bundle imports add to the same registry).
   */
  public seedAssetBrowser(): void {
      const bundle = frameworkBaseContent;
      for (const d of bundle.dialogues) {
          this.assetBrowserSystem.register({
              id: d.id,
              name: `Dialogue: ${d.id}`,
              type: "dialogue",
              tags: ["dialogue"],
              description: `${d.nodes.length} dialogue nodes.`,
              dependencies: [],
          });
      }
      for (const q of bundle.quests) {
          this.assetBrowserSystem.register({
              id: q.id,
              name: q.name,
              type: "quest",
              tags: ["quest"],
              description: q.description ?? "",
              dependencies: [],
          });
      }
      for (const i of bundle.items) {
          this.assetBrowserSystem.register({
              id: i.id,
              name: i.name,
              type: "item",
              tags: ["item", ...(i.tags ?? [])],
              description: i.description,
              dependencies: [],
          });
      }
      for (const f of bundle.factions) {
          this.assetBrowserSystem.register({
              id: f.id,
              name: f.name,
              type: "faction",
              tags: ["faction"],
              description: f.description ?? "",
              dependencies: [],
          });
      }
      for (const n of bundle.npcArchetypes) {
          this.assetBrowserSystem.register({
              id: n.id,
              name: n.name,
              type: "npc",
              tags: ["npc", n.role],
              description: n.description ?? "",
              dependencies: [],
          });
      }
      this.editorHubUI.setBadge("assets", this.assetBrowserSystem.size);
  }

  public loadAuthor(): string {
    if (typeof localStorage === "undefined") {
      return "Local Author";
    }
    return localStorage.getItem(MAP_EDITOR_AUTHOR_STORAGE_KEY)?.trim() || "Local Author";
  }

  public persistAuthor(author: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(MAP_EDITOR_AUTHOR_STORAGE_KEY, author);
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────

  /** F2: the map editor on or off. */
  public toggleMapEditor(): void {
    if (this.mapEditorSystem.isEnabled) { this.exitMapEditor(); return; }
    this.mapEditorSystem.toggle();
    this.host.interactionSystem.isBlocked = true;
    document.exitPointerLock();
    this.host.player.camera.detachControl();
    this.mapEditorToolbar.show();
    this.editorLayout.setVisible("hierarchy", true);
    this.editorLayout.setVisible("palette", true);
    this.editorLayout.setVisible("layers", true);
    this.refreshToolbar();
    this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
    this.host.ui.showNotification("Map editor mode enabled", 1800);
    this.hooks.modeChanged();
  }

  /** Leave the map editor (F2 or Escape), hiding its panels. */
  public exitMapEditor(): void {
    if (!this.mapEditorSystem.isEnabled) return;
    this.mapEditorSystem.toggle();
    this.mapEditorToolbar.hide();
    for (const panel of ["hierarchy", "palette", "validation", "layers", "notes", "properties"] as const) {
      this.editorLayout.setVisible(panel, false);
    }
    this.editorLayout.clearSelection();
    this.hooks.restoreGameplay();
    this.host.ui.showNotification("Map editor mode disabled", 1800);
    this.hooks.modeChanged();
  }

  /** Open a tool window (taking input) or close it. */
  private _toggleTool(tool: ToolWindow): void {
    if (tool.isVisible) { tool.close(); return; }
    tool.open();
    this.hooks.suspendGameplay();
  }

  /** The hierarchy, toolbar and layers after the map changed. */
  private _refreshAfterEdit(): void {
    this.refreshToolbar();
    this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
    this.refreshLayerPanel();
  }

  /**
   * Editor and creator-tool chords.  The game sends keys the input adapter
   * did not take (all of them while the map editor is on).  Returns true
   * when the key was the editors'.
   */
  public handleKey(ev: { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
    const ed = this.mapEditorSystem;
    const ui = this.host.ui;
    const ctrl = ev.ctrlKey || ev.metaKey;
    const key = ev.key;
    const k = key.toLowerCase();
    const onlyInEditor = (fn: () => void): boolean => { if (ed.isEnabled) fn(); return true; };

    // Tools reachable from anywhere (mostly Shift + F-key).
    if (ev.shiftKey) {
      const tool: Record<string, ToolWindow | undefined> = {
        F4: this.worldBuilderUI, F5: this.bundleMergeUI, F6: this.assetBrowserUI, F8: this.lootTableCreatorUI,
        F9: this.factionCreatorUI, F10: this.npcCreatorUI, F11: this.spawnCreatorUI, F12: this.itemCreatorUI,
      };
      if (tool[key]) { this._toggleTool(tool[key]!); return true; }
      if (key === "F7") {
        if (!this.contentBundleUI.isVisible) this.contentBundleSystem.attachMap(ed);
        this._toggleTool(this.contentBundleUI);
        return true;
      }
      if (ctrl && k === "w") { this._toggleTool(this.worldBuilderUI); return true; }
      // Ctrl+Shift+M: the key is "M" because Shift is held.
      if (ctrl && key === "M") { this._toggleTool(this.modManifestUI); return true; }
    }
    switch (key) {
      case "F2": this.toggleMapEditor(); return true;
      case "F10": this._toggleTool(this.questCreatorUI); return true;
      case "F12": this._toggleTool(this.dialogueCreatorUI); return true;
      case "F11":
        if (this.editorHubUI.toggle()) this.hooks.suspendGameplay();
        else this.hooks.restoreGameplay();
        return true;
      case "F4": return onlyInEditor(() => { ed.exportToFile(); ui.showNotification("Map exported to file", 2000); });
      case "F6": return onlyInEditor(() => this._importMap());
      case "F7": return onlyInEditor(() => {
        if (this.editorLayout.getPanelState("validation")?.isVisible) { this.editorLayout.setVisible("validation", false); return; }
        const validation = ed.validateMap(0.5, { knownLootTableIds: this.host.lootTableSystem.getTableIds() });
        this.mapEditorValidationPanel.show(validation);
        this.editorLayout.setVisible("validation", true);
        if (!validation.isValid) console.warn("[MapEditorValidation]", validation.issues);
      });
      case "F8": {
        // Quest graph validation (plain F8 in play is the favourites menu).
        const reports = frameworkBaseContent.quests.map((q) => this.host.frameworkRuntime.questEngine.validateGraph(q.id));
        const issues = reports.reduce((n, r) => n + r.issues.length, 0);
        ui.showNotification(
          issues === 0
            ? `Quest graph validation passed (${reports.length} graphs).`
            : `Quest graph validation: ${reports.filter((r) => !r.valid).length} invalid graph(s), ${issues} issue(s).`,
          3200,
        );
        if (issues > 0) console.warn("[QuestGraphValidation]", reports);
        return true;
      }
    }
    if (ctrl) {
      if (k === "m" && !ev.shiftKey) return onlyInEditor(() => {
        this.editorLayout.setVisible("notes", !(this.editorLayout.getPanelState("notes")?.isVisible ?? false));
      });
      if (k === "z" && !ev.shiftKey) return onlyInEditor(() => {
        const undone = ed.undo();
        ui.showNotification(undone ? "Undo" : "Nothing to undo", 1000);
        if (undone) this._refreshAfterEdit();
      });
      if (k === "y" || (k === "z" && ev.shiftKey)) return onlyInEditor(() => {
        const redone = ed.redo();
        ui.showNotification(redone ? "Redo" : "Nothing to redo", 1000);
        if (redone) this._refreshAfterEdit();
      });
      return false;
    }
    if (!ed.isEnabled) return false;
    switch (k) {
      case "f": {
        if (ev.shiftKey) {
          const all = ed.listEntitySummaries();
          if (all.length === 0) { ui.showNotification("No entities to frame", 1000); return true; }
          const c = all.reduce((a, e) => ({ x: a.x + e.position.x, y: a.y + e.position.y, z: a.z + e.position.z }), { x: 0, y: 0, z: 0 });
          this.host.player.camera.target.set(c.x / all.length, c.y / all.length, c.z / all.length);
          ui.showNotification(`Framed ${all.length} entities`, 1000);
        } else {
          const id = ed.selectedEntityId;
          if (!id) { ui.showNotification("No entity selected to frame", 1000); return true; }
          const pos = ed.getEntityPosition(id);
          if (pos) {
            this.host.player.camera.target.set(pos.x, pos.y, pos.z);
            ui.showNotification("Framed selected entity", 1000);
          }
        }
        return true;
      }
      case "l": {
        const shown = this.editorLayout.getPanelState("layers")?.isVisible ?? false;
        this.editorLayout.setVisible("layers", !shown);
        if (!shown) ui.showNotification("Layers panel opened", 1000);
        return true;
      }
      case "t": ui.showNotification(`Place type: ${ed.cyclePlacementType()}`, 1400); this.refreshToolbar(); return true;
      case "p": ui.showNotification(`New patrol group: ${ed.startNewPatrolGroup()}`, 1600); this.refreshToolbar(); return true;
      case "h": ui.showNotification(`Terrain tool: ${ed.cycleTerrainTool()}`, 1600); this.refreshToolbar(); return true;
      case "[": ui.showNotification(`Terrain sculpt step: ${ed.adjustTerrainSculptStep(-0.1).toFixed(1)}`, 1200); return true;
      case "]": ui.showNotification(`Terrain sculpt step: ${ed.adjustTerrainSculptStep(0.1).toFixed(1)}`, 1200); return true;
      case "n": {
        const cam = this.host.player.camera;
        const at = cam.position.add(this.host.player.getForwardDirection(8).scale(4));
        at.y = Math.max(1, at.y);
        ed.placeEntity(at);
        ui.showNotification(`Placed: ${ed.currentPlacementType}`, 1200);
        this._refreshAfterEdit();
        return true;
      }
      case "d": {
        const id = ed.selectedEntityId;
        if (!id) { ui.showNotification("No entity selected to duplicate", 1400); return true; }
        if (ed.duplicateEntity(id)) {
          ui.showNotification("Entity duplicated", 1200);
          this._refreshAfterEdit();
        }
        return true;
      }
    }
    return false;
  }

  /** F6 in the editor: pick a map JSON to import. */
  private _importMap(): void {
    if (typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      const ok = await this.mapEditorSystem.importFromFile(file);
      this.host.ui.showNotification(ok ? "Map imported successfully" : "Map import failed: invalid file", 2500);
      if (ok) {
        this.refreshToolbar();
        this.mapEditorHierarchyPanel.refresh(this.mapEditorSystem.listEntitySummaries());
      }
    });
    document.body.appendChild(input);
    input.click();
  }
}
