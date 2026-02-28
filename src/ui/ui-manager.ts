import { Scene } from "@babylonjs/core/scene";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock, Grid, Button } from "@babylonjs/gui/2D";
import { Item } from "../systems/inventory-system";
import { Quest } from "../systems/quest-system";
import { EquipSlot } from "../systems/equipment-system";
import { Player } from "../entities/player";
import type { SkillTree } from "../systems/skill-tree-system";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  PANEL_BG:     "rgba(6, 4, 2, 0.95)",
  PANEL_BORDER: "#6B4F12",
  TITLE:        "#D4A017",
  TEXT:         "#EEE0C0",
  DIM:          "#998877",
  GOOD:         "#5EC45E",
  HP_FILL:      "#CC1A1A",
  HP_BG:        "rgba(60, 4, 4, 0.7)",
  MP_FILL:      "#1A4ACC",
  MP_BG:        "rgba(4, 12, 60, 0.7)",
  SP_FILL:      "#1A8840",
  SP_BG:        "rgba(4, 28, 12, 0.7)",
  XP_FILL:      "#D4A017",
  XP_BG:        "rgba(30, 18, 0, 0.7)",
  BTN_BG:       "rgba(28, 20, 6, 0.95)",
  BTN_HOVER:    "rgba(80, 56, 10, 0.98)",
  SLOT_BG:      "rgba(20, 14, 4, 0.85)",
  SLOT_HOVER:   "rgba(50, 36, 8, 0.90)",
  EQUIP_BG:     "rgba(40, 28, 0, 0.85)",
  EQUIP_BORDER: "#D4A017",
};

export class UIManager {
  public scene: Scene;
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
  public equipmentText: TextBlock;

  private _equippedIds: Set<string> = new Set();

  /** Called when the player clicks an inventory item slot. Set by Game to hook into EquipmentSystem. */
  public onInventoryItemClick: ((item: Item) => void) | null = null;

  // Pause Menu
  public pausePanel: Rectangle;
  public resumeButton: Button;
  public saveButton: Button;
  public loadButton: Button;
  public quitButton: Button;

  // Interaction
  public interactionLabel: TextBlock;
  public crosshair: Rectangle;
  private _crosshairArms: Rectangle[] = [];

  // Quest Log
  public questLogPanel: Rectangle;
  public questLogContent: StackPanel;

  // XP Bar
  public xpBar: Rectangle;
  private _xpLevelLabel: TextBlock;

  // Notifications
  public notificationPanel: StackPanel;

  // Skill Tree
  public skillTreePanel: Rectangle;
  private _skillPointsLabel: TextBlock;
  private _skillTreeContent: StackPanel;

