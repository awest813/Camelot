import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  Button,
  ScrollViewer,
} from "@babylonjs/gui/2D";
import type { AlchemySystem } from "../systems/alchemy-system";
import { ALCHEMY_EFFECTS } from "../systems/alchemy-system";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  PANEL_BG:     "rgba(6, 4, 2, 0.95)",
  PANEL_BORDER: "#6B4F12",
  TITLE:        "#D4A017",
  TEXT:         "#EEE0C0",
  DIM:          "#998877",
  GOOD:         "#5EC45E",
  WARN:         "#D47A17",
  BTN_BG:       "rgba(28, 20, 6, 0.95)",
  BTN_HOVER:    "rgba(80, 56, 10, 0.98)",
  SEL_BG:       "rgba(80, 56, 10, 0.80)",
  SEL_BORDER:   "#D4A017",
  CRAFT_BG:     "rgba(8, 40, 8, 0.95)",
  CRAFT_HOVER:  "rgba(16, 80, 16, 0.98)",
  DRINK_BG:     "rgba(8, 30, 50, 0.95)",
  DRINK_HOVER:  "rgba(16, 60, 100, 0.98)",
};

/**
 * Alchemy workbench UI.
 *
 * Layout:
 *  ┌────────────────────────────────────────────────────┐
 *  │  Alchemy — Mortar & Pestle           [Skill: 15]   │
 *  ├──────────────────────┬─────────────────────────────┤
 *  │  Ingredients         │  Crafted Potions             │
 *  │  [scroll list]       │  [scroll list]               │
 *  │                      │                              │
 *  ├──────────────────────┴─────────────────────────────┤
 *  │  Selected: [ingredient chips]                       │
 *  │  [Craft Potion]   [Clear]                           │
 *  └────────────────────────────────────────────────────┘
 *
 * Open/close with `toggle()`. Connect to AlchemySystem via the constructor.
 */
export class AlchemyUI {
  /** Fired when the user presses Craft — passes selected ingredient ids. */
  public onCraft: ((ingredientIds: string[]) => void) | null = null;
  /** Fired when the user clicks Drink on a crafted potion — passes potion id. */
  public onDrink: ((potionId: string) => void) | null = null;

  private readonly _ui: AdvancedDynamicTexture;
  private readonly _system: AlchemySystem;
  private readonly _panel: Rectangle;
  private readonly _titleSkill: TextBlock;
  private readonly _ingredientStack: StackPanel;
  private readonly _potionStack: StackPanel;
  private readonly _selectionLabel: TextBlock;
  private readonly _craftBtn: Button;

  private _selectedIngredientIds: string[] = [];
  public isVisible: boolean = false;

