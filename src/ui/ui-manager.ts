import { Scene } from "@babylonjs/core/scene";
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

  // Character Menu (Inventory + Stats)
  public characterMenuPanel: Rectangle;
  public inventoryGrid: Grid;
  public inventoryDescription: TextBlock;
  public statsText: TextBlock;

  private _itemsView: Grid;
  private _statsView: Rectangle;

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
    this._initCharacterMenu();
    this._initPauseMenu();
    this._initNotificationUI();
  }

  private _initNotificationUI(): void {
      this.notificationPanel = new StackPanel();
      this.notificationPanel.width = "300px";
      this.notificationPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      this.notificationPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      this.notificationPanel.top = "20px";
      this.notificationPanel.left = "20px";
      this.notificationPanel.isVertical = true;
      this._ui.addControl(this.notificationPanel);
  }

  public addNotification(text: string): void {
      const block = new TextBlock();
      block.text = text;
      block.color = "white";
      block.fontSize = 18;
      block.height = "30px";
      block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      block.shadowBlur = 2;
      block.shadowColor = "black";

      this.notificationPanel.addControl(block);

      let lifeTime = 3000;
      const fadeTime = 1000;
      let currentAlpha = 1.0;

      const obs = this.scene.onBeforeRenderObservable.add((_, state) => {
          const dt = this.scene.getEngine().getDeltaTime();
          lifeTime -= dt;

          if (lifeTime <= 0) {
              currentAlpha -= (dt / fadeTime);
              block.alpha = currentAlpha;

              if (currentAlpha <= 0) {
                  this.scene.onBeforeRenderObservable.remove(obs);
                  this.notificationPanel.removeControl(block);
                  block.dispose();
              }
          }
      });
  }

  private _initCharacterMenu(): void {
    // Full screen semi-transparent background
    this.characterMenuPanel = new Rectangle();
    this.characterMenuPanel.width = "800px";
    this.characterMenuPanel.height = "600px";
    this.characterMenuPanel.cornerRadius = 10;
    this.characterMenuPanel.color = "white";
    this.characterMenuPanel.thickness = 2;
    this.characterMenuPanel.background = "rgba(20, 20, 20, 0.95)";
    this.characterMenuPanel.isVisible = false;
    this._ui.addControl(this.characterMenuPanel);

    // Header (Tabs)
    const header = new StackPanel();
    header.isVertical = false;
    header.height = "50px";
    header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    header.paddingTop = "10px";
    this.characterMenuPanel.addControl(header);

    const itemsTab = this._createTabButton("ITEMS", header, () => this._switchTab("items"));
    const statsTab = this._createTabButton("STATS", header, () => this._switchTab("stats"));
    // const magicTab = this._createTabButton("MAGIC", header, () => console.log("Magic Tab"));

    // Content Container
    const content = new Rectangle();
    content.width = "760px";
    content.height = "520px";
    content.top = "60px";
    content.thickness = 0;
    content.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.characterMenuPanel.addControl(content);

    // -- Items View --
    this._itemsView = new Grid();
    this._itemsView.width = "100%";
    this._itemsView.height = "100%";
    this._itemsView.addColumnDefinition(0.6); // Grid
    this._itemsView.addColumnDefinition(0.4); // Desc
    content.addControl(this._itemsView);

    this.inventoryGrid = new Grid();
    this.inventoryGrid.width = "100%";
    this.inventoryGrid.height = "100%";
    for (let i = 0; i < 6; i++) this.inventoryGrid.addRowDefinition(1);
    for (let i = 0; i < 4; i++) this.inventoryGrid.addColumnDefinition(1);
    this._itemsView.addControl(this.inventoryGrid, 0, 0);

    const descPanel = new Rectangle();
    descPanel.thickness = 1;
    descPanel.color = "gray";
    descPanel.background = "rgba(0,0,0,0.3)";
    descPanel.paddingLeft = "10px";
    this._itemsView.addControl(descPanel, 0, 1);

    this.inventoryDescription = new TextBlock();
    this.inventoryDescription.text = "Select an item";
    this.inventoryDescription.color = "white";
    this.inventoryDescription.textWrapping = true;
    this.inventoryDescription.fontSize = 16;
    descPanel.addControl(this.inventoryDescription);

    // -- Stats View --
    this._statsView = new Rectangle();
    this._statsView.width = "100%";
    this._statsView.height = "100%";
    this._statsView.thickness = 0;
    this._statsView.isVisible = false;
    content.addControl(this._statsView);

    this.statsText = new TextBlock();
    this.statsText.text = "Stats Loading...";
    this.statsText.color = "white";
    this.statsText.fontSize = 24;
    this.statsText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.statsText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.statsText.paddingTop = "20px";
    this.statsText.paddingLeft = "20px";
    this._statsView.addControl(this.statsText);
  }

  private _createTabButton(text: string, parent: StackPanel, onClick: () => void): Button {
      const btn = Button.CreateSimpleButton("tab_" + text, text);
      btn.width = "150px";
      btn.height = "40px";
      btn.color = "white";
      btn.background = "transparent";
      btn.thickness = 0;
      btn.fontSize = 20;
      btn.hoverCursor = "pointer";

      // Underline or highlight on hover
      btn.onPointerEnterObservable.add(() => btn.color = "yellow");
      btn.onPointerOutObservable.add(() => btn.color = "white");
      btn.onPointerUpObservable.add(onClick);

      parent.addControl(btn);
      return btn;
  }

  private _switchTab(tab: "items" | "stats"): void {
      if (tab === "items") {
          this._itemsView.isVisible = true;
          this._statsView.isVisible = false;
      } else {
          this._itemsView.isVisible = false;
          this._statsView.isVisible = true;
      }
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

  public toggleCharacterMenu(visible: boolean): void {
      this.characterMenuPanel.isVisible = visible;
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
      this.statsText.text =
`LEVEL 1

Health:   ${Math.floor(player.health)} / ${player.maxHealth}
Magicka:  ${Math.floor(player.magicka)} / ${player.maxMagicka}
Stamina:  ${Math.floor(player.stamina)} / ${player.maxStamina}

Regen Rates:
HP: ${player.healthRegen}/s
MP: ${player.magickaRegen}/s
SP: ${player.staminaRegen}/s`;
  }

  public updateInventory(items: Item[]): void {
      while (this.inventoryGrid.children.length > 0) {
          this.inventoryGrid.children[0].dispose();
      }

      items.forEach((item, index) => {
          if (index >= 24) return; // Limit to grid size (6x4)

          const row = Math.floor(index / 4);
          const col = index % 4;

          const slot = new Rectangle();
          slot.width = "80px";
          slot.height = "80px";
          slot.color = "gray";
          slot.thickness = 1;
          slot.background = "rgba(255, 255, 255, 0.1)";
          slot.isPointerBlocker = true;
          slot.hoverCursor = "pointer";

          // Hover events
          slot.onPointerEnterObservable.add(() => {
              this.inventoryDescription.text = `${item.name}\n\n${item.description}\n\nQuantity: ${item.quantity}`;
              if (item.stats) {
                  this.inventoryDescription.text += `\n\nStats: ${JSON.stringify(item.stats)}`;
              }
              slot.background = "rgba(255, 255, 255, 0.3)";
          });
          slot.onPointerOutObservable.add(() => {
              // Keep description or clear? Skyrim keeps last selected.
              // this.inventoryDescription.text = "";
              slot.background = "rgba(255, 255, 255, 0.1)";
          });

          const text = new TextBlock();
          text.text = item.name + (item.quantity > 1 ? ` (${item.quantity})` : "");
          text.color = "white";
          text.fontSize = 12;
          text.textWrapping = true;
          slot.addControl(text);

          this.inventoryGrid.addControl(slot, row, col);
      });
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
    const barsPanel = new StackPanel();
    barsPanel.isVertical = false;
    barsPanel.height = "30px";
    barsPanel.width = "600px";
    barsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    barsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    barsPanel.top = "-20px";
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
}
