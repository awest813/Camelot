import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  Button,
  ScrollViewer,
} from "@babylonjs/gui/2D";
import type { EnchantingSystem, EnchantmentCategory, SoulGemType } from "../systems/enchanting-system";
import { SOUL_GEMS } from "../systems/enchanting-system";
import type { Item } from "../systems/inventory-system";
import { getItemEnchantmentCategory } from "../systems/enchanting-system";

// ── Design tokens (shared palette with AlchemyUI) ─────────────────────────────
const T = {
  PANEL_BG:      "rgba(4, 4, 10, 0.96)",
  PANEL_BORDER:  "#3A2A6B",
  TITLE:         "#A070E0",
  TEXT:          "#DDD0F0",
  DIM:           "#887799",
  GOOD:          "#5EC45E",
  WARN:          "#D47A17",
  BTN_BG:        "rgba(16, 10, 30, 0.95)",
  BTN_HOVER:     "rgba(60, 30, 100, 0.98)",
  SEL_BG:        "rgba(60, 30, 100, 0.80)",
  SEL_BORDER:    "#A070E0",
  CRAFT_BG:      "rgba(10, 8, 40, 0.95)",
  CRAFT_HOVER:   "rgba(20, 16, 80, 0.98)",
};

/**
 * Enchanting altar UI.
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  Enchanting — Arcane Altar             [Skill: 10]      │
 *  ├─────────────────┬───────────────────┬───────────────────┤
 *  │  Items          │  Effects          │  Soul Gems        │
 *  │  [scroll list]  │  [scroll list]    │  [scroll list]    │
 *  ├─────────────────┴───────────────────┴───────────────────┤
 *  │  Item: —  Effect: —  Soul Gem: —  [Enchant]  [Close]    │
 *  └─────────────────────────────────────────────────────────┘
 *
 * Open/close with `toggle()`.
 * Connect to EnchantingSystem via the constructor.
 * Key: E (wired in game.ts)
 */
export class EnchantingUI {
  /** Fired when the player clicks Enchant.  Passes itemId, effectId, gemType. */
  public onEnchant: ((itemId: string, effectId: string, gemType: SoulGemType) => void) | null = null;

  private readonly _ui: AdvancedDynamicTexture;
  private readonly _system: EnchantingSystem;
  private readonly _panel: Rectangle;
  private readonly _titleSkill: TextBlock;
  private readonly _itemStack: StackPanel;
  private readonly _effectStack: StackPanel;
  private readonly _gemStack: StackPanel;
  private readonly _statusLabel: TextBlock;
  private readonly _enchantBtn: Button;

  private _selectedItemId:   string | null = null;
  private _selectedEffectId: string | null = null;
  private _selectedGemType:  SoulGemType | null = null;
  /** Inferred category based on the selected item's slot. */
  private _selectedCategory: EnchantmentCategory | null = null;

  public isVisible: boolean = false;

