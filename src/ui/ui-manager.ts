import { Scene } from "@babylonjs/core/scene";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock, Grid, Button, Ellipse } from "@babylonjs/gui/2D";
import { Item } from "../systems/inventory-system";
import { Player } from "../entities/player";

// Skyrim-style UI palette
const SKYRIM_COLORS = {
  GOLD: "#D4AF37",
  BROWN: "#8B7355",
  DARK: "rgba(20, 15, 10, 0.95)",
  VERY_DARK: "rgba(20, 15, 10, 0.9)",
  LIGHT_BROWN: "rgba(100, 80, 60, 0.8)",
  DARK_INTERIOR: "rgba(30, 25, 20, 0.8)",
  HEALTH_RED: "#DC143C",
  MAGICKA_BLUE: "#4169E1",
  STAMINA_GREEN: "#228B22",
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

  // Level and XP display
  public levelText: TextBlock;
  public xpBar: Rectangle;

  // Pause Menu
  public pausePanel: Rectangle;
  public resumeButton: Button;
  public saveButton: Button;
  public loadButton: Button;
  public quitButton: Button;

  // Interaction
  public interactionLabel: TextBlock;
  public crosshair: Ellipse;

  // Notifications
  public notificationPanel: StackPanel;

  constructor(scene: Scene) {
    this.scene = scene;
    this._initUI();
    this._initInventoryUI();
    this._initPauseMenu();
  }

  private _initInventoryUI(): void {
    this.inventoryPanel = new Rectangle();
    this.inventoryPanel.width = "700px";
    this.inventoryPanel.height = "700px";
    this.inventoryPanel.cornerRadius = 0;
    this.inventoryPanel.color = SKYRIM_COLORS.BROWN;
    this.inventoryPanel.thickness = 3;
    this.inventoryPanel.background = SKYRIM_COLORS.DARK;
    this.inventoryPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.inventoryPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.inventoryPanel.left = "-20px";
    this.inventoryPanel.isVisible = false;
    this._ui.addControl(this.inventoryPanel);

    const topBorder = new Rectangle();
    topBorder.width = "100%";
    topBorder.height = "3px";
    topBorder.background = SKYRIM_COLORS.GOLD;
    topBorder.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    topBorder.isPointerBlocker = false;
    this.inventoryPanel.addControl(topBorder);

    const title = new TextBlock();
    title.text = "INVENTORY";
    title.color = SKYRIM_COLORS.GOLD;
    title.fontSize = 32;
    title.height = "50px";
    title.fontStyle = "bold";
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.top = "15px";
    title.shadowBlur = 2;
    title.shadowColor = "black";
    this.inventoryPanel.addControl(title);

    // Main Grid: Left (Items), Right (Details & Stats)
    const mainGrid = new Grid();
    mainGrid.width = "680px";
    mainGrid.height = "600px";
    mainGrid.top = "60px";
    mainGrid.addColumnDefinition(0.55);
    mainGrid.addColumnDefinition(0.45);
    this.inventoryPanel.addControl(mainGrid);

    // Inventory Grid (Left Column)
    this.inventoryGrid = new Grid();
    this.inventoryGrid.width = "100%";
    this.inventoryGrid.height = "100%";
    this.inventoryGrid.paddingLeft = "10px";

    for (let i = 0; i < 6; i++) {
        this.inventoryGrid.addRowDefinition(1);
    }
    for (let i = 0; i < 4; i++) {
        this.inventoryGrid.addColumnDefinition(1);
    }
    mainGrid.addControl(this.inventoryGrid, 0, 0);

    // Right Column (Details + Stats)
    const rightPanel = new StackPanel();
    rightPanel.width = "100%";
    rightPanel.height = "100%";
    mainGrid.addControl(rightPanel, 0, 1);

    // Description Area
    const descContainer = new Rectangle();
    descContainer.width = "100%";
    descContainer.height = "200px";
    descContainer.color = SKYRIM_COLORS.BROWN;
    descContainer.thickness = 2;
    descContainer.background = SKYRIM_COLORS.DARK;
    rightPanel.addControl(descContainer);

    this.inventoryDescription = new TextBlock();
    this.inventoryDescription.text = "";
    this.inventoryDescription.color = SKYRIM_COLORS.GOLD;
    this.inventoryDescription.fontSize = 14;
    this.inventoryDescription.textWrapping = true;
    this.inventoryDescription.paddingLeft = "10px";
    this.inventoryDescription.paddingTop = "10px";
    this.inventoryDescription.fontStyle = "italic";
    descContainer.addControl(this.inventoryDescription);

    // Stats Area
    const statsContainer = new Rectangle();
    statsContainer.width = "100%";
    statsContainer.height = "200px";
    statsContainer.color = SKYRIM_COLORS.BROWN;
    statsContainer.thickness = 2;
    statsContainer.background = SKYRIM_COLORS.DARK;
    statsContainer.top = "20px"; // Margin top
    rightPanel.addControl(statsContainer);

    this.statsText = new TextBlock();
    this.statsText.text = "Stats:\nHP: --\nMP: --\nSP: --";
    this.statsText.color = SKYRIM_COLORS.GOLD;
    this.statsText.fontSize = 16;
    this.statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.statsText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.statsText.paddingTop = "10px";
    this.statsText.paddingLeft = "10px";
    this.statsText.fontStyle = "bold";
    statsContainer.addControl(this.statsText);
  }

  private _initPauseMenu(): void {
      this.pausePanel = new Rectangle();
      this.pausePanel.width = "100%";
      this.pausePanel.height = "100%";
      this.pausePanel.background = "rgba(0, 0, 0, 0.7)";
      this.pausePanel.isVisible = false;
      this.pausePanel.zIndex = 100;
      this._ui.addControl(this.pausePanel);

      const panel = new StackPanel();
      panel.width = "400px";
      panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      this.pausePanel.addControl(panel);

      const bgPanel = new Rectangle();
      bgPanel.width = "100%";
      bgPanel.height = "100%";
      bgPanel.background = SKYRIM_COLORS.DARK;
      bgPanel.color = SKYRIM_COLORS.GOLD;
      bgPanel.thickness = 3;
      bgPanel.cornerRadius = 0;
      bgPanel.zIndex = -1;
      panel.addControl(bgPanel);

      const title = new TextBlock();
      title.text = "═══════════════\nPAUSED\n═══════════════";
      title.color = SKYRIM_COLORS.GOLD;
      title.fontSize = 40;
      title.height = "120px";
      title.fontStyle = "bold";
      title.shadowBlur = 5;
      title.shadowColor = "black";
      panel.addControl(title);

      this.resumeButton = this._createButton("Resume Game", panel);
      this.saveButton = this._createButton("Save Game", panel);
      this.loadButton = this._createButton("Load Game", panel);
      this.quitButton = this._createButton("Quit to Menu", panel);
  }

  private _createButton(text: string, parent: StackPanel): Button {
      const button = Button.CreateSimpleButton("btn_" + text, text);
      button.width = "90%";
      button.height = "50px";
      button.color = SKYRIM_COLORS.BROWN;
      button.cornerRadius = 0;
      button.background = SKYRIM_COLORS.DARK_INTERIOR;
      button.paddingBottom = "10px";
      button.paddingTop = "5px";
      button.hoverCursor = "pointer";
      button.thickness = 2;
      button.fontSize = 18;
      button.fontStyle = "bold";

      const textBlock = button.children[0] as TextBlock;
      if (textBlock) {
          textBlock.color = SKYRIM_COLORS.GOLD;
          textBlock.fontSize = 18;
      }

      button.onPointerEnterObservable.add(() => {
          button.background = SKYRIM_COLORS.LIGHT_BROWN;
          button.color = SKYRIM_COLORS.GOLD;
      });
      button.onPointerOutObservable.add(() => {
          button.background = SKYRIM_COLORS.DARK_INTERIOR;
          button.color = SKYRIM_COLORS.BROWN;
      });

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

  public toggleCrosshair(visible: boolean): void {
      this.crosshair.isVisible = visible;
  }

  public updateStats(player: Player): void {
      // Calculate bonuses from equipment
      const healthBonus = player.maxHealth - player.baseMaxHealth;
      const magickaBonus = player.maxMagicka - player.baseMaxMagicka;
      const staminaBonus = player.maxStamina - player.baseMaxStamina;
      const damageBonus = player.damage - 1;
      const armorBonus = player.armor;

      let statsText = `Stats:
HP: ${Math.floor(player.health)} / ${player.maxHealth}`;
      if (healthBonus > 0) statsText += ` [+${healthBonus}]`;

      statsText += `
MP: ${Math.floor(player.magicka)} / ${player.maxMagicka}`;
      if (magickaBonus > 0) statsText += ` [+${magickaBonus}]`;

      statsText += `
SP: ${Math.floor(player.stamina)} / ${player.maxStamina}`;
      if (staminaBonus > 0) statsText += ` [+${staminaBonus}]`;

      statsText += `
DMG: ${player.damage.toFixed(1)}`;
      if (damageBonus > 0) statsText += ` [+${damageBonus.toFixed(1)}]`;

      if (armorBonus > 0) {
        statsText += `
ARM: ${armorBonus}`;
      }

      this.statsText.text = statsText;

      // Update level and XP bar
      this.levelText.text = `◆ Level ${player.experience.level} ◆`;
      const xpProgress = player.experience.getXPProgress();
      this.xpBar.width = `${Math.max(0, Math.min(100, xpProgress))}%`;
  }

  public updateInventory(
    items: Item[],
    equipment?: Array<{ slot: string; item: Item | null }>,
    callbacks?: { onEquip?: (itemId: string, slot: string) => void; onUnequip?: (slot: string) => void }
  ): void {
      // Store callbacks for UI interactions
      (this as any)._equipCallbacks = callbacks;

      // Update inventory grid
      while (this.inventoryGrid.children.length > 0) {
          this.inventoryGrid.children[0].dispose();
      }

      items.forEach((item, index) => {
          if (index >= 20) return;
          const row = Math.floor(index / 4);
          const col = index % 4;
          this._createInventorySlot(item, index, row, col);
      });

      // Update equipment slots
      if (equipment) {
          this._updateEquipmentSlots(equipment);
      }
  }

  private _createInventorySlot(item: Item, index: number, row: number, col: number): void {
      const slot = new Rectangle();
      slot.width = "80px";
      slot.height = "80px";
      slot.color = SKYRIM_COLORS.BROWN;
      slot.thickness = 2;
      slot.background = SKYRIM_COLORS.DARK_INTERIOR;
      slot.isPointerBlocker = true;
      slot.hoverCursor = "pointer";

      // Metadata for drag-and-drop
      (slot as any).itemIndex = index;
      (slot as any).itemData = item;

      slot.onPointerEnterObservable.add(() => {
          this.inventoryDescription.text = `${item.name}\n${item.description}\nQty: ${item.quantity}`;
          slot.background = SKYRIM_COLORS.LIGHT_BROWN;
          slot.color = SKYRIM_COLORS.GOLD;
      });
      slot.onPointerOutObservable.add(() => {
          this.inventoryDescription.text = "";
          slot.background = SKYRIM_COLORS.DARK_INTERIOR;
          slot.color = SKYRIM_COLORS.BROWN;
      });

      // Double-click to equip
      let lastClickTime = 0;
      slot.onPointerUpObservable.add(() => {
          const now = Date.now();
          if (now - lastClickTime < 300) {
              // Double-click detected
              const callbacks = (this as any)._equipCallbacks;
              if (callbacks?.onEquip) {
                  if (item.stats?.damage) {
                      callbacks.onEquip(item.id, "mainHand");
                  } else if (item.stats?.armor) {
                      callbacks.onEquip(item.id, "armor");
                  } else {
                      callbacks.onEquip(item.id, "accessory");
                  }
              }
          }
          lastClickTime = now;
      });

      const text = new TextBlock();
      text.text = item.name + (item.quantity > 1 ? ` (${item.quantity})` : "");
      text.color = SKYRIM_COLORS.GOLD;
      text.fontSize = 12;
      text.fontStyle = "bold";
      text.textWrapping = true;
      slot.addControl(text);

      this.inventoryGrid.addControl(slot, row, col);
  }

  private _updateEquipmentSlots(equipment: Array<{ slot: string; item: Item | null }>): void {
      // Find or create the equipment panel (next to stats)
      // We'll add it dynamically if it doesn't exist
      let equipPanel = (this as any)._equipmentPanel;
      if (!equipPanel) {
          // Create equipment panel on the right side
          equipPanel = new Rectangle();
          equipPanel.width = "100%";
          equipPanel.height = "220px";
          equipPanel.color = SKYRIM_COLORS.BROWN;
          equipPanel.thickness = 2;
          equipPanel.background = SKYRIM_COLORS.DARK;
          equipPanel.top = "-220px"; // Position above stats
          const rightPanel = this.inventoryPanel.children[0] as any; // The main grid
          const statsContainer = rightPanel.children?.[1]; // Stats is at index 1
          if (statsContainer?.parent) {
              statsContainer.parent.insertControl(equipPanel, statsContainer, true);
          }
          (this as any)._equipmentPanel = equipPanel;
      }

      // Clear existing equipment slots
      while (equipPanel.children?.length > 0) {
          equipPanel.children[0].dispose();
      }

      // Create a grid for equipment slots (6 slots in 2 rows x 3 cols)
      const equipGrid = new Grid();
      equipGrid.width = "100%";
      equipGrid.height = "100%";
      for (let i = 0; i < 2; i++) equipGrid.addRowDefinition(1);
      for (let i = 0; i < 3; i++) equipGrid.addColumnDefinition(1);

      equipment.forEach(({ slot, item }, idx) => {
          const row = Math.floor(idx / 3);
          const col = idx % 3;
          const slotRect = new Rectangle();
          slotRect.width = "80px";
          slotRect.height = "80px";
          slotRect.color = item ? SKYRIM_COLORS.GOLD : SKYRIM_COLORS.BROWN;
          slotRect.thickness = 2;
          slotRect.background = item ? SKYRIM_COLORS.LIGHT_BROWN : SKYRIM_COLORS.DARK_INTERIOR;
          slotRect.isPointerBlocker = true;
          slotRect.hoverCursor = "pointer";

          // Metadata
          (slotRect as any).slotName = slot;
          (slotRect as any).item = item;

          // Hover effect
          slotRect.onPointerEnterObservable.add(() => {
              slotRect.background = SKYRIM_COLORS.LIGHT_BROWN;
              slotRect.color = SKYRIM_COLORS.GOLD;
          });
          slotRect.onPointerOutObservable.add(() => {
              slotRect.background = item ? SKYRIM_COLORS.LIGHT_BROWN : SKYRIM_COLORS.DARK_INTERIOR;
              slotRect.color = item ? SKYRIM_COLORS.GOLD : SKYRIM_COLORS.BROWN;
          });

          // Click to unequip
          slotRect.onPointerUpObservable.add(() => {
              if (item) {
                  const callbacks = (this as any)._equipCallbacks;
                  callbacks?.onUnequip?.(slot);
              }
          });

          const slotLabel = new TextBlock();
          slotLabel.text = item ? item.name : slot.toUpperCase();
          slotLabel.color = SKYRIM_COLORS.GOLD;
          slotLabel.fontSize = 11;
          slotLabel.textWrapping = true;
          slotLabel.fontStyle = "bold";
          slotRect.addControl(slotLabel);

          equipGrid.addControl(slotRect, row, col);
      });

      equipPanel.addControl(equipGrid);
  }

  public setInteractionText(text: string): void {
      this.interactionLabel.text = text;
  }

  private _initUI(): void {
    this._ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // Interaction Label (Center) - Skyrim style
    this.interactionLabel = new TextBlock();
    this.interactionLabel.text = "";
    this.interactionLabel.color = SKYRIM_COLORS.GOLD;
    this.interactionLabel.fontSize = 22;
    this.interactionLabel.fontStyle = "bold";
    this.interactionLabel.top = "60px";
    this.interactionLabel.shadowBlur = 3;
    this.interactionLabel.shadowColor = "black";
    this._ui.addControl(this.interactionLabel);

    // Crosshair (Center) - Skyrim style
    this.crosshair = new Ellipse();
    this.crosshair.width = "20px";
    this.crosshair.height = "20px";
    this.crosshair.color = SKYRIM_COLORS.GOLD;
    this.crosshair.thickness = 1;
    this.crosshair.background = "rgba(0, 0, 0, 0)";
    this._ui.addControl(this.crosshair);

    // Compass Bar (Top Center) - Skyrim style
    const compassContainer = new Rectangle();
    compassContainer.width = "450px";
    compassContainer.height = "40px";
    compassContainer.cornerRadius = 0;
    compassContainer.color = SKYRIM_COLORS.BROWN;
    compassContainer.thickness = 2;
    compassContainer.background = SKYRIM_COLORS.VERY_DARK;
    compassContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    compassContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    compassContainer.top = "20px";
    this._ui.addControl(compassContainer);

    const compassLabel = new TextBlock();
    compassLabel.text = "◊ N  •  E  •  S  •  W ◊";
    compassLabel.color = SKYRIM_COLORS.GOLD;
    compassLabel.fontSize = 18;
    compassLabel.fontStyle = "bold";
    compassContainer.addControl(compassLabel);

    // Level and XP Display (Top Right) - Skyrim style
    const levelContainer = new Rectangle();
    levelContainer.width = "160px";
    levelContainer.height = "80px";
    levelContainer.cornerRadius = 0;
    levelContainer.color = SKYRIM_COLORS.BROWN;
    levelContainer.thickness = 2;
    levelContainer.background = SKYRIM_COLORS.VERY_DARK;
    levelContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    levelContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    levelContainer.top = "20px";
    levelContainer.left = "-20px";
    this._ui.addControl(levelContainer);

    // Level text
    this.levelText = new TextBlock();
    this.levelText.text = "◆ Level 1 ◆";
    this.levelText.color = SKYRIM_COLORS.GOLD;
    this.levelText.fontSize = 18;
    this.levelText.fontStyle = "bold";
    this.levelText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.levelText.paddingTop = "8px";
    this.levelText.shadowBlur = 2;
    this.levelText.shadowColor = "black";
    levelContainer.addControl(this.levelText);

    // XP Bar container
    const xpContainer = new Rectangle();
    xpContainer.width = "140px";
    xpContainer.height = "8px";
    xpContainer.cornerRadius = 0;
    xpContainer.color = SKYRIM_COLORS.BROWN;
    xpContainer.thickness = 1;
    xpContainer.background = "rgba(30, 20, 10, 0.9)";
    xpContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    xpContainer.top = "-8px";
    levelContainer.addControl(xpContainer);

    // XP progress bar
    this.xpBar = new Rectangle();
    this.xpBar.width = "100%";
    this.xpBar.height = "100%";
    this.xpBar.cornerRadius = 0;
    this.xpBar.color = SKYRIM_COLORS.MAGICKA_BLUE;
    this.xpBar.thickness = 0;
    this.xpBar.background = SKYRIM_COLORS.MAGICKA_BLUE;
    this.xpBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    xpContainer.addControl(this.xpBar);

    // Status Bars Container (Bottom Center)
    // Skyrim style: Magicka (Left), Health (Center), Stamina (Right)
    // But usually in Skyrim:
    // Health is center. Magicka is left. Stamina is right.
    // They are separate bars that appear when needed.
    // For now, I'll make them persistent at the bottom.

    const barsPanel = new StackPanel();
    barsPanel.isVertical = false;
    barsPanel.height = "30px";
    barsPanel.width = "600px";
    barsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    barsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    barsPanel.top = "-20px";
    // barsPanel.spacing = 20; // Check if supported
    this._ui.addControl(barsPanel);

    // Magicka Bar (Blue)
    const magickaContainer = this._createBarContainer(SKYRIM_COLORS.MAGICKA_BLUE, barsPanel);
    magickaContainer.paddingRight = "10px";
    this.magickaBar = (magickaContainer.children[0] as Rectangle);

    // Health Bar (Red)
    const healthContainer = this._createBarContainer(SKYRIM_COLORS.HEALTH_RED, barsPanel);
    healthContainer.paddingLeft = "5px";
    healthContainer.paddingRight = "5px";
    this.healthBar = (healthContainer.children[0] as Rectangle);

    // Stamina Bar (Green)
    const staminaContainer = this._createBarContainer(SKYRIM_COLORS.STAMINA_GREEN, barsPanel);
    staminaContainer.paddingLeft = "10px";
    this.staminaBar = (staminaContainer.children[0] as Rectangle);

    // Notification Panel (Top Left)
    this.notificationPanel = new StackPanel();
    this.notificationPanel.width = "300px";
    this.notificationPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.notificationPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.notificationPanel.top = "100px";
    this.notificationPanel.left = "20px";
    this.notificationPanel.isVertical = true;
    this._ui.addControl(this.notificationPanel);
  }

  public showNotification(text: string, duration: number = 3000): void {
      const rect = new Rectangle();
      rect.width = "100%";
      rect.height = "40px";
      rect.cornerRadius = 0;
      rect.color = SKYRIM_COLORS.BROWN;
      rect.thickness = 2;
      rect.background = SKYRIM_COLORS.DARK_INTERIOR;
      rect.paddingBottom = "5px";

      const label = new TextBlock();
      label.text = text;
      label.color = SKYRIM_COLORS.GOLD;
      label.fontSize = 16;
      label.fontStyle = "bold";
      label.shadowBlur = 2;
      label.shadowColor = "black";
      rect.addControl(label);

      // Add to top of stack by default? StackPanel adds to end.
      // Newer notifications appear below older ones.
      this.notificationPanel.addControl(rect);

      setTimeout(() => {
          if (this.notificationPanel.children.includes(rect)) {
              this.notificationPanel.removeControl(rect);
          }
          rect.dispose();
      }, duration);
  }

  private _createBarContainer(color: string, parent: StackPanel): Rectangle {
    const container = new Rectangle();
    container.width = "180px";
    container.height = "15px";
    container.cornerRadius = 2;
    container.color = "white";
    container.thickness = 1;
    container.background = "black";
    parent.addControl(container);

    const bar = new Rectangle();
    bar.width = "100%"; // 100%
    bar.height = "100%";
    bar.cornerRadius = 2;
    bar.color = color;
    bar.thickness = 0;
    bar.background = color;
    bar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    container.addControl(bar);

    return container;
  }

  public updateHealth(current: number, max: number): void {
      this.healthBar.width = `${Math.max(0, current / max) * 100}%`;
  }

  public updateMagicka(current: number, max: number): void {
      this.magickaBar.width = `${Math.max(0, current / max) * 100}%`;
  }

  public updateStamina(current: number, max: number): void {
      this.staminaBar.width = `${Math.max(0, current / max) * 100}%`;
  }

  /** Flash a translucent color overlay to signal being hit or dealing damage. */
  public showHitFlash(color: string = "red"): void {
    const flash = new Rectangle();
    flash.width = "100%";
    flash.height = "100%";
    flash.background = color;
    flash.alpha = 0.35;
    flash.isPointerBlocker = false;
    flash.zIndex = 50;
    this._ui.addControl(flash);
    setTimeout(() => {
      this._ui.removeControl(flash);
      flash.dispose();
    }, 150);
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
    const screenPos = Vector3.Project(
      worldPos,
      Matrix.Identity(),
      camera.getViewMatrix(),
      viewport
    );
    if (screenPos.z < 0 || screenPos.z > 1) return;

    const hw = engine.getRenderWidth() / 2;
    const hh = engine.getRenderHeight() / 2;

    const text = new TextBlock();
    text.text = `-${damage}`;
    text.color = "orange";
    text.fontSize = 22;
    text.fontWeight = "bold";
    text.shadowColor = "black";
    text.shadowBlur = 3;
    text.left = `${screenPos.x - hw}px`;
    text.top = `${screenPos.y - hh}px`;
    text.zIndex = 60;
    this._ui.addControl(text);

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 50;
      const topPx = parseFloat(text.top as string) - 1.5;
      text.top = `${topPx}px`;
      text.alpha = Math.max(0, 1 - elapsed / 1000);
      if (elapsed >= 1000) {
        clearInterval(interval);
        this._ui.removeControl(text);
        text.dispose();
      }
    }, 50);
  }
}
