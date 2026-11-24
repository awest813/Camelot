import { Scene } from "@babylonjs/core/scene";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Observer } from "@babylonjs/core/Misc/observable";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock, Grid, Button } from "@babylonjs/gui/2D";
import { LinearGradient } from "@babylonjs/gui/2D/controls/gradient/LinearGradient";
import { Item } from "../systems/inventory-system";
import { Quest } from "../systems/quest-system";
import { EquipSlot } from "../systems/equipment-system";
import { getItemIcon } from "./icon-utils";
import { Player } from "../entities/player";
import type { SkillTree } from "../systems/skill-tree-system";
import { AttributeSystem, ATTRIBUTE_NAMES, type AttributeName } from "../systems/attribute-system";
import { keepGuiAtCssResolution } from "./gui-resolution";
import { WaitDialogPanel } from "./wait-dialog";
import { AttributePanelView } from "./attribute-panel";
import { QuestLogView } from "./quest-log-panel";
import { PauseMenuView, type PauseActions } from "./pause-menu";
import { SkillTreeView } from "./skill-tree-panel";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  PANEL_BG:     "rgba(8, 5, 2, 0.94)",
  PANEL_BORDER: "#8B6914",
  TITLE:        "#E8C656",
  TEXT:         "#F2E8D8",
  DIM:          "#A89880",
  GOOD:         "#5EC45E",
  HP_FILL:      "#CC1A1A",
  HP_BG:        "rgba(60, 4, 4, 0.72)",
  MP_FILL:      "#1A4ACC",
  MP_BG:        "rgba(4, 12, 60, 0.72)",
  SP_FILL:      "#1A8840",
  SP_BG:        "rgba(4, 28, 12, 0.72)",
  XP_FILL:      "#E8C656",
  XP_BG:        "rgba(30, 18, 0, 0.75)",
  BTN_BG:       "rgba(32, 22, 8, 0.96)",
  BTN_HOVER:    "rgba(72, 52, 14, 0.98)",
  SLOT_BG:      "rgba(22, 16, 6, 0.88)",
  SLOT_HOVER:   "rgba(52, 38, 10, 0.92)",
  EQUIP_BG:     "rgba(44, 30, 4, 0.88)",
  EQUIP_BORDER: "#E8C656",
};

/** Subset of `T` for panels that should match the main HUD (e.g. dialogue). */
export const SHARED_UI_PANEL = {
  PANEL_BG:     T.PANEL_BG,
  PANEL_BORDER: T.PANEL_BORDER,
  TITLE:        T.TITLE,
  TEXT:         T.TEXT,
  DIM:          T.DIM,
  BTN_BG:       T.BTN_BG,
  BTN_HOVER:    T.BTN_HOVER,
} as const;

/** Cardinal labels for the compass strip, clockwise from north. */
const COMPASS_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

const clampPercentage = (current: number, max: number): string => {
  if (max <= 0) return "0%";
  const percent = (current / max) * 100;
  return `${Math.min(100, Math.max(0, percent))}%`;
};

type RotatableCamera = {
  rotation: Vector3;
};

// Active cameras in tests/runtime can differ, so detect the rotation contract
// instead of coupling camera shake to one Babylon.js camera subclass.
const hasRotatableCamera = (camera: unknown): camera is RotatableCamera => {
  if (!camera || typeof camera !== "object") return false;
  const rotation = (camera as { rotation?: unknown }).rotation;
  return rotation instanceof Vector3;
};

export class UIManager {
  public scene: Scene;
  /** The underlying Babylon.js AdvancedDynamicTexture used for all 2-D UI. */
  public get uiTexture(): AdvancedDynamicTexture { return this._ui; }
  private _ui: AdvancedDynamicTexture;

  // Bars
  public healthBar: Rectangle;
  public magickaBar: Rectangle;
  public staminaBar: Rectangle;

  // Inventory
  public inventoryPanel: Rectangle;
  public inventoryGrid: Grid;
  public inventoryDescription: TextBlock;
  public statsText: TextBlock;
  private _lastStatsText: string | null = null;
  public equipmentText: TextBlock;
  private _inventoryMainGrid: Grid | null = null;

  private _equippedIds: Set<string> = new Set();

  /** Called when the player clicks an inventory item slot. Set by Game to hook into EquipmentSystem. */
  public onInventoryItemClick: ((item: Item) => void) | null = null;
  /** Extra detail line(s) appended to an inventory item's hover text (e.g. gear condition). */
  public itemDetailSuffix: ((item: Item) => string) | null = null;

  /**
   * When set (by Game), inventory rows show a drink/use hint for consumables
   * (same rule as QuickSlotSystem: positive heal / magicka / stamina on stats).
   */
  public isConsumableItem: ((item: Item) => boolean) | null = null;

  // Pause Menu
  /** The pause menu (a Preact panel; see pause-menu.tsx). */
  private readonly _pauseMenu = new PauseMenuView();
  private _pauseActions: PauseActions | null = null;
  public isPauseMenuOpen = false;

  private _hpPulseObs: any = null;

  // ── Pooled transient feedback ─────────────────────────────────────────────
  // Notifications, damage numbers, hit flashes, and impact sparks reuse
  // pre-allocated controls/meshes driven by one shared observer each, so
  // combat bursts don't allocate controls and observers per event.
  private _notifyRows: Array<{ rect: Rectangle; label: TextBlock; remainingMs: number }> = [];
  private _notifyObs: Observer<Scene> | null = null;

  private _damageRows: Array<{ label: TextBlock; topPx: number; elapsedMs: number; active: boolean }> = [];
  private _damageObs: Observer<Scene> | null = null;
  private readonly _damageLifetimeMs = 1000;

  private _flashRows: Array<{ rect: Rectangle; t: number; active: boolean }> = [];
  private _flashObs: Observer<Scene> | null = null;
  private readonly _flashDurationMs = 420;

  private _sparkRows: Array<{ mesh: Mesh; mat: StandardMaterial; scale: number; active: boolean }> = [];
  private _sparkObs: Observer<Scene> | null = null;

  // Interaction
  public interactionLabel: TextBlock;
  public crosshair: Rectangle;
  private _crosshairArms: Rectangle[] = [];

  // Quest Log
  /** The quest log (a Preact panel; see quest-log-panel.tsx). */
  private readonly _questLog = new QuestLogView();
  public isQuestLogOpen = false;

  // XP Bar
  public xpBar: Rectangle;
  private _xpLevelLabel: TextBlock;
  /** True while the HTML Character Sheet overlay is open (hides crosshair with other blocking panels). */
  private _characterSheetOpen: boolean = false;
  private _htmlOverlayCount: number = 0;
  /** Set by the game layer each frame: true while any HTML modal overlay owns the screen. */
  private _htmlModalActive: boolean = false;
  public get htmlOverlayCount(): number { return this._htmlOverlayCount; }
  public registerHtmlOverlay(): () => void {
    this._htmlOverlayCount++;
    this._syncCrosshairVisibility();
    return () => {
      this._htmlOverlayCount--;
      this._syncCrosshairVisibility();
    };
  }

  /**
   * Report whether any HTML modal overlay (barter, level-up, guard challenge,
   * travel, stable, settings, …) is currently open so the crosshair hides
   * alongside the Babylon-GUI blocking panels.  Cheap to call every frame.
   */
  public setHtmlOverlayActive(active: boolean): void {
    if (active === this._htmlModalActive) return;
    this._htmlModalActive = active;
    this._syncCrosshairVisibility();
  }

  // Camera Shake & Hit-stop
  private _cameraTrauma: number = 0;
  private _initialCameraRotation: Vector3 | null = null;
  private _cameraShakeObs: Observer<Scene> | null = null;
  public onHitStopRequested: ((durationMs: number) => void) | null = null;

  // Notifications
  public notificationPanel: StackPanel;

