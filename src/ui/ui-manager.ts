import { Scene } from "@babylonjs/core/scene";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui/2D";

export class UIManager {
  public scene: Scene;
  private _ui: AdvancedDynamicTexture;

  // Bars
  public healthBar: Rectangle;
  public magickaBar: Rectangle;
  public staminaBar: Rectangle;

  constructor(scene: Scene) {
    this.scene = scene;
    this._initUI();
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
}
