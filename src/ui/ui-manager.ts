import { Scene } from "@babylonjs/core/scene";
import { AdvancedDynamicTexture, Control, Grid, Rectangle, StackPanel, TextBlock, Button, Ellipse } from "@babylonjs/gui/2D";
import { Item } from "../systems/inventory-system";

export class UIManager {
  public scene: Scene;
  private _ui: AdvancedDynamicTexture;

  // Bars
  public healthBar: Rectangle;
  public magickaBar: Rectangle;
  public staminaBar: Rectangle;

  // Interaction
  public interactionLabel: TextBlock;

  // Inventory
  public inventoryPanel: Rectangle;
  public inventoryGrid: Grid;

  // Callback for item use
  public onUseItem: (item: Item) => void;

  constructor(scene: Scene) {
    this.scene = scene;
    this._initUI();
    this._initInteractionUI();
    this._initInventoryUI();
  }

  private _initUI(): void {
    this._ui = AdvancedDynamicTexture.CreateFullscreenUI("UI");

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

  private _initInteractionUI(): void {
      // Crosshair
      const crosshair = new Ellipse();
      crosshair.width = "4px";
      crosshair.height = "4px";
      crosshair.color = "white";
      crosshair.background = "white";
      crosshair.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      crosshair.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      this._ui.addControl(crosshair);

      // Label
      this.interactionLabel = new TextBlock();
      this.interactionLabel.text = "";
      this.interactionLabel.color = "white";
      this.interactionLabel.fontSize = 18;
      this.interactionLabel.top = "30px";
      this.interactionLabel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      this.interactionLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      this._ui.addControl(this.interactionLabel);
  }

  private _initInventoryUI(): void {
    // Inventory Panel (Center)
    this.inventoryPanel = new Rectangle();
    this.inventoryPanel.width = "400px";
    this.inventoryPanel.height = "500px";
    this.inventoryPanel.cornerRadius = 10;
    this.inventoryPanel.color = "white";
    this.inventoryPanel.thickness = 2;
    this.inventoryPanel.background = "rgba(0, 0, 0, 0.9)";
    this.inventoryPanel.isVisible = false;
    this._ui.addControl(this.inventoryPanel);

    // Title
    const title = new TextBlock();
    title.text = "Inventory";
    title.color = "white";
    title.fontSize = 24;
    title.height = "50px";
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.inventoryPanel.addControl(title);

    // Grid for items
    this.inventoryGrid = new Grid();
    this.inventoryGrid.width = "360px";
    this.inventoryGrid.height = "400px";
    this.inventoryGrid.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.inventoryGrid.paddingBottom = "20px";
    // 4 columns, 5 rows
    for (let i = 0; i < 4; i++) {
        this.inventoryGrid.addColumnDefinition(1);
    }
    for (let i = 0; i < 5; i++) {
        this.inventoryGrid.addRowDefinition(1);
    }
    this.inventoryPanel.addControl(this.inventoryGrid);
  }

  public toggleInventory(): void {
    this.inventoryPanel.isVisible = !this.inventoryPanel.isVisible;

    // We can't easily access Player here without dependency injection or global access.
    // However, Game has 'ui'.
    // A quick hack is to find the player camera and detach/attach.
    const camera = this.scene.getCameraByName("playerCam");

    if (this.inventoryPanel.isVisible) {
        document.exitPointerLock();
        if (camera) camera.detachControl();
    } else {
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) {
            canvas.requestPointerLock();
            if (camera) camera.attachControl(canvas, true);
        }
    }
  }

  public updateInventory(items: Item[]): void {
      this.inventoryGrid.children.forEach(c => c.dispose()); // Clear old items (inefficient but simple)

      // Limit to grid size (20)
      const displayItems = items.slice(0, 20);

      displayItems.forEach((item, index) => {

          const row = Math.floor(index / 4);
          const col = index % 4;

          const btn = Button.CreateSimpleButton(`btn_${item.id}`, item.name.substring(0, 2));
          btn.width = "80px";
          btn.height = "80px";
          btn.color = "white";
          btn.background = item.color;
          btn.cornerRadius = 5;
          btn.fontSize = 20;

          // Tooltip logic (simple text on hover)
          // For now, just display name
          const text = new TextBlock();
          text.text = item.name;
          text.fontSize = 12;
          text.color = "black";
          text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
          btn.addControl(text);

          btn.onPointerUpObservable.add(() => {
              if (this.onUseItem) {
                  this.onUseItem(item);
                  // Refresh UI? Ideally Game or System calls updateInventory again
                  // We can remove the button here but better to re-render
              }
          });

          this.inventoryGrid.addControl(btn, row, col);
      });
  }
}