  constructor(ui: AdvancedDynamicTexture, system: EnchantingSystem) {
    this._ui     = ui;
    this._system = system;

    // ── Outer panel ───────────────────────────────────────────────────────────
    this._panel = new Rectangle("enchantPanel");
    this._panel.width  = "780px";
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
    const titleBar = new Rectangle("enchTitleBar");
    titleBar.width     = "100%";
    titleBar.height    = "38px";
    titleBar.thickness = 0;
    titleBar.background = "rgba(8, 6, 20, 0.95)";
    titleBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._panel.addControl(titleBar);

    const titleText = new TextBlock("enchTitle", "Enchanting — Arcane Altar");
    titleText.color    = T.TITLE;
    titleText.fontSize = 16;
    titleText.fontStyle = "bold";
    titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleText.left = "14px";
    titleBar.addControl(titleText);

    this._titleSkill = new TextBlock("enchSkill", "");
    this._titleSkill.color    = T.DIM;
    this._titleSkill.fontSize = 13;
    this._titleSkill.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this._titleSkill.left = "-14px";
    titleBar.addControl(this._titleSkill);

    // ── Three-column body ─────────────────────────────────────────────────────
    const bodyRow = new StackPanel("enchBody");
    bodyRow.isVertical = false;
    bodyRow.width  = "100%";
    bodyRow.height = "420px";
    bodyRow.top    = "46px";
    bodyRow.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this._panel.addControl(bodyRow);

    this._itemStack   = this._makeColumn(bodyRow, "enchItemsCol",   "Items to Enchant",   "enchItemScroll",   "enchItemStack");
    this._effectStack = this._makeColumn(bodyRow, "enchEffectsCol",  "Enchantment Effects", "enchEffectScroll", "enchEffectStack");
    this._gemStack    = this._makeColumn(bodyRow, "enchGemsCol",     "Soul Gems",           "enchGemScroll",    "enchGemStack");

    // ── Status / action row ───────────────────────────────────────────────────
    const actionRow = new Rectangle("enchActionRow");
    actionRow.width     = "100%";
    actionRow.height    = "60px";
    actionRow.top       = "-0px";
    actionRow.thickness = 0;
    actionRow.background = "rgba(8, 6, 20, 0.85)";
    actionRow.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._panel.addControl(actionRow);

    this._statusLabel = new TextBlock("enchStatus", "Select an item, effect, and soul gem");
    this._statusLabel.color    = T.DIM;
    this._statusLabel.fontSize = 13;
    this._statusLabel.height   = "28px";
    this._statusLabel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
    this._statusLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._statusLabel.left     = "14px";
    this._statusLabel.top      = "4px";
    actionRow.addControl(this._statusLabel);

    // Enchant button
    this._enchantBtn = this._makeBtn("enchDoBtn", "Enchant", T.CRAFT_BG, T.CRAFT_HOVER);
    this._enchantBtn.width  = "100px";
    this._enchantBtn.height = "28px";
    this._enchantBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this._enchantBtn.verticalAlignment   = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this._enchantBtn.left   = "14px";
    this._enchantBtn.top    = "-4px";
    this._enchantBtn.onPointerClickObservable.add(() => this._handleEnchant());
    actionRow.addControl(this._enchantBtn);

    // Close button
    const closeBtn = this._makeBtn("enchClose", "✕", T.BTN_BG, T.BTN_HOVER);
    closeBtn.width  = "32px";
    closeBtn.height = "28px";
    closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.verticalAlignment   = Control.VERTICAL_ALIGNMENT_BOTTOM;
    closeBtn.left   = "-14px";
    closeBtn.top    = "-4px";
    (closeBtn.textBlock as TextBlock).color = T.DIM;
    closeBtn.onPointerClickObservable.add(() => this.toggle(false));
    actionRow.addControl(closeBtn);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Open or close the enchanting panel.
   * On open, clears any previous selection and refreshes all columns.
   */
  public toggle(visible: boolean): void {
    this.isVisible = visible;
    this._panel.isVisible = visible;
    if (visible) {
      this._selectedItemId   = null;
      this._selectedEffectId = null;
      this._selectedGemType  = null;
      this._selectedCategory = null;
      this._refresh();
    }
  }

  /** Refresh all columns (call after an enchantment is applied). */
  public refresh(): void {
    if (this.isVisible) this._refresh();
  }

  // ── Private render helpers ────────────────────────────────────────────────

  private _refresh(): void {
    this._titleSkill.text = `Enchanting Skill: ${this._system.enchantingSkill}`;
    this._refreshItemList();
    this._refreshEffectList();
    this._refreshGemList();
    this._refreshStatus();
  }

  private _refreshItemList(): void {
    this._clearStack(this._itemStack);

    const items = this._system.getEnchantableItems();
    if (items.length === 0) {
      this._addEmpty(this._itemStack, "enchItemEmpty", "No enchantable items");
      return;
    }

    for (const item of items) {
      const selected = item.id === this._selectedItemId;
      const row = this._makeRow(`enchItem_${item.id}`, selected);

      const cat = getItemEnchantmentCategory(item.slot) ?? "item";
      const nameText = new TextBlock(`enchItemName_${item.id}`, item.name);
      nameText.color    = selected ? T.TITLE : T.TEXT;
      nameText.fontSize = 13;
      nameText.height   = "20px";
      nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      nameText.left  = "10px";
      nameText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      nameText.top   = "6px";
      row.addControl(nameText);

      const typeText = new TextBlock(`enchItemType_${item.id}`, cat.charAt(0).toUpperCase() + cat.slice(1));
      typeText.color    = T.DIM;
      typeText.fontSize = 11;
      typeText.height   = "16px";
      typeText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      typeText.left  = "10px";
      typeText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      typeText.top   = "26px";
      row.addControl(typeText);

      row.onPointerClickObservable.add(() => this._selectItem(item));
      row.onPointerEnterObservable.add(() => {
        if (item.id !== this._selectedItemId) row.background = "rgba(30, 20, 60, 0.7)";
      });
      row.onPointerOutObservable.add(() => {
        row.background = item.id === this._selectedItemId ? T.SEL_BG : "transparent";
      });

      this._itemStack.addControl(row);
    }
  }

  private _refreshEffectList(): void {
    this._clearStack(this._effectStack);

    const effects = this._selectedCategory
      ? this._system.getEffectsForCategory(this._selectedCategory)
      : this._system.getEffectDefinitions();

    if (effects.length === 0) {
      this._addEmpty(this._effectStack, "enchEffEmpty", "No effects available");
      return;
    }

    for (const eff of effects) {
      const selected = eff.id === this._selectedEffectId;
      const row = this._makeRow(`enchEff_${eff.id}`, selected);

      const nameText = new TextBlock(`enchEffName_${eff.id}`, eff.name);
      nameText.color    = selected ? T.TITLE : T.TEXT;
      nameText.fontSize = 13;
      nameText.height   = "20px";
      nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      nameText.left  = "10px";
      nameText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      nameText.top   = "4px";
      row.addControl(nameText);

      const descText = new TextBlock(`enchEffDesc_${eff.id}`, eff.description);
      descText.color    = T.DIM;
      descText.fontSize = 10;
      descText.height   = "28px";
      descText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      descText.textWrapping = true as any;
      descText.left  = "10px";
      descText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      descText.top   = "22px";
      row.addControl(descText);

      row.onPointerClickObservable.add(() => {
        this._selectedEffectId = selected ? null : eff.id;
        this._refreshEffectList();
        this._refreshStatus();
      });
      row.onPointerEnterObservable.add(() => {
        if (eff.id !== this._selectedEffectId) row.background = "rgba(30, 20, 60, 0.7)";
      });
      row.onPointerOutObservable.add(() => {
        row.background = eff.id === this._selectedEffectId ? T.SEL_BG : "transparent";
      });

      this._effectStack.addControl(row);
    }
  }

  private _refreshGemList(): void {
    this._clearStack(this._gemStack);

    const available = this._system.getAvailableSoulGems();
    if (available.length === 0) {
      this._addEmpty(this._gemStack, "enchGemEmpty", "No soul gems");
      return;
    }

    for (const { def, count } of available) {
      const selected = def.type === this._selectedGemType;
      const row = this._makeRow(`enchGem_${def.type}`, selected);

      const nameText = new TextBlock(`enchGemName_${def.type}`, `${def.name}  ×${count}`);
      nameText.color    = selected ? T.TITLE : T.TEXT;
      nameText.fontSize = 13;
      nameText.height   = "20px";
      nameText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      nameText.left  = "10px";
      nameText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      nameText.top   = "6px";
      row.addControl(nameText);

      const multText = new TextBlock(`enchGemMult_${def.type}`, `${def.magnitudeMultiplier}× magnitude`);
      multText.color    = T.DIM;
      multText.fontSize = 11;
      multText.height   = "16px";
      multText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      multText.left  = "10px";
      multText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      multText.top   = "26px";
      row.addControl(multText);

      row.onPointerClickObservable.add(() => {
        this._selectedGemType = selected ? null : def.type;
        this._refreshGemList();
        this._refreshStatus();
      });
      row.onPointerEnterObservable.add(() => {
        if (def.type !== this._selectedGemType) row.background = "rgba(30, 20, 60, 0.7)";
      });
      row.onPointerOutObservable.add(() => {
        row.background = def.type === this._selectedGemType ? T.SEL_BG : "transparent";
      });

      this._gemStack.addControl(row);
    }
  }

  private _refreshStatus(): void {
    const allSelected = this._selectedItemId && this._selectedEffectId && this._selectedGemType;
    if (!allSelected) {
      const parts: string[] = [];
      if (!this._selectedItemId)   parts.push("item");
      if (!this._selectedEffectId) parts.push("effect");
      if (!this._selectedGemType)  parts.push("soul gem");
      this._statusLabel.text  = `Select a${parts.length === 3 ? "n" : ""}: ${parts.join(", ")}`;
      this._statusLabel.color = T.DIM;
      return;
    }

    // All three selected — show preview
    const items = this._system.getEnchantableItems();
    const item  = items.find(i => i.id === this._selectedItemId);
    const effs  = this._system.getEffectDefinitions();
    const eff   = effs.find(e => e.id === this._selectedEffectId);
    const gem   = SOUL_GEMS[this._selectedGemType!];
    if (item && eff && gem) {
      const skillMult    = 0.5 + (this._system.enchantingSkill / 100) * 1.5;
      const magnitude    = Math.max(1, Math.round(eff.baseMagnitude * gem.magnitudeMultiplier * skillMult));
      this._statusLabel.text  = `${eff.namePrefix} ${item.name} — ${eff.name} +${magnitude}`;
      this._statusLabel.color = T.GOOD;
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  private _selectItem(item: Item): void {
    if (this._selectedItemId === item.id) {
      // Deselect
      this._selectedItemId   = null;
      this._selectedCategory = null;
      this._selectedEffectId = null;
    } else {
      this._selectedItemId   = item.id;
      this._selectedCategory = getItemEnchantmentCategory(item.slot);
      // Clear effect selection if it no longer applies to the new category
      if (this._selectedEffectId) {
        const prevEff = this._system.getEffectDefinitions().find(e => e.id === this._selectedEffectId);
        if (prevEff && prevEff.category !== this._selectedCategory) {
          this._selectedEffectId = null;
        }
      }
    }
    this._refreshItemList();
    this._refreshEffectList();
    this._refreshStatus();
  }

  // ── Enchant action ────────────────────────────────────────────────────────

  private _handleEnchant(): void {
    if (!this._selectedItemId || !this._selectedEffectId || !this._selectedGemType) return;
    this.onEnchant?.(this._selectedItemId, this._selectedEffectId, this._selectedGemType);
    // Reset selection so the panel is ready for the next enchant
    this._selectedItemId   = null;
    this._selectedEffectId = null;
    this._selectedGemType  = null;
    this._selectedCategory = null;
    this._refresh();
  }

  // ── Layout helpers ────────────────────────────────────────────────────────

  private _makeColumn(
    parent: StackPanel,
    colName: string,
    title: string,
    scrollName: string,
    stackName: string,
  ): StackPanel {
    const col = new Rectangle(colName);
    col.width     = "33.33%";
    col.height    = "100%";
    col.thickness = 0;
    col.background = "transparent";
    parent.addControl(col);

    const header = new TextBlock(`${colName}Header`, title);
    header.color    = T.DIM;
    header.fontSize = 12;
    header.height   = "22px";
    header.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    header.left     = "8px";
    header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    col.addControl(header);

    const scroll = new ScrollViewer(scrollName);
    scroll.width   = "calc(100% - 8px)";
    scroll.height  = "calc(100% - 26px)";
    scroll.top     = "24px";
    scroll.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    scroll.thickness = 1;
    scroll.color   = T.PANEL_BORDER;
    scroll.background = "rgba(6, 4, 16, 0.6)";
    col.addControl(scroll);

    const stack = new StackPanel(stackName);
    stack.width      = "100%";
    stack.isVertical = true;
    stack.paddingTop = "4px";
    scroll.addControl(stack);

    return stack;
  }

  private _makeRow(name: string, selected: boolean): Rectangle {
    const row = new Rectangle(name);
    row.width     = "100%";
    row.height    = "50px";
    row.thickness = 1;
    row.color     = selected ? T.SEL_BORDER : T.PANEL_BORDER;
    row.background = selected ? T.SEL_BG : "transparent";
    row.paddingTop    = "2px";
    row.paddingBottom = "2px";
    row.isPointerBlocker = true;
    return row;
  }

  private _addEmpty(stack: StackPanel, name: string, label: string): void {
    const tb = new TextBlock(name, label);
    tb.color    = T.DIM;
    tb.fontSize = 12;
    tb.height   = "28px";
    stack.addControl(tb);
  }

  private _clearStack(stack: StackPanel): void {
    while (stack.children.length > 0) {
      stack.children[0].dispose();
    }
  }

  private _makeBtn(name: string, label: string, bg: string, hover: string): Button {
    const btn = Button.CreateSimpleButton(name, label);
    btn.background   = bg;
    btn.color        = T.TEXT;
    btn.fontSize     = 12;
    btn.cornerRadius = 4;
    btn.thickness    = 1;
    if (btn.textBlock) btn.textBlock.color = T.TEXT;
    btn.onPointerEnterObservable.add(() => { btn.background = hover; });
    btn.onPointerOutObservable.add(()   => { btn.background = bg; });
    return btn;
  }
}
