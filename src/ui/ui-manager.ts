import { Scene } from "@babylonjs/core/scene";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock, Grid, Button, Ellipse } from "@babylonjs/gui/2D";
import { Item } from "../systems/inventory-system";
import { Quest } from "../systems/quest-system";
import { EquipSlot } from "../systems/equipment-system";
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
  public equipmentText: TextBlock;

  // Equipped item IDs (used when rendering the inventory grid)
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
  public crosshair: Ellipse;

  // Quest Log
  public questLogPanel: Rectangle;
  public questLogContent: StackPanel;

  // Notifications
  public notificationPanel: StackPanel;

  constructor(scene: Scene) {
    this.scene = scene;
    this._initUI();
    this._initInventoryUI();
    this._initPauseMenu();
    this._initQuestLogUI();
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
    descContainer.height = "150px";
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
    statsContainer.height = "150px";
    statsContainer.color = "white";
    statsContainer.thickness = 1;
    statsContainer.background = "rgba(0,0,0,0.5)";
    statsContainer.top = "10px";
    rightPanel.addControl(statsContainer);

    this.statsText = new TextBlock();
    this.statsText.text = "Stats:\nHP: --\nMP: --\nSP: --";
    this.statsText.color = "white";
    this.statsText.fontSize = 14;
    this.statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.statsText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.statsText.paddingTop = "8px";
    this.statsText.paddingLeft = "10px";
    statsContainer.addControl(this.statsText);

    // Equipment Slots Area
    const equipContainer = new Rectangle();
    equipContainer.width = "100%";
    equipContainer.height = "185px";
    equipContainer.color = "white";
    equipContainer.thickness = 1;
    equipContainer.background = "rgba(0,0,0,0.5)";
    equipContainer.top = "20px";
    rightPanel.addControl(equipContainer);

    this.equipmentText = new TextBlock();
    this.equipmentText.text = "Equipment:\nMain Hand: --\nOff Hand: --\nHead: --\nChest: --\nLegs: --\nFeet: --";
    this.equipmentText.color = "#FFD700";
    this.equipmentText.fontSize = 13;
    this.equipmentText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.equipmentText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.equipmentText.paddingTop = "8px";
    this.equipmentText.paddingLeft = "10px";
    equipContainer.addControl(this.equipmentText);
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

  private _initQuestLogUI(): void {
    this.questLogPanel = new Rectangle();
    this.questLogPanel.width = "360px";
    this.questLogPanel.height = "500px";
    this.questLogPanel.cornerRadius = 10;
    this.questLogPanel.color = "white";
    this.questLogPanel.thickness = 2;
    this.questLogPanel.background = "rgba(0, 0, 0, 0.88)";
    this.questLogPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.questLogPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.questLogPanel.left = "20px";
    this.questLogPanel.isVisible = false;
    this._ui.addControl(this.questLogPanel);

    const title = new TextBlock();
    title.text = "Quest Log  [J]";
    title.color = "#FFD700";
    title.fontSize = 20;
    title.height = "36px";
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.top = "8px";
    this.questLogPanel.addControl(title);

    this.questLogContent = new StackPanel();
    this.questLogContent.width = "340px";
    this.questLogContent.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.questLogContent.top = "50px";
    this.questLogContent.isVertical = true;
    this.questLogPanel.addControl(this.questLogContent);
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

  public toggleQuestLog(visible: boolean): void {
      this.questLogPanel.isVisible = visible;
      if (visible) this.questLogPanel.bringToFront();
  }

  public updateQuestLog(quests: Quest[]): void {
      while (this.questLogContent.children.length > 0) {
          this.questLogContent.children[0].dispose();
      }

      const active = quests.filter(q => q.isActive && !q.isCompleted);
      const done   = quests.filter(q => q.isCompleted);

      const addEntry = (quest: Quest): void => {
          const header = new TextBlock();
          header.text = (quest.isCompleted ? "✓ " : "● ") + quest.name;
          header.color = quest.isCompleted ? "#aaaaaa" : "#FFD700";
          header.fontSize = 14;
          header.fontWeight = "bold";
          header.height = "24px";
          header.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
          header.paddingLeft = "10px";
          header.paddingTop = "6px";
          this.questLogContent.addControl(header);

          for (const obj of quest.objectives) {
              const objText = new TextBlock();
              const check = obj.completed ? "[x]" : "[ ]";
              objText.text = `  ${check} ${obj.description} (${obj.current}/${obj.required})`;
              objText.color = obj.completed ? "#666666" : "white";
              objText.fontSize = 12;
              objText.height = "20px";
              objText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
              objText.paddingLeft = "10px";
              this.questLogContent.addControl(objText);
          }

          if (quest.reward) {
              const rewardText = new TextBlock();
              rewardText.text = `  Reward: ${quest.reward}`;
              rewardText.color = "#88cc88";
              rewardText.fontSize = 11;
              rewardText.height = "18px";
              rewardText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
              rewardText.paddingLeft = "10px";
              this.questLogContent.addControl(rewardText);
          }
      };

      for (const q of active) addEntry(q);
      for (const q of done)   addEntry(q);

      if (active.length === 0 && done.length === 0) {
          const empty = new TextBlock();
          empty.text = "No quests yet.";
          empty.color = "#888888";
          empty.fontSize = 13;
          empty.height = "30px";
          empty.paddingLeft = "10px";
          this.questLogContent.addControl(empty);
      }
  }



  public toggleCrosshair(visible: boolean): void {
      this.crosshair.isVisible = visible;
  }

  public setCrosshairActive(active: boolean): void {
    if (active) {
        if (this.crosshair.color !== "#FFD700") {
            this.crosshair.color = "#FFD700"; // Gold
            this.crosshair.scaleX = 1.2;
            this.crosshair.scaleY = 1.2;
            this.crosshair.thickness = 3;
        }
    } else {
        if (this.crosshair.color !== "white") {
            this.crosshair.color = "white";
            this.crosshair.scaleX = 1.0;
            this.crosshair.scaleY = 1.0;
            this.crosshair.thickness = 2;
        }
    }
  }

  public updateStats(player: Player): void {
      this.statsText.text = `Stats:
HP: ${Math.floor(player.health)} / ${player.maxHealth}
MP: ${Math.floor(player.magicka)} / ${player.maxMagicka}
SP: ${Math.floor(player.stamina)} / ${player.maxStamina}
DMG Bonus: +${player.bonusDamage}
Armor: ${player.bonusArmor}`;
  }

  public setEquippedIds(ids: Set<string>): void {
      this._equippedIds = ids;
  }

  public updateInventory(items: Item[]): void {
      while (this.inventoryGrid.children.length > 0) {
          this.inventoryGrid.children[0].dispose();
      }

      items.forEach((item, index) => {
          if (index >= 20) return; // Limit to grid size

          const row = Math.floor(index / 4);
          const col = index % 4;
          const isEquipped = this._equippedIds.has(item.id);

          const slot = new Rectangle();
          slot.width = "80px";
          slot.height = "80px";
          slot.color = isEquipped ? "#FFD700" : "gray";
          slot.thickness = isEquipped ? 2 : 1;
          slot.background = isEquipped ? "rgba(255, 215, 0, 0.15)" : "rgba(255, 255, 255, 0.1)";
          slot.isPointerBlocker = true;
          slot.hoverCursor = "pointer";

          const baseColor = isEquipped ? "rgba(255, 215, 0, 0.15)" : "rgba(255, 255, 255, 0.1)";
          const hoverColor = isEquipped ? "rgba(255, 215, 0, 0.35)" : "rgba(255, 255, 255, 0.3)";

          // Hover events
          slot.onPointerEnterObservable.add(() => {
              const equipped = this._equippedIds.has(item.id);
              const hint = item.slot ? (equipped ? "\n[Click to Unequip]" : "\n[Click to Equip]") : "";
              this.inventoryDescription.text = `${item.name}\n${item.description}\nQty: ${item.quantity}${hint}`;
              slot.background = hoverColor;
          });
          slot.onPointerOutObservable.add(() => {
              this.inventoryDescription.text = "";
              slot.background = baseColor;
          });

          // Click to equip/unequip
          if (item.slot) {
              slot.onPointerUpObservable.add(() => {
                  if (this.onInventoryItemClick) {
                      this.onInventoryItemClick(item);
                  }
              });
          }

          const text = new TextBlock();
          text.text = item.name + (item.quantity > 1 ? ` (${item.quantity})` : "");
          text.color = isEquipped ? "#FFD700" : "white";
          text.fontSize = 12;
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
    const screenPos = Vector3.Project(worldPos, Matrix.Identity(), scene.getTransformMatrix(), viewport);
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
