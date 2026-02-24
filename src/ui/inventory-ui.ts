import { Scene } from "@babylonjs/core/scene";
import { AdvancedDynamicTexture, Button, Control, Rectangle, ScrollViewer, StackPanel, TextBlock } from "@babylonjs/gui/2D";
import { Item } from "../entities/item";
import { InventorySystem } from "../systems/inventory-system";

export class InventoryUI {
    private _ui: AdvancedDynamicTexture;
    private _mainPanel: Rectangle;
    private _listPanel: StackPanel;
    private _isVisible: boolean = false;
    private _scene: Scene;
    private _inventorySystem: InventorySystem;

    constructor(scene: Scene, inventorySystem: InventorySystem) {
        this._scene = scene;
        this._inventorySystem = inventorySystem;
        this._ui = AdvancedDynamicTexture.CreateFullscreenUI("InventoryUI");
        this._createUI();
    }

    private _createUI(): void {
        this._mainPanel = new Rectangle();
        this._mainPanel.width = "400px";
        this._mainPanel.height = "600px";
        this._mainPanel.background = "rgba(0, 0, 0, 0.9)";
        this._mainPanel.color = "white";
        this._mainPanel.thickness = 2;
        this._mainPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this._mainPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this._mainPanel.paddingRight = "50px";
        this._mainPanel.isVisible = false;
        this._ui.addControl(this._mainPanel);

        const title = new TextBlock();
        title.text = "INVENTORY";
        title.height = "50px";
        title.fontSize = 24;
        title.color = "white";
        title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this._mainPanel.addControl(title);

        const scrollViewer = new ScrollViewer();
        scrollViewer.width = 1;
        scrollViewer.height = "530px";
        scrollViewer.top = "60px";
        scrollViewer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this._mainPanel.addControl(scrollViewer);

        this._listPanel = new StackPanel();
        this._listPanel.width = "100%";
        scrollViewer.addControl(this._listPanel);
    }

    public toggle(): void {
        this._isVisible = !this._isVisible;
        this._mainPanel.isVisible = this._isVisible;

        if (this._isVisible) {
            this.update();
        }
    }

    public update(): void {
        this._listPanel.clearControls();

        for (const item of this._inventorySystem.items) {
            const btn = Button.CreateSimpleButton("itemBtn", `${item.name} (${item.weight} kg)`);
            btn.height = "40px";
            btn.color = "white";
            btn.background = "transparent";
            btn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            this._listPanel.addControl(btn);
        }
    }
}