  /** Full-screen fade for cell loads and scripted cuts (above HUD, below pause at 100). */
  private _transitionOverlay: Rectangle | null = null;
  private _transitionFadeObserver: any = null;

  // Skill Tree
  /** The skill trees (a Preact panel; see skill-tree-panel.tsx). */
  private readonly _skillTree = new SkillTreeView();
  public isSkillTreeOpen = false;

  /** Called when the player clicks a skill upgrade button. Set by Game. */
  public onSkillPurchase: ((treeIndex: number, skillIndex: number) => void) | null = null;

  // ── Debug / Performance Overlay ──────────────────────────────────────────
  private _debugPanel: Rectangle | null = null;
  private _debugText: TextBlock | null = null;
  public isDebugVisible: boolean = false;

  // ── Stealth HUD ────────────────────────────────────────────────────────
  private _stealthPanel: Rectangle | null = null;
  private _stealthLabel: TextBlock | null = null;
  private _lastStealthHudLabel: "Hidden" | "Caution" | "Detected" | null | undefined = undefined;

  // ── Clock HUD ─────────────────────────────────────────────────────────
  private _clockLabel: TextBlock | null = null;

  // ── Combat state readout (combo / finisher / riposte) ────────────────────
  private _combatStateLabel: TextBlock | null = null;
  private _lastCombatStateText: string | null = null;
  private _lastCombatStateVisible: boolean | null = null;

  // ── Attribute Panel ───────────────────────────────────────────────────────
  /** The Attributes panel (a Preact panel; see attribute-panel.tsx). */
  private readonly _attributePanel = new AttributePanelView();
  public isAttributePanelOpen: boolean = false;

  /** Called when the player clicks a "+1" attribute button.  Set by Game. */
  public onAttributeSpend: ((name: AttributeName) => void) | null = null;

  // ── Wait Dialog ───────────────────────────────────────────────────────────
  /** The Wait dialog (a Preact panel; see wait-dialog.tsx). */
  private readonly _waitDialog = new WaitDialogPanel();
  public isWaitDialogOpen: boolean = false;
  /**
   * The player closed one of these panels from inside it (its ✕, Escape,
   * Cancel or Wait).  The game
   * closes it through its modal registry, which also gives control back.
   * Without a handler the panel just closes.
   */
  public onPanelClosed: ((id: "wait" | "attributes" | "quest-log" | "skill-tree") => void) | null = null;
  /** Called with the chosen hour count when the player confirms the wait. */
  public onWaitConfirm: ((hours: number) => void) | null = null;

  // ── Compass HUD ────────────────────────────────────────────────────────────
  private _compassPanel: Rectangle | null = null;
  private _compassLabel: TextBlock | null = null;
  private _lastCompassIndex: number = -1;

  constructor(scene: Scene) {
    this.scene = scene;
    this._initUI();
    this._initInventoryUI();
    this._initDebugOverlay();
    this._initStealthHUD();
    this._initClockHUD();
    this._initCompassHUD();
  }

  // ── Init methods ─────────────────────────────────────────────────────────────

  private _initUI(): void {
    this._ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
    keepGuiAtCssResolution(this._ui, this.scene?.getEngine?.());

    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("resize", () => {
        if (this.inventoryPanel?.isVisible) this._adaptInventoryLayout();
      });
    }

    // ── Cross-shaped Crosshair ────────────────────────────────────────────────
    this.crosshair = new Rectangle("crosshairContainer");
    this.crosshair.width = "30px";
    this.crosshair.height = "30px";
    this.crosshair.thickness = 0;
    this.crosshair.background = "transparent";
    this._ui.addControl(this.crosshair);

    // 4 arms: top, bottom, left, right (with a gap at center)
    const armDefs = [
      { w: "2px", h: "9px", top: "-10px", left:   "0px" }, // top
      { w: "2px", h: "9px", top:  "10px", left:   "0px" }, // bottom
      { w: "9px", h: "2px", top:   "0px", left: "-10px" }, // left
      { w: "9px", h: "2px", top:   "0px", left:  "10px" }, // right
    ];
    for (const def of armDefs) {
      const arm = new Rectangle();
      arm.width = def.w;
      arm.height = def.h;
      arm.top = def.top;
      arm.left = def.left;
      arm.cornerRadius = 1;
      arm.thickness = 0;
      arm.background = "rgba(248, 246, 240, 0.92)";
      this.crosshair.addControl(arm);
      this._crosshairArms.push(arm);
    }
    // Center dot
    const dot = new Rectangle();
    dot.width = "3px";
    dot.height = "3px";
    dot.cornerRadius = 2;
    dot.thickness = 0;
    dot.background = "rgba(248, 246, 240, 0.95)";
    this.crosshair.addControl(dot);
    this._crosshairArms.push(dot);

    // ── Interaction Label ─────────────────────────────────────────────────────
    this.interactionLabel = new TextBlock();
    this.interactionLabel.text = "";
    this.interactionLabel.color = T.TEXT;
    this.interactionLabel.fontSize = 18;
    this.interactionLabel.fontWeight = "bold";
    this.interactionLabel.top = "60px";
    this.interactionLabel.shadowColor = "rgba(0,0,0,0.85)";
    this.interactionLabel.shadowBlur = 6;
    this.interactionLabel.shadowOffsetY = 1;
    this._ui.addControl(this.interactionLabel);

    // ── Status Bars (Bottom Center) ───────────────────────────────────────────
    const barsPanel = new StackPanel();
    barsPanel.isVertical = false;
    barsPanel.height = "28px";
    barsPanel.width = "630px";
    barsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    barsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    barsPanel.top = "-18px";
    this._ui.addControl(barsPanel);

    // Magicka Bar (left)
    const { container: mpContainer, bar: mpBar } = this._createBar("MP", T.MP_FILL, T.MP_BG, barsPanel);
    mpContainer.paddingRight = "8px";
    this.magickaBar = mpBar;

    // Health Bar (center)
    const { container: hpContainer, bar: hpBar } = this._createBar("HP", T.HP_FILL, T.HP_BG, barsPanel);
    hpContainer.paddingLeft = "8px";
    hpContainer.paddingRight = "8px";
    this.healthBar = hpBar;

    // Stamina Bar (right)
    const { container: spContainer, bar: spBar } = this._createBar("SP", T.SP_FILL, T.SP_BG, barsPanel);
    spContainer.paddingLeft = "8px";
    this.staminaBar = spBar;

    // ── XP Bar ────────────────────────────────────────────────────────────────
    const xpRow = new StackPanel();
    xpRow.isVertical = false;
    xpRow.height = "28px";
    xpRow.width = "630px";
    xpRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    xpRow.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    xpRow.top = "-50px";
    this._ui.addControl(xpRow);

    this._xpLevelLabel = new TextBlock();
    this._xpLevelLabel.text = "CL 1\nLv.1";
    this._xpLevelLabel.color = T.TITLE;
    this._xpLevelLabel.fontSize = 10;
    this._xpLevelLabel.fontWeight = "bold";
    this._xpLevelLabel.lineSpacing = "-2px";
    this._xpLevelLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this._xpLevelLabel.width = "56px";
    this._xpLevelLabel.height = "100%";
    xpRow.addControl(this._xpLevelLabel);

    const xpBarContainer = new Rectangle();
    xpBarContainer.width = "568px";
    xpBarContainer.height = "8px";
    xpBarContainer.cornerRadius = 5;
    xpBarContainer.color = "rgba(212, 160, 23, 0.45)";
    xpBarContainer.thickness = 1;
    xpBarContainer.background = T.XP_BG;
    xpRow.addControl(xpBarContainer);

    this.xpBar = new Rectangle();
    this.xpBar.width = "0%";
    this.xpBar.height = "100%";
    this.xpBar.cornerRadius = 5;
    this.xpBar.thickness = 0;
    this.xpBar.background = T.XP_FILL;
    this.xpBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    xpBarContainer.addControl(this.xpBar);