  constructor(ui: AdvancedDynamicTexture, system: AlchemySystem) {
    this._ui     = ui;
    this._system = system;

    // ── Outer panel ───────────────────────────────────────────────────────────
    this._panel = new Rectangle("alchemyPanel");
    this._panel.width  = "700px";
    this._panel.height = "560px";
    this._panel.cornerRadius = 8;
    this._panel.color       = T.PANEL_BORDER;
    this._panel.thickness   = 2;
    this._panel.background  = T.PANEL_BG;
    this._panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this._panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_CENTER;
    this._panel.isVisible = false;
    this._ui.addControl(this._panel);

    // ── Title bar ─────────────────────────────────────────────────────────────
    const titleBar = new Rectangle("alchTitleBar");
    titleBar.width     = "100%";
    titleBar.height    = "38px";
    titleBar.thickness = 0;
    titleBar.background = "rgba(20, 14, 4, 0.9)";
    titleBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._panel.addControl(titleBar);

    const titleText = new TextBlock("alchTitle", "Alchemy — Mortar & Pestle");
    titleText.color    = T.TITLE;
    titleText.fontSize = 16;
    titleText.fontStyle = "bold";
    titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleText.left = "14px";
    titleBar.addControl(titleText);

    this._titleSkill = new TextBlock("alchSkill", "");
    this._titleSkill.color    = T.DIM;
    this._titleSkill.fontSize = 13;
    this._titleSkill.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this._titleSkill.left = "-14px";
    titleBar.addControl(this._titleSkill);

    // ── Main grid: ingredients (left) | potions (right) ──────────────────────
    const bodyStack = new StackPanel("alchBody");
    bodyStack.isVertical = false;
    bodyStack.width  = "100%";
    bodyStack.height = "390px";
    bodyStack.top    = "46px";
    bodyStack.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._panel.addControl(bodyStack);

    // Left column — ingredients
    const leftCol = new Rectangle("alchLeft");
    leftCol.width     = "50%";
    leftCol.height    = "100%";
    leftCol.thickness = 0;
    leftCol.background = "transparent";
    bodyStack.addControl(leftCol);

    const leftTitle = new TextBlock("alchIngTitle", "Ingredients");
    leftTitle.color    = T.DIM;
    leftTitle.fontSize = 12;
    leftTitle.height   = "22px";
    leftTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    leftTitle.left     = "10px";
    leftTitle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    leftCol.addControl(leftTitle);

    const ingScroll = new ScrollViewer("alchIngScroll");
    ingScroll.width   = "calc(100% - 10px)";
    ingScroll.height  = "calc(100% - 26px)";
    ingScroll.top     = "24px";
    ingScroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    ingScroll.thickness = 1;
    ingScroll.color   = T.PANEL_BORDER;
    ingScroll.background = "rgba(10, 8, 4, 0.6)";
    leftCol.addControl(ingScroll);

    this._ingredientStack = new StackPanel("alchIngStack");
    this._ingredientStack.width     = "100%";
    this._ingredientStack.isVertical = true;
    this._ingredientStack.paddingTop = "4px";
    ingScroll.addControl(this._ingredientStack);

    // Right column — crafted potions
    const rightCol = new Rectangle("alchRight");
    rightCol.width     = "50%";
    rightCol.height    = "100%";
    rightCol.thickness = 0;
    rightCol.background = "transparent";
    bodyStack.addControl(rightCol);

    const rightTitle = new TextBlock("alchPotTitle", "Crafted Potions");
    rightTitle.color    = T.DIM;
    rightTitle.fontSize = 12;
    rightTitle.height   = "22px";
    rightTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    rightTitle.left     = "10px";
    rightTitle.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    rightCol.addControl(rightTitle);

    const potScroll = new ScrollViewer("alchPotScroll");
    potScroll.width   = "calc(100% - 10px)";
    potScroll.height  = "calc(100% - 26px)";
    potScroll.top     = "24px";
    potScroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    potScroll.thickness = 1;
    potScroll.color   = T.PANEL_BORDER;
    potScroll.background = "rgba(10, 8, 4, 0.6)";
    rightCol.addControl(potScroll);

    this._potionStack = new StackPanel("alchPotStack");
    this._potionStack.width      = "100%";
    this._potionStack.isVertical = true;
    this._potionStack.paddingTop = "4px";
    potScroll.addControl(this._potionStack);

    // ── Selection row ─────────────────────────────────────────────────────────
    const selRow = new Rectangle("alchSelRow");
    selRow.width     = "100%";
    selRow.height    = "60px";
    selRow.top       = "-76px";
    selRow.thickness = 0;
    selRow.background = "rgba(12, 8, 4, 0.8)";
    selRow.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._panel.addControl(selRow);

    this._selectionLabel = new TextBlock("alchSelLabel", "Select 2–4 ingredients");
    this._selectionLabel.color    = T.DIM;
    this._selectionLabel.fontSize = 13;
    this._selectionLabel.height   = "28px";
    this._selectionLabel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
    this._selectionLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._selectionLabel.left     = "14px";
    this._selectionLabel.top      = "4px";
    selRow.addControl(this._selectionLabel);

    // Craft & Clear buttons
    this._craftBtn = this._makeBtn("alchCraft", "Craft Potion", T.CRAFT_BG, T.CRAFT_HOVER);
    this._craftBtn.width  = "140px";
    this._craftBtn.height = "28px";
    this._craftBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._craftBtn.verticalAlignment   = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._craftBtn.left   = "14px";
    this._craftBtn.top    = "-4px";
    this._craftBtn.onPointerClickObservable.add(() => this._handleCraft());
    selRow.addControl(this._craftBtn);

    const clearBtn = this._makeBtn("alchClear", "Clear", T.BTN_BG, T.BTN_HOVER);
    clearBtn.width  = "80px";
    clearBtn.height = "28px";
    clearBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    clearBtn.verticalAlignment   = Control.VERTICAL_ALIGNMENT_BOTTOM;
    clearBtn.left   = "164px";
    clearBtn.top    = "-4px";
    clearBtn.onPointerClickObservable.add(() => {
      this._selectedIngredientIds = [];
      this._refreshSelectionLabel();
      this._refreshIngredientList();
    });
    selRow.addControl(clearBtn);

    // ── Close button ──────────────────────────────────────────────────────────
    const closeBtn = this._makeBtn("alchClose", "✕", T.BTN_BG, T.BTN_HOVER);
    closeBtn.width  = "32px";
    closeBtn.height = "28px";
    closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.verticalAlignment   = Control.VERTICAL_ALIGNMENT_BOTTOM;
    closeBtn.top    = "-4px";
    closeBtn.left   = "-14px";
    (closeBtn.textBlock as TextBlock).color = T.DIM;
    closeBtn.accessibilityTag = { description: "Close Alchemy Panel" };
    closeBtn.onPointerClickObservable.add(() => this.toggle(false));

    this._panel.addControl(closeBtn);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Open or close the alchemy panel.
   * When opening, refreshes ingredient and potion lists.
   */
  public toggle(visible: boolean): void {
    this.isVisible = visible;
    this._panel.isVisible = visible;
    if (visible) {
      this._selectedIngredientIds = [];
      this._refresh();
    }
  }

  /** Refresh all lists (call after crafting or inventory changes). */
  public refresh(): void {
    if (this.isVisible) this._refresh();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _refresh(): void {
    this._titleSkill.text = `Alchemy Skill: ${this._system.alchemySkill}`;
    this._refreshIngredientList();
    this._refreshPotionList();
    this._refreshSelectionLabel();
  }

  private _refreshIngredientList(): void {
    // Dispose existing children
    while (this._ingredientStack.children.length > 0) {
      this._ingredientStack.children[0].dispose();
    }

    const satchel = this._system.getSatchelContents();
    if (satchel.length === 0) {
      const empty = new TextBlock("alchIngEmpty", "No ingredients");
      empty.color    = T.DIM;
      empty.fontSize = 12;
      empty.height   = "28px";
      this._ingredientStack.addControl(empty);
      return;
    }

    for (const { def, quantity } of satchel) {
      const isSelected = this._selectedIngredientIds.includes(def.id);

      const row = new Rectangle(`ingRow_${def.id}`);
      row.width     = "100%";
      row.height    = "50px";
      row.thickness = 1;
      row.color     = isSelected ? T.SEL_BORDER : T.PANEL_BORDER;
      row.background = isSelected ? T.SEL_BG : "transparent";
      row.paddingTop    = "2px";
      row.paddingBottom = "2px";
      row.isPointerBlocker = true;

      row.isFocusInvisible = false;
      row.tabIndex = 0;

      const nameText = new TextBlock(`ingName_${def.id}`, `${def.name}  ×${quantity}`);
      nameText.color    = isSelected ? T.TITLE : T.TEXT;
      nameText.fontSize = 13;
      nameText.height   = "20px";
      nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      nameText.left     = "10px";
      nameText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      nameText.top      = "6px";
      row.addControl(nameText);

      // Show discovered effects
      const effectNames = def.effects
        .map((eid, idx) =>
          this._system.hasDiscoveredEffect(def.id, idx)
            ? ALCHEMY_EFFECTS[eid].name
            : "???",
        )
        .join(", ");

      const effectText = new TextBlock(`ingEff_${def.id}`, effectNames);
      effectText.color    = T.DIM;
      effectText.fontSize = 11;
      effectText.height   = "18px";
      effectText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      effectText.left     = "10px";
      effectText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      effectText.top      = "26px";
      row.addControl(effectText);

      row.accessibilityTag = { description: `Ingredient: ${def.name}, Effects: ${effectNames}` };

      let isFocused = false;
      row.onFocusObservable.add(() => {
        isFocused = true;
        row.thickness = 2;
      });
      row.onBlurObservable.add(() => {
        isFocused = false;
        row.thickness = 1;
      });

      row.onPointerClickObservable.add(() => this._toggleIngredientSelection(def.id));
      row.onPointerEnterObservable.add(() => {
        if (!this._selectedIngredientIds.includes(def.id)) {
          row.background = "rgba(40, 30, 8, 0.7)";
        }
      });
      row.onPointerOutObservable.add(() => {
        row.background = this._selectedIngredientIds.includes(def.id) ? T.SEL_BG : "transparent";
        if (!isFocused) row.thickness = 1;
      });
      row.onKeyboardEventProcessedObservable.add((evt) => {
        if (evt.type === "keyup" && (evt.key === "Enter" || evt.key === " ")) {
          row.onPointerClickObservable.notifyObservers(null as any);
        }
      });

      this._ingredientStack.addControl(row);
    }
  }

  private _refreshPotionList(): void {
    while (this._potionStack.children.length > 0) {
      this._potionStack.children[0].dispose();
    }

    const potions = this._system.craftedPotions;
    if (potions.length === 0) {
      const empty = new TextBlock("alchPotEmpty", "No potions crafted");
      empty.color    = T.DIM;
      empty.fontSize = 12;
      empty.height   = "28px";
      this._potionStack.addControl(empty);
      return;
    }

    for (const potion of potions) {
      const row = new Rectangle(`potRow_${potion.id}`);
      row.width     = "100%";
      row.height    = "58px";
      row.thickness = 1;
      row.color     = T.PANEL_BORDER;
      row.background = "transparent";
      row.paddingTop    = "2px";
      row.paddingBottom = "2px";

      const nameText = new TextBlock(`potName_${potion.id}`, potion.name);
      nameText.color    = T.TEXT;
      nameText.fontSize = 13;
      nameText.height   = "20px";
      nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      nameText.left     = "10px";
      nameText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      nameText.top      = "4px";
      row.addControl(nameText);

      const effSummary = potion.effects
        .map(e => {
          const eff = ALCHEMY_EFFECTS[e.effectId];
          return eff.baseDuration > 0
            ? `${eff.name} ${e.magnitude} (${e.duration}s)`
            : `${eff.name} ${e.magnitude}`;
        })
        .join(" | ");

      const effText = new TextBlock(`potEff_${potion.id}`, effSummary);
      effText.color    = T.DIM;
      effText.fontSize = 11;
      effText.height   = "16px";
      effText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      effText.left     = "10px";
      effText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      effText.top      = "24px";
      row.addControl(effText);

      const drinkBtn = this._makeBtn(`drinkBtn_${potion.id}`, "Drink", T.DRINK_BG, T.DRINK_HOVER);
      drinkBtn.width  = "58px";
      drinkBtn.height = "22px";
      drinkBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      drinkBtn.verticalAlignment   = Control.VERTICAL_ALIGNMENT_BOTTOM;
      drinkBtn.left   = "-10px";
      drinkBtn.top    = "-4px";
      drinkBtn.onPointerClickObservable.add(() => {
        this.onDrink?.(potion.id);
        this._refresh();
      });
      row.addControl(drinkBtn);

      this._potionStack.addControl(row);
    }
  }

  private _toggleIngredientSelection(id: string): void {
    const idx = this._selectedIngredientIds.indexOf(id);
    if (idx !== -1) {
      this._selectedIngredientIds.splice(idx, 1);
    } else if (this._selectedIngredientIds.length < 4) {
      this._selectedIngredientIds.push(id);
    }
    this._refreshSelectionLabel();
    this._refreshIngredientList();
  }

  private _refreshSelectionLabel(): void {
    const count = this._selectedIngredientIds.length;

    // Update craft button state
    const canCraft = count >= 2;
    this._craftBtn.isEnabled = canCraft;
    this._craftBtn.background = canCraft ? T.CRAFT_BG : T.BTN_BG;
    if (this._craftBtn.textBlock) {
      this._craftBtn.textBlock.color = canCraft ? T.TEXT : T.DIM;
    }
    this._craftBtn.accessibilityTag = {
      description: canCraft ? "Craft Potion" : "Need at least 2 ingredients to craft"
    };

    if (count === 0) {
      this._selectionLabel.text  = "Select 2–4 ingredients to craft";
      this._selectionLabel.color = T.DIM;
      return;
    }

    const names = this._selectedIngredientIds
      .map(id => this._system.getIngredientDef(id)?.name ?? id)
      .join(" + ");

    if (count < 2) {
      this._selectionLabel.text  = `Selected: ${names}  (need at least 2)`;
      this._selectionLabel.color = T.WARN;
    } else {
      this._selectionLabel.text  = `Selected: ${names}`;
      this._selectionLabel.color = T.GOOD;
    }
  }

  private _handleCraft(): void {
    if (this._selectedIngredientIds.length < 2) return;
    this.onCraft?.(this._selectedIngredientIds.slice());
    this._selectedIngredientIds = [];
    this._refresh();
  }

  private _makeBtn(name: string, label: string, bg: string, hover: string): Button {
    const btn = Button.CreateSimpleButton(name, label);
    btn.background    = bg;
    btn.color         = T.TEXT;
    btn.fontSize      = 12;
    btn.cornerRadius  = 4;
    btn.thickness     = 1;
    if (btn.textBlock) btn.textBlock.color = T.TEXT;
    btn.onPointerEnterObservable.add(() => {
      if (btn.isEnabled) btn.background = hover;
    });

    btn.isFocusInvisible = false;
    btn.tabIndex = 0;
    btn.accessibilityTag = { description: label };

    let isFocused = false;
    btn.onFocusObservable.add(() => {
      isFocused = true;
      btn.thickness = 2;
    });
    btn.onBlurObservable.add(() => {
      isFocused = false;
      btn.thickness = 1;
    });
    btn.onPointerOutObservable.add(() => {
      if (btn.isEnabled) btn.background = bg;
      if (!isFocused) btn.thickness = 1;
    });
    btn.onKeyboardEventProcessedObservable.add((evt) => {
      if (evt.type === "keyup" && (evt.key === "Enter" || evt.key === " ")) {
        btn.onPointerClickObservable.notifyObservers(null as any);
      }
    });

    return btn;
  }
}