  /** Called when the player clicks a skill upgrade button. Set by Game. */
  public onSkillPurchase: ((treeIndex: number, skillIndex: number) => void) | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this._initUI();
    this._initInventoryUI();
    this._initPauseMenu();
    this._initQuestLogUI();
    this._initSkillTreeUI();
  }

  // ── Init methods ─────────────────────────────────────────────────────────────

  private _initUI(): void {
    this._ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");

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
      arm.thickness = 0;
      arm.background = "rgba(255,255,255,0.9)";
      this.crosshair.addControl(arm);
      this._crosshairArms.push(arm);
    }
    // Center dot
    const dot = new Rectangle();
    dot.width = "3px";
    dot.height = "3px";
    dot.thickness = 0;
    dot.background = "rgba(255,255,255,0.9)";
    this.crosshair.addControl(dot);
    this._crosshairArms.push(dot);

    // ── Interaction Label ─────────────────────────────────────────────────────
    this.interactionLabel = new TextBlock();
    this.interactionLabel.text = "";
    this.interactionLabel.color = T.TEXT;
    this.interactionLabel.fontSize = 18;
    this.interactionLabel.fontWeight = "bold";
    this.interactionLabel.top = "60px";
    this.interactionLabel.shadowColor = "rgba(0,0,0,0.9)";
    this.interactionLabel.shadowBlur = 5;
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
    xpRow.height = "16px";
    xpRow.width = "630px";
    xpRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    xpRow.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    xpRow.top = "-50px";
    this._ui.addControl(xpRow);

    this._xpLevelLabel = new TextBlock();
    this._xpLevelLabel.text = "Lv.1";
    this._xpLevelLabel.color = T.TITLE;
    this._xpLevelLabel.fontSize = 11;
    this._xpLevelLabel.fontWeight = "bold";
    this._xpLevelLabel.width = "44px";
    this._xpLevelLabel.height = "100%";
    xpRow.addControl(this._xpLevelLabel);

    const xpBarContainer = new Rectangle();
    xpBarContainer.width = "580px";
    xpBarContainer.height = "8px";
    xpBarContainer.cornerRadius = 4;
    xpBarContainer.color = T.PANEL_BORDER;
    xpBarContainer.thickness = 1;
    xpBarContainer.background = T.XP_BG;
    xpRow.addControl(xpBarContainer);

    this.xpBar = new Rectangle();
    this.xpBar.width = "0%";
    this.xpBar.height = "100%";
    this.xpBar.cornerRadius = 4;
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
    this._ui.addControl(this.notificationPanel);
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
    title.text = "✦  INVENTORY  ✦";
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

  private _initPauseMenu(): void {
    this.pausePanel = new Rectangle();
    this.pausePanel.width = "100%";
    this.pausePanel.height = "100%";
    this.pausePanel.background = "rgba(0, 0, 0, 0.82)";
    this.pausePanel.isVisible = false;
    this.pausePanel.zIndex = 100;
    this._ui.addControl(this.pausePanel);

    // Central card
    const card = new Rectangle();
    card.width = "340px";
    card.height = "440px";
    card.cornerRadius = 10;
    card.color = T.PANEL_BORDER;
    card.thickness = 2;
    card.background = T.PANEL_BG;
    card.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.pausePanel.addControl(card);

    const panel = new StackPanel();
    panel.width = "290px";
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    card.addControl(panel);

    const gameName = new TextBlock();
    gameName.text = "CAMELOT";
    gameName.color = T.TITLE;
    gameName.fontSize = 36;
    gameName.fontWeight = "bold";
    gameName.height = "64px";
    gameName.shadowColor = "rgba(0,0,0,0.9)";
    gameName.shadowBlur = 8;
    panel.addControl(gameName);

    const subtitle = new TextBlock();
    subtitle.text = "—  PAUSED  —";
    subtitle.color = T.DIM;
    subtitle.fontSize = 14;
    subtitle.height = "26px";
    panel.addControl(subtitle);

    const divider = new Rectangle();
    divider.width = "75%";
    divider.height = "1px";
    divider.background = T.PANEL_BORDER;
    divider.thickness = 0;
    divider.paddingBottom = "14px";
    panel.addControl(divider);

    this.resumeButton = this._createButton("Resume",        panel);
    this.saveButton   = this._createButton("Save Game",     panel);
    this.loadButton   = this._createButton("Load Game",     panel);
    this.quitButton   = this._createButton("Quit to Menu",  panel);
  }

  private _initQuestLogUI(): void {
    this.questLogPanel = new Rectangle();
    this.questLogPanel.width = "380px";
    this.questLogPanel.height = "500px";
    this.questLogPanel.cornerRadius = 8;
    this.questLogPanel.color = T.PANEL_BORDER;
    this.questLogPanel.thickness = 2;
    this.questLogPanel.background = T.PANEL_BG;
    this.questLogPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.questLogPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.questLogPanel.left = "20px";
    this.questLogPanel.zIndex = 10;
    this.questLogPanel.isVisible = false;
    this._ui.addControl(this.questLogPanel);

    // Title bar
    const titleBar = new Rectangle();
    titleBar.width = "100%";
    titleBar.height = "42px";
    titleBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    titleBar.thickness = 0;
    titleBar.background = "rgba(30, 20, 0, 0.60)";
    titleBar.cornerRadius = 8;
    this.questLogPanel.addControl(titleBar);

    const title = new TextBlock();
    title.text = "✦  QUEST LOG  [J]";
    title.color = T.TITLE;
    title.fontSize = 17;
    title.fontWeight = "bold";
    titleBar.addControl(title);

    const sep = new Rectangle();
    sep.width = "96%";
    sep.height = "1px";
    sep.background = T.PANEL_BORDER;
    sep.thickness = 0;
    sep.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    sep.top = "42px";
    this.questLogPanel.addControl(sep);

    this.questLogContent = new StackPanel();
    this.questLogContent.width = "360px";
    this.questLogContent.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.questLogContent.top = "52px";
    this.questLogContent.isVertical = true;
    this.questLogPanel.addControl(this.questLogContent);
  }

  private _initSkillTreeUI(): void {
    this.skillTreePanel = new Rectangle();
    this.skillTreePanel.width = "780px";
    this.skillTreePanel.height = "560px";
    this.skillTreePanel.cornerRadius = 8;
    this.skillTreePanel.color = T.PANEL_BORDER;
    this.skillTreePanel.thickness = 2;
    this.skillTreePanel.background = T.PANEL_BG;
    this.skillTreePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.skillTreePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.skillTreePanel.zIndex = 10;
    this.skillTreePanel.isVisible = false;
    this._ui.addControl(this.skillTreePanel);

    // Title bar
    const titleBar = new Rectangle();
    titleBar.width = "100%";
    titleBar.height = "42px";
    titleBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    titleBar.thickness = 0;
    titleBar.background = "rgba(30, 20, 0, 0.60)";
    titleBar.cornerRadius = 8;
    this.skillTreePanel.addControl(titleBar);

    const title = new TextBlock();
    title.text = "✦  SKILL TREE  [K]";
    title.color = T.TITLE;
    title.fontSize = 17;
    title.fontWeight = "bold";
    titleBar.addControl(title);

    const sep = new Rectangle();
    sep.width = "96%";
    sep.height = "1px";
    sep.background = T.PANEL_BORDER;
    sep.thickness = 0;
    sep.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    sep.top = "42px";
    this.skillTreePanel.addControl(sep);

    this._skillPointsLabel = new TextBlock();
    this._skillPointsLabel.text = "Skill Points: 0";
    this._skillPointsLabel.color = T.GOOD;
    this._skillPointsLabel.fontSize = 14;
    this._skillPointsLabel.height = "30px";
    this._skillPointsLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._skillPointsLabel.top = "48px";
    this.skillTreePanel.addControl(this._skillPointsLabel);

    this._skillTreeContent = new StackPanel();
    this._skillTreeContent.isVertical = false;
    this._skillTreeContent.width = "756px";
    this._skillTreeContent.height = "462px";
    this._skillTreeContent.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._skillTreeContent.top = "84px";
    this.skillTreePanel.addControl(this._skillTreeContent);
  }

  // ── Public methods ────────────────────────────────────────────────────────────

  public toggleSkillTree(visible: boolean): void {
    this.skillTreePanel.isVisible = visible;
    this.toggleCrosshair(!visible);
  }

  public refreshSkillTree(trees: SkillTree[], skillPoints: number): void {
    this._skillPointsLabel.text = `Skill Points: ${skillPoints}`;

    while (this._skillTreeContent.children.length > 0) {
      this._skillTreeContent.children[0].dispose();
    }

    trees.forEach((tree, treeIdx) => {
      const col = new StackPanel();
      col.isVertical = true;
      col.width = "252px";
      col.height = "100%";
      col.paddingLeft = "8px";
      col.paddingRight = "8px";

      // Column header
      const headerBg = new Rectangle();
      headerBg.width = "100%";
      headerBg.height = "34px";
      headerBg.cornerRadius = 5;
      headerBg.background = "rgba(50, 36, 0, 0.85)";
      headerBg.thickness = 1;
      headerBg.color = T.PANEL_BORDER;
      col.addControl(headerBg);

      const header = new TextBlock();
      header.text = tree.name.toUpperCase();
      header.color = T.TITLE;
      header.fontSize = 14;
      header.fontWeight = "bold";
      headerBg.addControl(header);

      tree.skills.forEach((skill, skillIdx) => {
        const isMax  = skill.currentRank >= skill.maxRank;
        const canBuy = !isMax && skillPoints > 0;

        const card = new Rectangle();
        card.width = "236px";
        card.height = "132px";
        card.cornerRadius = 6;
        card.color = isMax ? "#3a6a3a" : T.PANEL_BORDER;
        card.thickness = 1;
        card.background = isMax ? "rgba(10, 28, 10, 0.88)" : "rgba(16, 10, 2, 0.92)";
        card.paddingTop = "6px";
        col.addControl(card);

        const inner = new StackPanel();
        inner.isVertical = true;
        inner.width = "100%";
        card.addControl(inner);

        const nameText = new TextBlock();
        nameText.text = skill.name;
        nameText.color = isMax ? T.GOOD : T.TEXT;
        nameText.fontSize = 13;
        nameText.fontWeight = "bold";
        nameText.height = "24px";
        inner.addControl(nameText);

        const stars = "★".repeat(skill.currentRank) + "☆".repeat(skill.maxRank - skill.currentRank);
        const rankText = new TextBlock();
        rankText.text = `${stars}  (${skill.currentRank}/${skill.maxRank})`;
        rankText.color = T.TITLE;
        rankText.fontSize = 12;
        rankText.height = "20px";
        inner.addControl(rankText);

        const descText = new TextBlock();
        descText.text = skill.description;
        descText.color = T.DIM;
        descText.fontSize = 11;
        descText.height = "22px";
        descText.textWrapping = true;
        inner.addControl(descText);

        const buyLabel = isMax ? "✦ MASTERED" : (canBuy ? "[+] Upgrade" : "Need Points");
        const buyBtn = Button.CreateSimpleButton(`skill_${treeIdx}_${skillIdx}`, buyLabel);
        buyBtn.width = "90%";
        buyBtn.height = "30px";
        buyBtn.color = isMax ? T.GOOD : (canBuy ? T.TITLE : T.DIM);
        buyBtn.background = isMax ? "rgba(10,40,10,0.65)" : (canBuy ? "rgba(60,40,0,0.85)" : "rgba(18,12,2,0.55)");
        buyBtn.cornerRadius = 4;
        buyBtn.thickness = 1;
        buyBtn.fontSize = 12;
        buyBtn.hoverCursor = canBuy ? "pointer" : "default";

        if (canBuy) {
          buyBtn.onPointerUpObservable.add(() => {
            if (this.onSkillPurchase) this.onSkillPurchase(treeIdx, skillIdx);
          });
          buyBtn.onPointerEnterObservable.add(() => { buyBtn.background = "rgba(100,70,0,0.95)"; });
          buyBtn.onPointerOutObservable.add(() => { buyBtn.background = "rgba(60,40,0,0.85)"; });
        }

        inner.addControl(buyBtn);
      });

      this._skillTreeContent.addControl(col);
    });
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

    const setHover = () => {
      button.background = T.BTN_HOVER;
      button.color = T.TITLE;
    };
    const setNormal = () => {
      button.background = T.BTN_BG;
      button.color = T.TEXT;
    };

    button.onPointerEnterObservable.add(setHover);
    button.onPointerOutObservable.add(setNormal);
    button.onFocusObservable.add(setHover);
    button.onBlurObservable.add(setNormal);

    parent.addControl(button);
    return button;
  }

  public toggleInventory(visible: boolean): void {
    this.inventoryPanel.isVisible = visible;
    this.toggleCrosshair(!visible);
    if (!visible) {
      this.inventoryDescription.text = "";
    }
  }

  public togglePauseMenu(visible: boolean): void {
    this.pausePanel.isVisible = visible;
    this.toggleCrosshair(!visible);
  }

  public toggleQuestLog(visible: boolean): void {
    this.questLogPanel.isVisible = visible;
    this.toggleCrosshair(!visible);
  }

  public updateQuestLog(quests: Quest[]): void {
    while (this.questLogContent.children.length > 0) {
      this.questLogContent.children[0].dispose();
    }

    const active = quests.filter(q => q.isActive && !q.isCompleted);
    const done   = quests.filter(q => q.isCompleted);

    const addEntry = (quest: Quest): void => {
      const header = new TextBlock();
      header.text = (quest.isCompleted ? "✓ " : "◆ ") + quest.name;
      header.color = quest.isCompleted ? T.DIM : T.TITLE;
      header.fontSize = 14;
      header.fontWeight = "bold";
      header.height = "26px";
      header.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      header.paddingLeft = "12px";
      header.paddingTop = "4px";
      this.questLogContent.addControl(header);

      for (const obj of quest.objectives) {
        const objText = new TextBlock();
        const check = obj.completed ? "✓" : "○";
        objText.text = `    ${check} ${obj.description} (${obj.current}/${obj.required})`;
        objText.color = obj.completed ? T.DIM : T.TEXT;
        objText.fontSize = 12;
        objText.height = "20px";
        objText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        objText.paddingLeft = "12px";
        this.questLogContent.addControl(objText);
      }

      if (quest.reward) {
        const rewardText = new TextBlock();
        rewardText.text = `    Reward: ${quest.reward}`;
        rewardText.color = T.GOOD;
        rewardText.fontSize = 11;
        rewardText.height = "18px";
        rewardText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        rewardText.paddingLeft = "12px";
        this.questLogContent.addControl(rewardText);
      }

      // Subtle divider between quest entries
      const questSep = new Rectangle();
      questSep.width = "88%";
      questSep.height = "1px";
      questSep.background = "rgba(107, 79, 18, 0.35)";
      questSep.thickness = 0;
      questSep.paddingTop = "4px";
      this.questLogContent.addControl(questSep);
    };

    for (const q of active) addEntry(q);
    for (const q of done)   addEntry(q);

    if (active.length === 0 && done.length === 0) {
      const empty = new TextBlock();
      empty.text = "No quests yet.";
      empty.color = T.DIM;
      empty.fontSize = 13;
      empty.height = "30px";
      empty.paddingLeft = "12px";
      this.questLogContent.addControl(empty);
    }
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

  public updateStats(player: Player): void {
    this.statsText.text = `Stats:\nLv: ${player.level}  XP: ${Math.floor(player.experience)}/${player.experienceToNextLevel}\nHP: ${Math.floor(player.health)} / ${player.maxHealth}\nMP: ${Math.floor(player.magicka)} / ${player.maxMagicka}\nSP: ${Math.floor(player.stamina)} / ${player.maxStamina}\nDMG Bonus: +${player.bonusDamage}\nArmor: ${player.bonusArmor}`;
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

      const setHoverState = () => {
        const equipped = this._equippedIds.has(item.id);
        const hint = item.slot ? (equipped ? "\n[Click to Unequip]" : "\n[Click to Equip]") : "";
        this.inventoryDescription.text = `${item.name}\n${item.description}\nQty: ${item.quantity}${hint}`;
        slot.background = hoverColor;
      };
      const setNormalState = () => {
        this.inventoryDescription.text = "";
        slot.background = baseColor;
      };

      slot.onPointerEnterObservable.add(setHoverState);
      slot.onPointerOutObservable.add(setNormalState);
      slot.onFocusObservable.add(setHoverState);
      slot.onBlurObservable.add(setNormalState);

      const triggerItem = () => {
        if (item.slot && this.onInventoryItemClick) {
          this.onInventoryItemClick(item);
        }
      };

      if (item.slot) {
        slot.onPointerUpObservable.add(triggerItem);
        slot.onKeyboardEventProcessedObservable.add((evt) => {
          if (evt.type === "keyup" && (evt.key === "Enter" || evt.key === " ")) {
            triggerItem();
          }
        });
      }

      const text = new TextBlock();
      text.text = item.name + (item.quantity > 1 ? ` (${item.quantity})` : "");
      text.color = isEquipped ? T.TITLE : T.TEXT;
      text.fontSize = 11;
      text.textWrapping = true;
      slot.addControl(text);

      this.inventoryGrid.addControl(slot, row, col);
    });
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

  public showNotification(text: string, duration: number = 3000): void {
    const rect = new Rectangle();
    rect.width = "100%";
    rect.height = "38px";
    rect.cornerRadius = 6;
    rect.color = T.PANEL_BORDER;
    rect.thickness = 1;
    rect.background = "rgba(8, 5, 0, 0.92)";
    rect.paddingBottom = "4px";

    const label = new TextBlock();
    label.text = text;
    label.color = T.TITLE;
    label.fontSize = 14;
    label.fontWeight = "bold";
    rect.addControl(label);

    this.notificationPanel.addControl(rect);

    let elapsedMs = 0;
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      elapsedMs += this.scene.getEngine().getDeltaTime();
      if (elapsedMs >= duration) {
        this.scene.onBeforeRenderObservable.remove(obs);
        if (this.notificationPanel.children.includes(rect)) {
          this.notificationPanel.removeControl(rect);
        }
        rect.dispose();
      }
    });
  }

  private _createBar(label: string, fillColor: string, trackColor: string, parent: StackPanel): { container: Rectangle, bar: Rectangle } {
    const container = new Rectangle();
    container.width = "192px";
    container.height = "22px";
    container.cornerRadius = 5;
    container.color = "rgba(255,255,255,0.10)";
    container.thickness = 1;
    container.background = trackColor;
    parent.addControl(container);

    const bar = new Rectangle();
    bar.width = "100%";
    bar.height = "100%";
    bar.cornerRadius = 5;
    bar.thickness = 0;
    bar.background = fillColor;
    bar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    container.addControl(bar);

    // Label overlaid on top of bar
    const labelText = new TextBlock();
    labelText.text = label;
    labelText.color = "rgba(255,255,255,0.82)";
    labelText.fontSize = 10;
    labelText.fontWeight = "bold";
    labelText.width = "100%";
    labelText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    labelText.paddingLeft = "7px";
    container.addControl(labelText);

    return { container, bar };
  }

  public updateHealth(current: number, max: number): void {
    this.healthBar.width = `${max > 0 ? Math.max(0, current / max) * 100 : 0}%`;
  }

  public updateMagicka(current: number, max: number): void {
    this.magickaBar.width = `${max > 0 ? Math.max(0, current / max) * 100 : 0}%`;
  }

  public updateStamina(current: number, max: number): void {
    this.staminaBar.width = `${max > 0 ? Math.max(0, current / max) * 100 : 0}%`;
  }

  public updateXP(current: number, max: number, level: number): void {
    this.xpBar.width = `${max > 0 ? Math.max(0, current / max) * 100 : 0}%`;
    this._xpLevelLabel.text = `Lv.${level}`;
  }

  /** Flash a translucent color overlay to signal being hit or dealing damage. */
  public showHitFlash(color: string = "red"): void {
    const flash = new Rectangle();
    flash.width = "100%";
    flash.height = "100%";
    flash.background = color;
    flash.alpha = 0.28;
    flash.isPointerBlocker = false;
    flash.zIndex = 50;
    this._ui.addControl(flash);
    let elapsedMs = 0;
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      elapsedMs += this.scene.getEngine().getDeltaTime();
      if (elapsedMs >= 150) {
        this.scene.onBeforeRenderObservable.remove(obs);
        this._ui.removeControl(flash);
        flash.dispose();
      }
    });
  }

  /**
   * Spawn a floating damage number at the given world position.
   * It drifts upward and fades out over ~1 second.
   */
  public showDamageNumber(worldPos: Vector3, damage: number, scene: Scene): void {
    const camera = scene.activeCamera;
    if (!camera) return;
    const engine = scene.getEngine();
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const screenPos = Vector3.Project(worldPos, Matrix.Identity(), scene.getTransformMatrix(), viewport);
    if (screenPos.z < 0 || screenPos.z > 1) return;

    const hw = engine.getRenderWidth() / 2;
    const hh = engine.getRenderHeight() / 2;

    const text = new TextBlock();
    text.text = `-${damage}`;
    text.color = "#FF6030";
    text.fontSize = 24;
    text.fontWeight = "bold";
    text.shadowColor = "black";
    text.shadowBlur = 4;
    text.left = `${screenPos.x - hw}px`;
    text.top = `${screenPos.y - hh}px`;
    text.zIndex = 60;
    this._ui.addControl(text);

    let elapsed = 0;
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const dt = this.scene.getEngine().getDeltaTime();
      elapsed += dt;
      const moveRate = 30 * (dt / 1000);
      const topPx = parseFloat(text.top as string) - moveRate;
      text.top = `${topPx}px`;
      text.alpha = Math.max(0, 1 - elapsed / 1000);
      if (elapsed >= 1000) {
        this.scene.onBeforeRenderObservable.remove(obs);
        this._ui.removeControl(text);
        text.dispose();
      }
    });
  }
}