    // ── Notifications (Top-Right) ─────────────────────────────────────────────
    this.notificationPanel = new StackPanel();
    this.notificationPanel.width = "320px";
    this.notificationPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.notificationPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.notificationPanel.top = "70px";
    this.notificationPanel.left = "-16px";
    this.notificationPanel.isVertical = true;
    // Rows change height/visibility between layouts; don't clip a toast to the
    // previous frame's stack height.
    this.notificationPanel.clipChildren = false;
    this.notificationPanel.clipContent = false;
    this._ui.addControl(this.notificationPanel);

    this._transitionOverlay = new Rectangle("screenTransition");
    this._transitionOverlay.width = "100%";
    this._transitionOverlay.height = "100%";
    this._transitionOverlay.thickness = 0;
    this._transitionOverlay.background = "black";
    this._transitionOverlay.alpha = 0;
    this._transitionOverlay.isVisible = false;
    this._transitionOverlay.isPointerBlocker = true;
    this._transitionOverlay.zIndex = 5000;
    this._ui.addControl(this._transitionOverlay);
  }

  /**
   * Fade to black, optionally run work while fully black, then fade in.
   * If another sequence is running it is cancelled first.
   */
  public playScreenFadeSequence(options: {
    fadeOutMs?: number;
    holdMs?: number;
    fadeInMs?: number;
    onBlack?: () => void;
    onComplete?: () => void;
  } = {}): void {
    this.cancelScreenFade();
    if (!this._transitionOverlay) return;

    const fadeOutMs = options.fadeOutMs ?? 380;
    const holdMs = options.holdMs ?? 120;
    const fadeInMs = options.fadeInMs ?? 420;
    const total = fadeOutMs + holdMs + fadeInMs;

    const overlay = this._transitionOverlay;
    overlay.isVisible = true;
    overlay.alpha = 0;

    let elapsed = 0;
    let blackFired = false;

    this._transitionFadeObserver = this.scene.onBeforeRenderObservable.add(() => {
      elapsed += this.scene.getEngine().getDeltaTime();

      // Fire at full black even when a slow frame steps past the whole hold
      // (at ~9 fps one frame is longer than it), or the move never happens.
      if (!blackFired && elapsed > fadeOutMs) {
        blackFired = true;
        overlay.alpha = 1;
        options.onBlack?.();
      }

      if (elapsed <= fadeOutMs) {
        overlay.alpha = Math.min(1, elapsed / fadeOutMs);
      } else if (elapsed <= fadeOutMs + holdMs) {
        overlay.alpha = 1;
      } else if (elapsed <= total) {
        const t = (elapsed - fadeOutMs - holdMs) / fadeInMs;
        overlay.alpha = Math.max(0, 1 - t);
      } else {
        overlay.alpha = 0;
        overlay.isVisible = false;
        this.scene.onBeforeRenderObservable.remove(this._transitionFadeObserver);
        this._transitionFadeObserver = null;
        options.onComplete?.();
      }
    });
  }

  /** Stop an in-progress screen fade and hide the overlay. */
  public cancelScreenFade(): void {
    if (this._transitionFadeObserver) {
      this.scene.onBeforeRenderObservable.remove(this._transitionFadeObserver);
      this._transitionFadeObserver = null;
    }
    if (this._transitionOverlay) {
      this._transitionOverlay.alpha = 0;
      this._transitionOverlay.isVisible = false;
    }
  }

  public get isScreenFadeActive(): boolean {
    return this._transitionOverlay !== null && this._transitionOverlay.isVisible && this._transitionOverlay.alpha > 0.001;
  }

  private _initInventoryUI(): void {
    this.inventoryPanel = new Rectangle();
    this.inventoryPanel.width = "620px";
    this.inventoryPanel.height = "620px";
    this.inventoryPanel.cornerRadius = 8;
    this.inventoryPanel.color = T.PANEL_BORDER;
    this.inventoryPanel.thickness = 2;
    this.inventoryPanel.background = T.PANEL_BG;
    this.inventoryPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.inventoryPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.inventoryPanel.left = "-20px";
    this.inventoryPanel.isVisible = false;
    this._ui.addControl(this.inventoryPanel);

    // Title bar
    const titleBar = new Rectangle();
    titleBar.width = "100%";
    titleBar.height = "44px";
    titleBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    titleBar.thickness = 0;
    titleBar.background = "rgba(30, 20, 0, 0.60)";
    titleBar.cornerRadius = 8;
    this.inventoryPanel.addControl(titleBar);

    const title = new TextBlock();
    title.text = "✦  INVENTORY  [I]  ✦";
    title.color = T.TITLE;
    title.fontSize = 19;
    title.fontWeight = "bold";
    titleBar.addControl(title);

    // Separator
    const sep = new Rectangle();
    sep.width = "96%";
    sep.height = "1px";
    sep.background = T.PANEL_BORDER;
    sep.thickness = 0;
    sep.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    sep.top = "44px";
    this.inventoryPanel.addControl(sep);

    // Main Grid: 60% items | 40% details
    const mainGrid = new Grid();
    mainGrid.width = "580px";
    mainGrid.height = "550px";
    mainGrid.top = "50px";
    mainGrid.addColumnDefinition(0.6);
    mainGrid.addColumnDefinition(0.4);
    this.inventoryPanel.addControl(mainGrid);
    this._inventoryMainGrid = mainGrid;

    // Inventory Grid (Left)
    this.inventoryGrid = new Grid();
    this.inventoryGrid.width = "100%";
    this.inventoryGrid.height = "100%";
    for (let i = 0; i < 6; i++) this.inventoryGrid.addRowDefinition(1);
    for (let i = 0; i < 4; i++) this.inventoryGrid.addColumnDefinition(1);
    mainGrid.addControl(this.inventoryGrid, 0, 0);

    // Right panel
    const rightPanel = new StackPanel();
    rightPanel.width = "100%";
    rightPanel.height = "100%";
    mainGrid.addControl(rightPanel, 0, 1);

    // Description box
    const descContainer = new Rectangle();
    descContainer.width = "100%";
    descContainer.height = "155px";
    descContainer.color = T.PANEL_BORDER;
    descContainer.thickness = 1;
    descContainer.background = "rgba(20, 12, 2, 0.80)";
    descContainer.cornerRadius = 4;
    rightPanel.addControl(descContainer);

    this.inventoryDescription = new TextBlock();
    this.inventoryDescription.text = "";
    this.inventoryDescription.color = T.TEXT;
    this.inventoryDescription.fontSize = 13;
    this.inventoryDescription.textWrapping = true;
    this.inventoryDescription.paddingLeft = "8px";
    this.inventoryDescription.paddingRight = "8px";
    this.inventoryDescription.paddingTop = "8px";
    this.inventoryDescription.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    descContainer.addControl(this.inventoryDescription);

    // Stats box
    const statsContainer = new Rectangle();
    statsContainer.width = "100%";
    statsContainer.height = "155px";
    statsContainer.color = T.PANEL_BORDER;
    statsContainer.thickness = 1;
    statsContainer.background = "rgba(20, 12, 2, 0.80)";
    statsContainer.cornerRadius = 4;
    statsContainer.top = "8px";
    rightPanel.addControl(statsContainer);

    this.statsText = new TextBlock();
    this.statsText.text = "Stats:\nHP: --\nMP: --\nSP: --";
    this.statsText.color = T.TEXT;
    this.statsText.fontSize = 13;
    this.statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.statsText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.statsText.paddingTop = "10px";
    this.statsText.paddingLeft = "12px";
    statsContainer.addControl(this.statsText);

    // Equipment box
    const equipContainer = new Rectangle();
    equipContainer.width = "100%";
    equipContainer.height = "218px";
    equipContainer.color = T.EQUIP_BORDER;
    equipContainer.thickness = 1;
    equipContainer.background = "rgba(22, 14, 0, 0.90)";
    equipContainer.cornerRadius = 4;
    equipContainer.top = "16px";
    rightPanel.addControl(equipContainer);

    this.equipmentText = new TextBlock();
    this.equipmentText.text = "Equipment:\nMain Hand: --\nOff Hand: --\nHead: --\nChest: --\nLegs: --\nFeet: --";
    this.equipmentText.color = T.TITLE;
    this.equipmentText.fontSize = 12;
    this.equipmentText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.equipmentText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.equipmentText.paddingTop = "10px";
    this.equipmentText.paddingLeft = "12px";
    equipContainer.addControl(this.equipmentText);
  }





  // ── Public methods ────────────────────────────────────────────────────────────

  public toggleSkillTree(visible: boolean): void {
    this.isSkillTreeOpen = visible;
    if (visible) {
      this._skillTree.open({
        onBuy: (t, sk) => this.onSkillPurchase?.(t, sk),
        onClose: () => this._closedByPlayer("skill-tree", () => this.toggleSkillTree(false)),
      });
    } else {
      this._skillTree.close();
    }
    this._syncCrosshairVisibility();
  }

  /**
   * Show the skill trees: ranks, unspent points, and (via `prereqMet`)
   * which skills are still locked behind their prerequisites.
   */
  public refreshSkillTree(
    trees: SkillTree[],
    skillPoints: number,
    prereqMet?: (treeIndex: number, skillIndex: number) => boolean,
  ): void {
    this._skillTree.refresh({ trees, skillPoints, prereqMet });
  }

  private _createButton(text: string, parent: StackPanel): Button {
    const button = Button.CreateSimpleButton("btn_" + text, text);
    button.width = "100%";
    button.height = "52px";
    button.color = T.TEXT;
    button.cornerRadius = 6;
    button.background = T.BTN_BG;
    button.paddingBottom = "8px";
    button.hoverCursor = "pointer";
    button.thickness = 1;
    button.fontSize = 16;

    button.isFocusInvisible = false;
    button.tabIndex = 0;
    button.accessibilityTag = { description: text };

    let isFocused = false;
    const setHover = () => {
      button.background = T.BTN_HOVER;
      button.color = T.TITLE;
      if (button.thickness !== 2) button.thickness = 1;
    };
    const setFocus = () => {
      isFocused = true;
      button.background = T.BTN_HOVER;
      button.color = T.TITLE;
      button.thickness = 2; // Distinct visual indicator for keyboard focus
    };
    const setNormal = () => {
      button.background = T.BTN_BG;
      button.color = T.TEXT;
      if (!isFocused) {
        button.thickness = 1;
      }
    };
    const setBlur = () => {
      isFocused = false;
      setNormal();
    };

    button.onPointerEnterObservable.add(setHover);
    button.onPointerOutObservable.add(setNormal);
    button.onFocusObservable.add(setFocus);
    button.onBlurObservable.add(setBlur);

    button.onKeyboardEventProcessedObservable.add((evt) => {
      if (evt.type === "keyup" && (evt.key === "Enter" || evt.key === " ")) {
        button.onPointerUpObservable.notifyObservers(null as any);
      }
    });

    parent.addControl(button);
    return button;
  }

  /** Fired once when the inventory panel transitions from open to closed. */
  public onInventoryClosed: (() => void) | null = null;

  private _getViewportSize(): { width: number; height: number } {
    let width = 1280;
    let height = 720;
    if (typeof window !== "undefined" && typeof window.innerWidth === "number" && window.innerWidth > 0) {
      width = window.innerWidth;
      height = window.innerHeight > 0 ? window.innerHeight : 720;
    } else {
      const engine = (this.scene as any)?.getEngine?.();
      if (engine && typeof engine.getRenderWidth === "function") {
        const ew = engine.getRenderWidth();
        const eh = engine.getRenderHeight();
        if (ew > 0) width = ew;
        if (eh > 0) height = eh;
      } else {
        const size = (this._ui as any)?.getSize?.();
        if (size?.width && size.width > 0) width = size.width;
        if (size?.height && size.height > 0) height = size.height;
      }
    }
    return { width, height };
  }

  private _adaptInventoryLayout(): void {
    if (!this.inventoryPanel) return;
    const vp = this._getViewportSize();
    const invW = Math.min(620, Math.max(320, vp.width - 24));
    const invH = Math.min(620, Math.max(380, vp.height - 24));
    this.inventoryPanel.width = `${invW}px`;
    this.inventoryPanel.height = `${invH}px`;
    if (this._inventoryMainGrid) {
      this._inventoryMainGrid.width = `${Math.max(280, invW - 40)}px`;
      this._inventoryMainGrid.height = `${Math.max(300, invH - 70)}px`;
    }
    if (vp.width < 720) {
      this.inventoryPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      this.inventoryPanel.left = "0px";
    } else {
      this.inventoryPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.inventoryPanel.left = "-20px";
    }
  }





  public toggleInventory(visible: boolean): void {
    const wasOpen = this.inventoryPanel.isVisible;
    if (visible) this._adaptInventoryLayout();
    this.inventoryPanel.isVisible = visible;
    this._syncCrosshairVisibility();
    if (!visible) {
      this.inventoryDescription.text = "";
      if (wasOpen) this.onInventoryClosed?.();
    }
  }

  public togglePauseMenu(visible: boolean): void {
    this.isPauseMenuOpen = visible;
    if (visible && this._pauseActions) this._pauseMenu.open(this._pauseActions);
    else this._pauseMenu.close();
    this._syncCrosshairVisibility();
  }

  /** What the pause menu's buttons do (the game sets this once). */
  public setPauseActions(actions: PauseActions): void {
    this._pauseActions = actions;
    if (this.isPauseMenuOpen) this._pauseMenu.open(actions);
  }

  public toggleQuestLog(visible: boolean): void {
    this.isQuestLogOpen = visible;
    if (visible) this._questLog.open(() => this._closedByPlayer("quest-log", () => this.toggleQuestLog(false)));
    else this._questLog.close();
    this._syncCrosshairVisibility();
  }

  /** A panel closed from inside: the game's registry closes it, else `fallback`. */
  private _closedByPlayer(id: "wait" | "attributes" | "quest-log" | "skill-tree", fallback: () => void): void {
    if (this.onPanelClosed) this.onPanelClosed(id);
    else fallback();
  }

  private _syncCrosshairVisibility(): void {
    const hasBlockingPanelOpen =
      this.inventoryPanel.isVisible ||
      this.isPauseMenuOpen ||
      this.isQuestLogOpen ||
      this.isSkillTreeOpen ||
      this.isAttributePanelOpen ||
      this.isWaitDialogOpen ||
      this._characterSheetOpen ||
      this._htmlOverlayCount > 0 ||
      this._htmlModalActive;

    this.toggleCrosshair(!hasBlockingPanelOpen);
  }

  /** Notify the HUD when the DOM Character Sheet is toggled so the crosshair stays hidden with other overlays. */
  public setCharacterSheetOpen(open: boolean): void {
    this._characterSheetOpen = open;
    this._syncCrosshairVisibility();
  }

  public updateQuestLog(quests: Quest[]): void {
    this._questLog.update(quests);
  }

  public toggleCrosshair(visible: boolean): void {
    this.crosshair.isVisible = visible;
  }

  public setCrosshairActive(active: boolean): void {
    const color = active ? T.TITLE : "rgba(255,255,255,0.9)";
    const scale = active ? 1.25 : 1.0;
    if (this._crosshairArms[0]?.background === color) return;
    for (const arm of this._crosshairArms) {
      arm.background = color;
    }
    this.crosshair.scaleX = scale;
    this.crosshair.scaleY = scale;
  }

  public updateStats(player: Player, characterLevel: number): void {
    const text =
      `Stats:\nCharacter Lv: ${characterLevel}  Combat Lv: ${player.level}\nXP: ${Math.floor(player.experience)} / ${player.experienceToNextLevel}\n` +
      `HP: ${Math.floor(player.health)} / ${player.maxHealth}\nMP: ${Math.floor(player.magicka)} / ${player.maxMagicka}\nSP: ${Math.floor(player.stamina)} / ${player.maxStamina}\nDMG Bonus: +${player.bonusDamage}\nArmor: ${player.bonusArmor}`;
    if (this._lastStatsText === text) return;
    this._lastStatsText = text;
    this.statsText.text = text;
  }

  public setEquippedIds(ids: Set<string>): void {
    this._equippedIds = ids;
  }

  public updateInventory(items: Item[]): void {
    while (this.inventoryGrid.children.length > 0) {
      this.inventoryGrid.children[0].dispose();
    }

    items.forEach((item, index) => {
      if (index >= 20) return;

      const row = Math.floor(index / 4);
      const col = index % 4;
      const isEquipped = this._equippedIds.has(item.id);

      const slot = new Rectangle();
      slot.width = "82px";
      slot.height = "82px";
      slot.cornerRadius = 5;
      slot.color = isEquipped ? T.EQUIP_BORDER : T.PANEL_BORDER;
      slot.thickness = isEquipped ? 2 : 1;
      slot.background = isEquipped ? T.EQUIP_BG : T.SLOT_BG;
      slot.isPointerBlocker = true;
      slot.hoverCursor = "pointer";

      slot.isFocusInvisible = false;
      slot.tabIndex = 0;
      slot.accessibilityTag = { description: item.name };

      const baseColor  = isEquipped ? T.EQUIP_BG  : T.SLOT_BG;
      const hoverColor = isEquipped ? "rgba(60, 44, 0, 0.95)" : T.SLOT_HOVER;

      let isFocused = false;
      const useHint = (): string => {
        if (this.isConsumableItem?.(item)) return "\n[Click to Use]";
        if (item.slot) {
          const equipped = this._equippedIds.has(item.id);
          return equipped ? "\n[Click to Unequip]" : "\n[Click to Equip]";
        }
        return "";
      };

      const setHoverState = () => {
        const equipped = this._equippedIds.has(item.id);
        const hint = useHint();
        this.inventoryDescription.text = `${item.name}\n${item.description}\nQty: ${item.quantity}${this.itemDetailSuffix?.(item) ?? ""}${hint}`;
        slot.background = hoverColor;
        if (slot.thickness !== 3) slot.thickness = equipped ? 2 : 1;
      };
      const setFocusState = () => {
        isFocused = true;
        const equipped = this._equippedIds.has(item.id);
        const hint = useHint();
        this.inventoryDescription.text = `${item.name}\n${item.description}\nQty: ${item.quantity}${this.itemDetailSuffix?.(item) ?? ""}${hint}`;
        slot.background = hoverColor;
        slot.thickness = 3; // Distinct visual indicator for keyboard focus
      };
      const setNormalState = () => {
        if (!isFocused) {
          this.inventoryDescription.text = "";
        }
        slot.background = baseColor;
        if (!isFocused) {
          const equipped = this._equippedIds.has(item.id);
          slot.thickness = equipped ? 2 : 1;
        }
      };
      const setBlurState = () => {
        isFocused = false;
        setNormalState();
      };

      slot.onPointerEnterObservable.add(setHoverState);
      slot.onPointerOutObservable.add(setNormalState);
      slot.onFocusObservable.add(setFocusState);
      slot.onBlurObservable.add(setBlurState);

      const triggerItem = () => {
        if (this.onInventoryItemClick) {
          this.onInventoryItemClick(item);
        }
      };

      const clickable = Boolean(this.isConsumableItem?.(item) || item.slot);
      if (clickable) {
        slot.onPointerUpObservable.add(triggerItem);
        slot.onKeyboardEventProcessedObservable.add((evt) => {
          if (evt.type === "keyup" && (evt.key === "Enter" || evt.key === " ")) {
            triggerItem();
          }
        });
      }

      const icon = getItemIcon(item);
      const text = new TextBlock();
      text.text = `${icon} ${item.name}` + (item.quantity > 1 ? ` (${item.quantity})` : "");
      text.color = isEquipped ? T.TITLE : T.TEXT;
      text.fontSize = 11;
      text.textWrapping = true;
      slot.addControl(text);

      this.inventoryGrid.addControl(slot, row, col);
    });

    for (let index = Math.min(items.length, 20); index < 20; index++) {
      const row = Math.floor(index / 4);
      const col = index % 4;

      const emptySlot = new Rectangle();
      emptySlot.width = "82px";
      emptySlot.height = "82px";
      emptySlot.cornerRadius = 5;
      emptySlot.color = "rgba(107, 79, 18, 0.25)";
      emptySlot.thickness = 1;
      emptySlot.background = "rgba(16, 12, 4, 0.35)";
      this.inventoryGrid.addControl(emptySlot, row, col);
    }
  }

  public updateEquipment(slots: Map<EquipSlot, import("../systems/inventory-system").Item>): void {
    const slotLabels: { key: EquipSlot; label: string }[] = [
      { key: "mainHand", label: "Main Hand" },
      { key: "offHand",  label: "Off Hand"  },
      { key: "head",     label: "Head"      },
      { key: "chest",    label: "Chest"     },
      { key: "legs",     label: "Legs"      },
      { key: "feet",     label: "Feet"      },
    ];
    const lines = ["Equipment:"];
    for (const { key, label } of slotLabels) {
      const item = slots.get(key);
      lines.push(`${label}: ${item ? item.name : "--"}`);
    }
    this.equipmentText.text = lines.join("\n");
  }

  public setInteractionText(text: string): void {
    this.interactionLabel.text = text;
  }

  /** Pre-allocate the fixed notification rows (once). */
  private _ensureNotifyRows(): void {
    if (this._notifyRows.length > 0) return;
    for (let i = 0; i < 6; i++) {
      const rect = new Rectangle();
      rect.width = "100%";
      // Grow with the wrapped label: a fixed 40px single line clipped long
      // messages at both edges ("r travelers gossiping about … on th").
      rect.adaptHeightToChildren = true;
      rect.cornerRadius = 8;
      rect.color = "rgba(232, 198, 86, 0.55)";
      rect.thickness = 2;
      rect.background = "rgba(14, 10, 4, 0.96)";
      rect.paddingBottom = "5px";
      rect.shadowOffsetX = 0;
      rect.shadowOffsetY = 2;
      rect.shadowBlur = 10;
      rect.shadowColor = "rgba(0,0,0,0.55)";
      rect.isVisible = false;

      const label = new TextBlock();
      label.text = "";
      label.color = T.TITLE;
      label.fontSize = 14;
      label.fontWeight = "bold";
      label.shadowColor = "rgba(0,0,0,0.75)";
      label.shadowBlur = 4;
      label.shadowOffsetY = 1;
      label.textWrapping = true;
      label.resizeToFit = true;
      label.width = "100%";
      label.paddingTop = "9px";
      label.paddingBottom = "9px";
      label.paddingLeft = "14px";
      label.paddingRight = "14px";
      rect.addControl(label);

      this.notificationPanel.addControl(rect);
      this._notifyRows.push({ rect, label, remainingMs: 0 });
    }
  }

  public showNotification(text: string, duration: number = 3000): void {
    this._ensureNotifyRows();

    // Prefer the bottom-most free row so new messages appear where the old
    // implementation stacked them; when all rows are busy, overwrite the one
    // closest to expiring.
    let row = this._notifyRows[this._notifyRows.length - 1];
    for (let i = this._notifyRows.length - 1; i >= 0; i--) {
      if (this._notifyRows[i].remainingMs <= 0) {
        row = this._notifyRows[i];
        break;
      }
      if (this._notifyRows[i].remainingMs < row.remainingMs) {
        row = this._notifyRows[i];
      }
    }

    row.label.text = text;
    row.rect.isVisible = true;
    row.remainingMs = duration;
    // Newest toast at the bottom of the stack, whichever pooled row it reused.
    const panelChildren = this.notificationPanel.children;
    if (panelChildren[panelChildren.length - 1] !== row.rect) {
      this.notificationPanel.removeControl(row.rect);
      this.notificationPanel.addControl(row.rect);
    }

    if (!this._notifyObs) {
      this._notifyObs = this.scene.onBeforeRenderObservable.add(() => {
        const dt = this.scene.getEngine().getDeltaTime();
        let anyActive = false;
        for (const r of this._notifyRows) {
          if (r.remainingMs <= 0) continue;
          r.remainingMs -= dt;
          if (r.remainingMs <= 0) {
            r.remainingMs = 0;
            r.rect.isVisible = false;
          } else {
            anyActive = true;
          }
        }
        if (!anyActive && this._notifyObs) {
          this.scene.onBeforeRenderObservable.remove(this._notifyObs);
          this._notifyObs = null;
        }
      });
    }
  }

  private _createBar(label: string, fillColor: string, trackColor: string, parent: StackPanel): { container: Rectangle, bar: Rectangle } {
    const container = new Rectangle();
    container.width = "192px";
    container.height = "22px";
    container.cornerRadius = 6;
    container.color = "rgba(212, 160, 23, 0.45)";
    container.thickness = 1;
    container.background = trackColor;
    parent.addControl(container);

    const bar = new Rectangle();
    bar.width = "100%";
    bar.height = "100%";
    bar.cornerRadius = 5;
    bar.thickness = 0;
    
    // Create a vertical gradient for the bar fill
    const gradient = new LinearGradient(0, 0, 0, 1);
    gradient.addColorStop(0, fillColor);
    gradient.addColorStop(1, this._darkenColor(fillColor, 0.35));
    bar.backgroundGradient = gradient;
    
    bar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    container.addControl(bar);

    // Subtle top sheen/highlight
    const sheen = new Rectangle();
    sheen.width = "100%";
    sheen.height = "40%";
    sheen.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    sheen.background = "rgba(255, 252, 240, 0.12)";
    sheen.thickness = 0;
    sheen.cornerRadius = 5;
    container.addControl(sheen);

    // Label overlaid on top of bar
    const labelText = new TextBlock();
    labelText.text = label;
    labelText.color = "#FFF8E7";
    labelText.fontSize = 11;
    labelText.fontWeight = "bold";
    labelText.width = "100%";
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    labelText.paddingLeft = "10px";
    labelText.shadowColor = "rgba(0,0,0,0.7)";
    labelText.shadowBlur = 4;
    container.addControl(labelText);

    return { container, bar };
  }

  /** Helper to darken a hex or rgba color. */
  private _darkenColor(color: string, amount: number): string {
    if (color.startsWith("rgba")) {
      return color.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * (1 - amount)).toString() + ")");
    }
    // Simple hex darken fallback (assuming valid hex)
    return color; 
  }

  public updateHealth(current: number, max: number): void {
    const percent = max > 0 ? (current / max) : 0;
    this.healthBar.width = clampPercentage(current, max);

    // Low health pulse effect
    if (percent > 0 && percent < 0.25) {
      if (!this._hpPulseObs) {
        let time = 0;
        this._hpPulseObs = this.scene.onBeforeRenderObservable.add(() => {
          time += this.scene.getEngine().getDeltaTime() * 0.006;
          const pulse = 0.7 + Math.sin(time) * 0.3;
          this.healthBar.alpha = pulse;
        });
      }
    } else {
      if (this._hpPulseObs) {
        this.scene.onBeforeRenderObservable.remove(this._hpPulseObs);
        this._hpPulseObs = null;
        this.healthBar.alpha = 1.0;
      }
    }
  }

  public updateMagicka(current: number, max: number): void {
    this.magickaBar.width = clampPercentage(current, max);
  }

  public updateStamina(current: number, max: number): void {
    this.staminaBar.width = clampPercentage(current, max);
  }

  public updateXP(current: number, max: number, xpLevel: number, characterLevel: number): void {
    this.xpBar.width = clampPercentage(current, max);
    this._xpLevelLabel.text = `CL ${characterLevel}\nLv.${xpLevel}`;
  }

  /**
   * Apply a trauma-based camera shake.
   * Higher intensity (> 0.5) creates violent shaking; lower (< 0.3) is subtle.
   */
  public shakeCamera(intensity: number = 0.5): void {
    this._cameraTrauma = Math.min(1.0, this._cameraTrauma + intensity);
    
    if (!this._cameraShakeObs) {
      this._cameraShakeObs = this.scene.onBeforeRenderObservable.add(() => {
        const camera = this.scene.activeCamera;
        if (!hasRotatableCamera(camera) || this._cameraTrauma <= 0) {
          if (this._cameraTrauma <= 0 && this._cameraShakeObs) {
            this.scene.onBeforeRenderObservable.remove(this._cameraShakeObs);
            this._cameraShakeObs = null;
            // Smoothly lerp back to 0 roll/z if needed
            if (hasRotatableCamera(camera)) camera.rotation.set(camera.rotation.x, camera.rotation.y, 0);
          }
          return;
        }

        const dt = this.scene.getEngine().getDeltaTime() / 1000;
        const shake = Math.pow(this._cameraTrauma, 2); // Squared trauma for more visceral curves
        
        // Use multiple sine waves at different frequencies for an organic "rumble" 
        // rather than pure white-noise jitter.
        const time = performance.now() * 0.001;
        const yaw   = (Math.sin(time * 50) + Math.sin(time * 26) * 0.5) * 0.04 * shake;
        const pitch = (Math.cos(time * 48) + Math.sin(time * 19) * 0.5) * 0.04 * shake;
        const roll  = (Math.sin(time * 30)) * 0.03 * shake;
        
        camera.rotation.y += yaw;
        camera.rotation.x += pitch;
        camera.rotation.z += roll;

        // Decay trauma over time
        this._cameraTrauma = Math.max(0, this._cameraTrauma - 1.4 * dt);
        
        // Return roll to zero
        camera.rotation.z *= 0.85;
      });
    }
  }

  /** Pre-allocate the impact spark pool (once): one sphere + own material each. */
  private _ensureSparkRows(): void {
    if (this._sparkRows.length > 0) return;
    for (let i = 0; i < 8; i++) {
      const spark = MeshBuilder.CreateSphere("impact_spark", { diameter: 0.15 }, this.scene);
      spark.isVisible = false;
      const mat = new StandardMaterial("spark_mat", this.scene);
      mat.disableLighting = true;
      mat.alpha = 1;
      spark.material = mat;
      this._sparkRows.push({ mesh: spark, mat, scale: 1, active: false });
    }
  }

  /**
   * Spawns a brief "spark" or impact flare at a world position.
   * Used for perfect blocks and critical hits.
   */
  public showSpark(position: Vector3, color: string = "#FFD700"): void {
    this._ensureSparkRows();

    let row = this._sparkRows.find((r) => !r.active)
      ?? this._sparkRows[0]; // all busy — reuse the oldest slot
    row.active = true;
    row.scale = 1;
    row.mesh.position.copyFrom(position);
    row.mesh.scaling.setAll(1);
    row.mat.emissiveColor = Color3.FromHexString(color);
    row.mat.alpha = 1;
    row.mesh.isVisible = true;

    if (!this._sparkObs) {
      this._sparkObs = this.scene.onBeforeRenderObservable.add(() => {
        const dt = this.scene.getEngine().getDeltaTime();
        const step = dt / (1000 / 60); // preserve the original per-frame rate at 60 fps
        let anyActive = false;
        for (const r of this._sparkRows) {
          if (!r.active) continue;
          r.scale += 0.4 * step;
          r.mat.alpha -= 0.15 * step;
          r.mesh.scaling.setAll(r.scale);
          if (r.mat.alpha <= 0) {
            r.mat.alpha = 1; // reset for the next reuse
            r.mesh.isVisible = false;
            r.active = false;
          } else {
            anyActive = true;
          }
        }
        if (!anyActive && this._sparkObs) {
          this.scene.onBeforeRenderObservable.remove(this._sparkObs);
          this._sparkObs = null;
        }
      });
    }
  }

  /**
   * Briefly pause or slow time for impact.
   * @param durationMs Milliseconds to freeze/slow time.
   */
  public applyHitStop(durationMs: number = 80): void {
    this.onHitStopRequested?.(durationMs);
  }

  /** Flash a translucent color overlay to signal being hit or dealing damage. */
  public showHitFlash(color: string = "red"): void {
    if (this._flashRows.length === 0) {
      for (let i = 0; i < 3; i++) {
        const flash = new Rectangle();
        flash.width = "100%";
        flash.height = "100%";
        flash.background = color;
        flash.thickness = 0;
        flash.alpha = 0;
        flash.isPointerBlocker = false;
        flash.zIndex = 1;
        flash.isVisible = false;
        this._ui.addControl(flash);
        this._flashRows.push({ rect: flash, t: 0, active: false });
      }
    }

    // All busy — restart the one closest to finished.
    let row = this._flashRows.find((r) => !r.active)
      ?? this._flashRows.reduce((a, b) => (a.t > b.t ? a : b));
    row.active = true;
    row.t = 0;
    row.rect.background = color;
    row.rect.alpha = 0.45;
    row.rect.isVisible = true;

    if (!this._flashObs) {
      this._flashObs = this.scene.onBeforeRenderObservable.add(() => {
        const dt = this.scene.getEngine().getDeltaTime();
        let anyActive = false;
        for (const r of this._flashRows) {
          if (!r.active) continue;
          r.t += dt / this._flashDurationMs;
          r.rect.alpha = Math.max(0, 0.45 * (1 - r.t));
          if (r.t >= 1) {
            r.rect.isVisible = false;
            r.active = false;
          } else {
            anyActive = true;
          }
        }
        if (!anyActive && this._flashObs) {
          this.scene.onBeforeRenderObservable.remove(this._flashObs);
          this._flashObs = null;
        }
      });
    }
  }

  /** Special curative flash (green/white) for healing events. */
  public showHealFlash(): void {
    this.showHitFlash("rgba(120, 255, 150, 0.35)");
  }

  /**
   * Spawn a floating damage number at the given world position.
   * It drifts upward and fades out over ~1 second.
   */
  public showDamageNumber(worldPos: Vector3, damage: number, scene: Scene, color?: string): void {
    const camera = scene.activeCamera;
    if (!camera) return;
    const engine = scene.getEngine();
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const screenPos = Vector3.Project(worldPos, Matrix.Identity(), scene.getTransformMatrix(), viewport);
    if (screenPos.z < 0 || screenPos.z > 1) return;

    const hw = engine.getRenderWidth() / 2;
    const hh = engine.getRenderHeight() / 2;

    if (this._damageRows.length === 0) {
      for (let i = 0; i < 12; i++) {
        const label = new TextBlock();
        label.text = "";
        label.color = "#FF6030";
        label.fontSize = 24;
        label.fontWeight = "bold";
        label.shadowColor = "black";
        label.shadowBlur = 4;
        label.zIndex = 60;
        label.isVisible = false;
        this._ui.addControl(label);
        this._damageRows.push({ label, topPx: 0, elapsedMs: 0, active: false });
      }
    }

    // All busy — overwrite the number closest to expiring.
    let row = this._damageRows.find((r) => !r.active)
      ?? this._damageRows.reduce((a, b) => (a.elapsedMs > b.elapsedMs ? a : b));
    row.active = true;
    row.elapsedMs = 0;
    row.topPx = screenPos.y - hh;
    row.label.text = `-${damage}`;
    row.label.color = color ?? "#FF6030";
    row.label.left = `${screenPos.x - hw}px`;
    row.label.top = `${row.topPx}px`;
    row.label.alpha = 1;
    row.label.isVisible = true;

    if (!this._damageObs) {
      this._damageObs = this.scene.onBeforeRenderObservable.add(() => {
        const dt = this.scene.getEngine().getDeltaTime();
        const moveRate = 30 * (dt / 1000);
        let anyActive = false;
        for (const r of this._damageRows) {
          if (!r.active) continue;
          r.elapsedMs += dt;
          r.topPx -= moveRate;
          r.label.top = `${r.topPx}px`;
          r.label.alpha = Math.max(0, 1 - r.elapsedMs / this._damageLifetimeMs);
          if (r.elapsedMs >= this._damageLifetimeMs) {
            r.label.isVisible = false;
            r.active = false;
          } else {
            anyActive = true;
          }
        }
        if (!anyActive && this._damageObs) {
          this.scene.onBeforeRenderObservable.remove(this._damageObs);
          this._damageObs = null;
        }
      });
    }
  }

  // ── Debug / Performance Overlay ───────────────────────────────────────────

  private _initDebugOverlay(): void {
    this._debugPanel = new Rectangle("debugPanel");
    this._debugPanel.width = "320px";
    this._debugPanel.height = "200px";
    this._debugPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._debugPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._debugPanel.left = "10px";
    this._debugPanel.top = "10px";
    this._debugPanel.background = "rgba(0,0,0,0.70)";
    this._debugPanel.thickness = 1;
    this._debugPanel.color = "#444";
    this._debugPanel.isVisible = false;
    this._ui.addControl(this._debugPanel);

    this._debugText = new TextBlock("debugText");
    this._debugText.text = "";
    this._debugText.color = "#88FF88";
    this._debugText.fontSize = 11;
    this._debugText.fontFamily = "monospace";
    this._debugText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._debugText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._debugText.paddingLeft = "8px";
    this._debugText.paddingTop = "8px";
    this._debugPanel.addControl(this._debugText);
  }

  /**
   * Toggle the performance/debug overlay (F3).
   * Returns the new visibility state.
   */
  public toggleDebugOverlay(): boolean {
    if (!this._debugPanel) return false;
    this.isDebugVisible = !this.isDebugVisible;
    this._debugPanel.isVisible = this.isDebugVisible;
    return this.isDebugVisible;
  }

  /**
   * Update the debug overlay with live performance/world metrics.
   * Call once per second when the overlay is visible.
   */
  public updateDebugOverlay(metrics: {
    fps: number;
    drawCalls: number;
    activeMeshes: number;
    totalVertices: number;
    playerPos: { x: number; y: number; z: number };
    carryWeight: number;
    maxCarryWeight: number;
    currentCell: string;
    gameTime: string;
    stealthLabel: string;
    lodCulled?: number;
    weather?: string;
  }): void {
    if (!this._debugText || !this.isDebugVisible) return;
    const lines = [
      `FPS:        ${metrics.fps.toFixed(0)}`,
      `Draw calls: ${metrics.drawCalls}`,
      `Meshes:     ${metrics.activeMeshes}`,
      `Vertices:   ${metrics.totalVertices.toLocaleString()}`,
      `Pos: ${metrics.playerPos.x.toFixed(1)}, ${metrics.playerPos.y.toFixed(1)}, ${metrics.playerPos.z.toFixed(1)}`,
      `Weight:     ${metrics.carryWeight.toFixed(0)}/${metrics.maxCarryWeight.toFixed(0)}`,
      `Cell:       ${metrics.currentCell}`,
      `Time:       ${metrics.gameTime}`,
      `Stealth:    ${metrics.stealthLabel}`,
    ];
    if (metrics.lodCulled !== undefined) {
      lines.push(`LOD culled: ${metrics.lodCulled}`);
    }
    if (metrics.weather !== undefined) {
      lines.push(`Weather:    ${metrics.weather}`);
    }
    this._debugText.text = lines.join("\n");
  }

  // ── Stealth HUD ───────────────────────────────────────────────────────────

  private _initStealthHUD(): void {
    this._stealthPanel = new Rectangle("stealthPanel");
    this._stealthPanel.width = "90px";
    this._stealthPanel.height = "28px";
    this._stealthPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._stealthPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._stealthPanel.left = "12px";
    this._stealthPanel.top = "-80px";
    this._stealthPanel.background = "rgba(0,0,0,0.65)";
    this._stealthPanel.thickness = 1;
    this._stealthPanel.color = "#555";
    this._stealthPanel.isVisible = false;
    this._ui.addControl(this._stealthPanel);

    this._stealthLabel = new TextBlock("stealthLabel");
    this._stealthLabel.text = "Hidden";
    this._stealthLabel.color = "#88FFAA";
    this._stealthLabel.fontSize = 13;
    this._stealthLabel.fontWeight = "bold";
    this._stealthPanel.addControl(this._stealthLabel);
  }

  /** Update the stealth eye indicator. Pass null to hide it. */
  public updateStealthHUD(label: "Hidden" | "Caution" | "Detected" | null): void {
    if (!this._stealthPanel || !this._stealthLabel) return;
    if (label === this._lastStealthHudLabel) return;
    this._lastStealthHudLabel = label;
    if (!label) {
      this._stealthPanel.isVisible = false;
      return;
    }
    this._stealthPanel.isVisible = true;
    this._stealthLabel.text = label;
    this._stealthLabel.color =
      label === "Hidden"   ? "#88FFAA" :
      label === "Caution"  ? "#FFDD44" :
      "#FF4444";
  }

  // ── Clock HUD ─────────────────────────────────────────────────────────────

  private _initClockHUD(): void {
    this._clockLabel = new TextBlock("clockLabel");
    this._clockLabel.text = "08:00";
    this._clockLabel.color = T.TEXT;
    this._clockLabel.fontSize = 13;
    this._clockLabel.alpha = 0.85;
    this._clockLabel.fontFamily = "monospace";
    // A TextBlock defaults to a full-screen box with centred text, so without an
    // explicit size the alignment below moved nothing and the clock sat on the
    // crosshair. Sized box, docked under the compass (top-right holds the FPS chip).
    this._clockLabel.width = "80px";
    this._clockLabel.height = "18px";
    this._clockLabel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this._clockLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._clockLabel.top = "54px";
    this._clockLabel.shadowColor = "rgba(0,0,0,0.9)";
    this._clockLabel.shadowBlur = 2;
    this._clockLabel.shadowOffsetY = 1;
    this._ui.addControl(this._clockLabel);
  }

  /** Update the in-game clock display (under the compass). */
  public updateClock(timeString: string): void {
    if (this._clockLabel) this._clockLabel.text = timeString;
  }

  // ── Combat state readout ──────────────────────────────────────────────────

  /**
   * Show a short transient combat-state line above the quick-slots
   * ("Combo ×2", "FINISHER READY", "Riposte ready!").  Pass null to hide.
   */
  public updateCombatState(text: string | null): void {
    if (!this._combatStateLabel) {
      const label = new TextBlock("combatStateLabel");
      label.text = "";
      label.color = T.TITLE;
      label.fontSize = 15;
      label.fontWeight = "bold";
      label.shadowColor = "rgba(0,0,0,0.8)";
      label.shadowBlur = 4;
      label.height = "24px";
      label.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      label.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      label.top = "-96px";
      label.isVisible = false;
      this._ui.addControl(label);
      this._combatStateLabel = label;
    }
    if (text === this._lastCombatStateText && (text !== null) === this._lastCombatStateVisible) return;
    this._lastCombatStateText = text;
    this._lastCombatStateVisible = text !== null;
    this._combatStateLabel.text = text ?? "";
    this._combatStateLabel.isVisible = text !== null;
  }

  // ── Attribute Panel ───────────────────────────────────────────────────────

  public toggleAttributePanel(visible: boolean): void {
    this.isAttributePanelOpen = visible;
    if (visible) {
      this._attributePanel.open({
        onSpend: (name) => this.onAttributeSpend?.(name),
        onClose: () => this._closedByPlayer("attributes", () => this.toggleAttributePanel(false)),
      });
    } else {
      this._attributePanel.close();
    }
    this._syncCrosshairVisibility();
  }

  /** Show the current attribute values and pending points. */
  public refreshAttributePanel(attributes: AttributeSystem): void {
    this._attributePanel.refresh(attributes);
  }


  // ── Wait Dialog ───────────────────────────────────────────────────────────


  private _applyA11y(btn: Button, desc: string): void {
    btn.isFocusInvisible = false;
    btn.tabIndex = 0;
    btn.accessibilityTag = { description: desc };
    let focused = false;
    btn.onFocusObservable.add(() => { focused = true; btn.thickness = 2; });
    btn.onBlurObservable.add(() => { focused = false; btn.thickness = 1; });
    btn.onPointerOutObservable.add(() => { if (!focused) btn.thickness = 1; });
    btn.onKeyboardEventProcessedObservable.add((e) => {
      if (e.type === "keyup" && (e.key === "Enter" || e.key === " ")) {
        btn.onPointerUpObservable.notifyObservers(null as any);
      }
    });
  }

  public toggleWaitDialog(visible: boolean): void {
    this.isWaitDialogOpen = visible;
    if (visible) {
      this._waitDialog.open({
        onWait: (hours) => {
          this.onWaitConfirm?.(hours);
          this._closedByPlayer("wait", () => this.toggleWaitDialog(false));
        },
        onCancel: () => this._closedByPlayer("wait", () => this.toggleWaitDialog(false)),
      });
    } else {
      this._waitDialog.close();
    }
    this._syncCrosshairVisibility();
  }


  // ── Compass HUD ───────────────────────────────────────────────────────────

  private _initCompassHUD(): void {
    // Outer pill container at the top center
    const panel = new Rectangle("compassPanel");
    panel.width  = "220px";
    panel.height = "32px";
    panel.cornerRadius = 6;
    panel.color = T.PANEL_BORDER;
    panel.thickness = 1;
    panel.background = "rgba(6, 4, 2, 0.72)";
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
    panel.top = "6px";
    panel.zIndex = 5;
    this._ui.addControl(panel);
    this._compassPanel = panel;

    const label = new TextBlock("compassLabel");
    label.text  = "N";
    label.color = T.TEXT;
    label.fontSize = 13;
    label.fontFamily = "monospace";
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    label.textVerticalAlignment   = Control.VERTICAL_ALIGNMENT_CENTER;
    panel.addControl(label);
    this._compassLabel = label;
  }

  /**
   * Update the compass strip from the camera's Y-axis rotation.
   *
   * @param yawRadians  Camera yaw in radians (camera.rotation.y in Babylon.js).
   *                    Positive values rotate clockwise (East).
   */
  public updateCompass(yawRadians: number): void {
    if (!this._compassLabel) return;

    // Normalise yaw to [0, 360)
    const deg = ((yawRadians * (180 / Math.PI)) % 360 + 360) % 360;

    // Map degrees to compass segments (each segment = 45°, centred on its direction)
    const idx = Math.round(deg / 45) % 8;
    if (idx === this._lastCompassIndex) return;
    this._lastCompassIndex = idx;

    // Show three visible directions; the current facing direction is wrapped in
    // angle brackets to visually distinguish it from its neighbours.
    const prev = COMPASS_DIRECTIONS[(idx + 7) % 8];
    const curr = COMPASS_DIRECTIONS[idx];
    const next = COMPASS_DIRECTIONS[(idx + 1) % 8];

    this._compassLabel.text = `${prev}  ‹ ${curr} ›  ${next}`;
  }
}
