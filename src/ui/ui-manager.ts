import { Scene } from "@babylonjs/core/scene";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock, Grid, Button, Ellipse } from "@babylonjs/gui/2D";
import { Item } from "../systems/inventory-system";
import { Player } from "../entities/player";

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
    this.inventoryPanel.width = "600px"; // Wider for split view
    this.inventoryPanel.height = "600px";
    this.inventoryPanel.cornerRadius = 10;
    this.inventoryPanel.color = "white";
    this.inventoryPanel.thickness = 2;
    this.inventoryPanel.background = "rgba(0, 0, 0, 0.9)";
    this.inventoryPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.inventoryPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.inventoryPanel.left = "-20px";
    this.inventoryPanel.isVisible = false;
    this._ui.addControl(this.inventoryPanel);

    const title = new TextBlock();
    title.text = "Inventory";
    title.color = "white";
    title.fontSize = 24;
    title.height = "40px";
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.top = "10px";
    this.inventoryPanel.addControl(title);

    // Main Grid: Left (Items), Right (Details & Stats)
    const mainGrid = new Grid();
    mainGrid.width = "560px";
    mainGrid.height = "520px";
    mainGrid.top = "40px";
    mainGrid.addColumnDefinition(0.6); // 60% Items
    mainGrid.addColumnDefinition(0.4); // 40% Stats
    this.inventoryPanel.addControl(mainGrid);

    // Inventory Grid (Left Column)
    this.inventoryGrid = new Grid();
    this.inventoryGrid.width = "100%";
    this.inventoryGrid.height = "100%";

    // Define grid columns and rows (e.g., 5x4)
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
    descContainer.color = "white";
    descContainer.thickness = 1;
    descContainer.background = "rgba(0,0,0,0.5)";
    rightPanel.addControl(descContainer);

    this.inventoryDescription = new TextBlock();
    this.inventoryDescription.text = "";
    this.inventoryDescription.color = "white";
    this.inventoryDescription.fontSize = 14;
    this.inventoryDescription.textWrapping = true;
    this.inventoryDescription.paddingLeft = "5px";
    descContainer.addControl(this.inventoryDescription);

    // Stats Area
    const statsContainer = new Rectangle();
    statsContainer.width = "100%";
    statsContainer.height = "200px";
    statsContainer.color = "white";
    statsContainer.thickness = 1;
    statsContainer.background = "rgba(0,0,0,0.5)";
    statsContainer.top = "20px"; // Margin top
    rightPanel.addControl(statsContainer);

    this.statsText = new TextBlock();
    this.statsText.text = "Stats:\nHP: --\nMP: --\nSP: --";
    this.statsText.color = "white";
    this.statsText.fontSize = 16;
    this.statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.statsText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.statsText.paddingTop = "10px";
    this.statsText.paddingLeft = "10px";
    statsContainer.addControl(this.statsText);
  }

  private _initPauseMenu(): void {
      this.pausePanel = new Rectangle();
      this.pausePanel.width = "100%";
      this.pausePanel.height = "100%";
      this.pausePanel.background = "rgba(0, 0, 0, 0.8)";
      this.pausePanel.isVisible = false;
      this.pausePanel.zIndex = 100; // On top
      this._ui.addControl(this.pausePanel);

      const panel = new StackPanel();
      panel.width = "300px";
      panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      this.pausePanel.addControl(panel);

      const title = new TextBlock();
      title.text = "PAUSED";
      title.color = "white";
      title.fontSize = 48;
      title.height = "100px";
      title.shadowBlur = 5;
      title.shadowColor = "black";
      panel.addControl(title);

      this.resumeButton = this._createButton("Resume", panel);
      this.saveButton = this._createButton("Save", panel);
      this.loadButton = this._createButton("Load", panel);
      this.quitButton = this._createButton("Quit", panel);
  }

  private _createButton(text: string, parent: StackPanel): Button {
      const button = Button.CreateSimpleButton("btn_" + text, text);
      button.width = "100%";
      button.height = "50px";
      button.color = "white";
      button.cornerRadius = 5;
      button.background = "rgba(50, 50, 50, 0.8)";
      button.paddingBottom = "10px";
      button.hoverCursor = "pointer";
      button.thickness = 1;

      button.onPointerEnterObservable.add(() => {
          button.background = "rgba(100, 100, 100, 0.9)";
      });
      button.onPointerOutObservable.add(() => {
          button.background = "rgba(50, 50, 50, 0.8)";
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
      this.levelText.text = `Level: ${player.experience.level}`;
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
      slot.color = "gray";
      slot.thickness = 1;
      slot.background = "rgba(255, 255, 255, 0.1)";
      slot.isPointerBlocker = true;
      slot.hoverCursor = "pointer";

      // Metadata for drag-and-drop
      (slot as any).itemIndex = index;
      (slot as any).itemData = item;

      slot.onPointerEnterObservable.add(() => {
          this.inventoryDescription.text = `${item.name}\n${item.description}\nQty: ${item.quantity}`;
          slot.background = "rgba(255, 255, 255, 0.3)";
      });
      slot.onPointerOutObservable.add(() => {
          this.inventoryDescription.text = "";
          slot.background = "rgba(255, 255, 255, 0.1)";
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
      text.color = "white";
      text.fontSize = 12;
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
          equipPanel.color = "white";
          equipPanel.thickness = 1;
          equipPanel.background = "rgba(0,0,0,0.5)";
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
          slotRect.color = "white";
          slotRect.thickness = 1;
          slotRect.background = item ? "rgba(0, 200, 0, 0.2)" : "rgba(100, 100, 100, 0.3)";
          slotRect.isPointerBlocker = true;
          slotRect.hoverCursor = "pointer";

          // Metadata
          (slotRect as any).slotName = slot;
          (slotRect as any).item = item;

          // Click to unequip
          slotRect.onPointerUpObservable.add(() => {
              if (item) {
                  const callbacks = (this as any)._equipCallbacks;
                  callbacks?.onUnequip?.(slot);
              }
          });

          const slotLabel = new TextBlock();
          slotLabel.text = item ? item.name : slot.toUpperCase();
          slotLabel.color = "white";
          slotLabel.fontSize = 11;
          slotLabel.textWrapping = true;
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

    // Interaction Label (Center)
    this.interactionLabel = new TextBlock();
    this.interactionLabel.text = "";
    this.interactionLabel.color = "white";
    this.interactionLabel.fontSize = 20;
    this.interactionLabel.top = "50px"; // Slightly below center
    this.interactionLabel.shadowColor = "black";
    this.interactionLabel.shadowBlur = 2;
    this._ui.addControl(this.interactionLabel);

    // Crosshair (Center)
    this.crosshair = new Ellipse();
    this.crosshair.width = "10px";
    this.crosshair.height = "10px";
    this.crosshair.color = "white";
    this.crosshair.thickness = 2;
    this.crosshair.background = "rgba(255, 255, 255, 0.5)";
    this._ui.addControl(this.crosshair);

    // Compass Bar (Top Center)
    const compassContainer = new Rectangle();
    compassContainer.width = "400px";
    compassContainer.height = "30px";
    compassContainer.cornerRadius = 5;
    compassContainer.color = "white";
    compassContainer.thickness = 2;
    compassContainer.background = "rgba(0, 0, 0, 0.5)";
    compassContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    compassContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    compassContainer.top = "20px";
    this._ui.addControl(compassContainer);

    const compassLabel = new TextBlock();
    compassLabel.text = "N -- E -- S -- W"; // Placeholder for compass directions
    compassLabel.color = "white";
    compassLabel.fontSize = 20;
    compassContainer.addControl(compassLabel);

    // Level and XP Display (Top Right)
    const levelContainer = new Rectangle();
    levelContainer.width = "150px";
    levelContainer.height = "70px";
    levelContainer.cornerRadius = 5;
    levelContainer.color = "white";
    levelContainer.thickness = 2;
    levelContainer.background = "rgba(0, 0, 0, 0.5)";
    levelContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    levelContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    levelContainer.top = "20px";
    levelContainer.left = "-20px";
    this._ui.addControl(levelContainer);

    // Level text
    this.levelText = new TextBlock();
    this.levelText.text = "Level: 1";
    this.levelText.color = "gold";
    this.levelText.fontSize = 16;
    this.levelText.fontWeight = "bold";
    this.levelText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.levelText.paddingTop = "5px";
    levelContainer.addControl(this.levelText);

    // XP Bar container
    const xpContainer = new Rectangle();
    xpContainer.width = "130px";
    xpContainer.height = "12px";
    xpContainer.cornerRadius = 2;
    xpContainer.color = "white";
    xpContainer.thickness = 1;
    xpContainer.background = "black";
    xpContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    xpContainer.top = "-8px";
    levelContainer.addControl(xpContainer);

    // XP progress bar
    this.xpBar = new Rectangle();
    this.xpBar.width = "100%";
    this.xpBar.height = "100%";
    this.xpBar.cornerRadius = 2;
    this.xpBar.color = "blue";
    this.xpBar.thickness = 0;
    this.xpBar.background = "blue";
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
    const magickaContainer = this._createBarContainer("blue", barsPanel);
    magickaContainer.paddingRight = "10px";
    this.magickaBar = (magickaContainer.children[0] as Rectangle);

    // Health Bar (Red)
    const healthContainer = this._createBarContainer("red", barsPanel);
    healthContainer.paddingLeft = "5px";
    healthContainer.paddingRight = "5px";
    this.healthBar = (healthContainer.children[0] as Rectangle);

    // Stamina Bar (Green)
    const staminaContainer = this._createBarContainer("green", barsPanel);
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
      rect.cornerRadius = 5;
      rect.color = "white";
      rect.thickness = 1;
      rect.background = "rgba(0, 0, 0, 0.7)";
      rect.paddingBottom = "5px";

      const label = new TextBlock();
      label.text = text;
      label.color = "white";
      label.fontSize = 16;
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
