/**
 * Crafting as a kernel feature: alchemy (L), enchanting (B) and smithing
 * (Shift+B), with the world's forges and gear wear.
 *
 * The game builds this early (other constructor code reads `smithing`) from
 * a few concrete systems, then installs it with the rest. Combat, barter and
 * inventory hooks into gear wear stay in the game for now and go through
 * `smithing`.
 *
 * Inputs:   services feedback, modal, gameplay, player, skills; events
 *           `dialogue:action` ("smithing:open"), `dialogue:closed`,
 *           `chunk:unloaded`.
 * Outputs:  the `crafting` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { AlchemySystem } from "../../systems/alchemy-system";
import { AlchemyUI } from "../../ui/alchemy-ui";
import { EnchantingSystem } from "../../systems/enchanting-system";
import { EnchantingUI } from "../../ui/enchanting-ui";
import { CraftingSystem, type CraftingStationId } from "../../systems/crafting-system";
import { CraftingUI } from "../../ui/crafting-ui";
import { ItemConditionSystem } from "../../systems/item-condition-system";
import {
  ForgeRegistry, SmithingController, SMITHING_MATERIAL_ITEMS, smithingMaterialStack,
} from "../../systems/smithing-controller";
import type { Player } from "../../entities/player";
import type { UIManager } from "../../ui/ui-manager";
import type { InventorySystem } from "../../systems/inventory-system";
import type { EquipmentSystem } from "../../systems/equipment-system";
import { FeedbackKey, GameplayKey, ModalKey, PlayerKey, SkillsKey, ownSave } from "../services";

/** The concrete systems crafting is built on. */
export interface CraftingDeps {
  player: Player;
  ui: UIManager;
  inventory: InventorySystem;
  equipment: EquipmentSystem;
}

export interface CraftingService {
  readonly alchemy: AlchemySystem;
  readonly alchemyPanel: AlchemyUI;
  readonly enchanting: EnchantingSystem;
  readonly enchantingPanel: EnchantingUI;
  readonly recipes: CraftingSystem;
  readonly conditions: ItemConditionSystem;
  readonly smithing: SmithingController;
  readonly forgePanel: CraftingUI;
  readonly forges: ForgeRegistry;
  /** L: the alchemy workbench. */
  toggleAlchemy(): void;
  /** B: the enchanting altar. */
  toggleEnchanting(): void;
  /** Shift+B: the smithing forge. */
  toggleSmithing(): void;
}

export const CraftingKey = createServiceKey<CraftingService>("crafting");

export class CraftingFeature implements Feature {
  public readonly id = "crafting";
  public readonly alchemy: AlchemySystem;
  public readonly alchemyPanel: AlchemyUI;
  public readonly enchanting: EnchantingSystem;
  public readonly enchantingPanel: EnchantingUI;
  public readonly recipes = new CraftingSystem();
  public readonly conditions = new ItemConditionSystem();
  public readonly smithing: SmithingController;
  public readonly forgePanel = new CraftingUI({ title: "Smithing Forge" });
  /** Smithies, armorer inns and the starting forge; steel work needs one in reach. */
  public readonly forges = new ForgeRegistry();
  private _s: ServiceRegistry | null = null;
  private _forgeAfterTalk = false;

  constructor(deps: CraftingDeps) {
    this.alchemy = new AlchemySystem(deps.player, deps.ui);
    this.alchemyPanel = new AlchemyUI(deps.ui.uiTexture, this.alchemy);
    this.enchanting = new EnchantingSystem(deps.player, deps.inventory, deps.equipment, deps.ui);
    this.enchantingPanel = new EnchantingUI(deps.ui.uiTexture, this.enchanting);
    this.smithing = new SmithingController(this.recipes, this.conditions, {
      inventory: deps.inventory,
      equipment: deps.equipment,
      player: deps.player,
      getArmorerSkill: () => this._s?.tryGet(SkillsKey)?.level("armorer") ?? 0,
      gainArmorerXp: (amount) => this._s?.tryGet(SkillsKey)?.gainXP("armorer", amount),
      notify: (message, ms) => this._s?.tryGet(FeedbackKey)?.notify(message, ms),
    });
    this.forgePanel.materialLabel = (id) => SMITHING_MATERIAL_ITEMS[id]?.name ?? id;

    // Starter kit: a few ingredients, soul gems, and enough to use the forge
    // before the first merchant visit.
    for (const [id, n] of [
      ["aloe_vera_leaves", 5], ["cairn_bolete_cap", 4], ["fennel_seeds", 4],
      ["dragon_tongue", 3], ["bergamot_seeds", 3],
    ] as const) this.alchemy.addIngredient(id, n);
    this.enchanting.addSoulGem("petty", 3);
    this.enchanting.addSoulGem("lesser", 2);
    this.enchanting.addSoulGem("common", 1);
    deps.inventory.items.push(
      smithingMaterialStack("iron_ingot", 3),
      smithingMaterialStack("leather_strips", 2),
      smithingMaterialStack("repair_hammer", 2),
    );
    deps.player.carryWeight = deps.inventory.totalWeight;
  }

  public install(ctx: FeatureContext): void {
    ownSave(ctx, { key: "crafting", save: () => this.recipes.getSystemState(), load: (data) => {
      const c = data as { recipeSnapshots?: unknown; discoveredRecipeIds?: unknown } | undefined;
      if (c && Array.isArray(c.recipeSnapshots) && Array.isArray(c.discoveredRecipeIds)) this.recipes.restoreSystemState(c as never);
    } });
    const s = ctx.kernel.services;
    this._s = s;
    const feedback = () => s.get(FeedbackKey);
    const modal = () => s.get(ModalKey);
    const canAct = () => s.get(GameplayKey).canAct();

    this.alchemyPanel.onCraft = (ids) => {
      this.alchemy.craftPotion(ids);
      this.alchemyPanel.refresh();
    };
    this.alchemyPanel.onDrink = (potionId) => {
      this.alchemy.drinkPotion(potionId);
      feedback().markDirty();
    };
    this.alchemy.onPotionCrafted = () => s.get(SkillsKey).gainXP("alchemy", 15);
    this.enchantingPanel.onEnchant = (itemId, effectId, gem) => {
      this.enchanting.enchantItem(itemId, effectId, gem);
      this.enchantingPanel.refresh();
      feedback().markDirty();
    };
    this.forgePanel.onCraft = (recipeId) => {
      if (this.smithing.craft(recipeId, this._station()).success) feedback().markDirty();
      this._refreshForge();
    };
    // The panels' own ✕ buttons.
    this.alchemyPanel.onClosed = () => modal().restoreGameplay();
    this.enchantingPanel.onClosed = () => modal().restoreGameplay();
    this.forgePanel.onClose = () => modal().restoreGameplay();

    const toggleAlchemy = () => {
      if (this.alchemyPanel.isVisible) {
        this.alchemyPanel.toggle(false);
        modal().restoreGameplay();
        return;
      }
      if (!canAct()) return;
      this.alchemyPanel.toggle(true);
      modal().suspendGameplay();
    };
    const toggleEnchanting = () => {
      if (this.enchantingPanel.isVisible) {
        this.enchantingPanel.toggle(false);
        modal().restoreGameplay();
        return;
      }
      if (!canAct()) return;
      this.enchantingPanel.toggle(true);
      modal().suspendGameplay();
    };
    const toggleSmithing = () => {
      if (this.forgePanel.isVisible) {
        this.forgePanel.hide();
        modal().restoreGameplay();
        return;
      }
      if (!canAct()) return;
      this._openForge();
    };

    ctx.provide(CraftingKey, {
      alchemy: this.alchemy,
      alchemyPanel: this.alchemyPanel,
      enchanting: this.enchanting,
      enchantingPanel: this.enchantingPanel,
      recipes: this.recipes,
      conditions: this.conditions,
      smithing: this.smithing,
      forgePanel: this.forgePanel,
      forges: this.forges,
      toggleAlchemy,
      toggleEnchanting,
      toggleSmithing,
    });

    // A smith's "Use the forge" opens it once the conversation ends.
    ctx.on("dialogue:action", ({ eventId }) => {
      if (eventId === "smithing:open") this._forgeAfterTalk = true;
    });
    ctx.on("dialogue:closed", () => {
      if (!this._forgeAfterTalk) return;
      this._forgeAfterTalk = false;
      this._openForge();
    });
    ctx.on("chunk:unloaded", ({ chunkKey }) => this.forges.removeGroup(chunkKey));

    ctx.scope.add(() => {
      this.alchemyPanel.onCraft = null;
      this.alchemyPanel.onDrink = null;
      this.alchemyPanel.onClosed = null;
      this.alchemy.onPotionCrafted = null;
      this.enchantingPanel.onEnchant = null;
      this.enchantingPanel.onClosed = null;
      this.forgePanel.onCraft = null;
      this.forgePanel.onClose = null;
      if (this.alchemyPanel.isVisible) this.alchemyPanel.toggle(false);
      if (this.enchantingPanel.isVisible) this.enchantingPanel.toggle(false);
      if (this.forgePanel.isVisible) this.forgePanel.hide();
      this._s = null;
    });
  }

  /** "forge" when the player stands by one; otherwise field smithing. */
  private _station(): CraftingStationId | undefined {
    const p = this._s?.get(PlayerKey).position();
    return p ? this.forges.stationAt(p.x, p.z) : undefined;
  }

  private _openForge(): void {
    const s = this._s;
    if (!s || this.forgePanel.isVisible) return;
    this.forgePanel.show();
    this._refreshForge();
    s.get(ModalKey).suspendGameplay();
    if (!this._station()) {
      s.get(FeedbackKey).notify("No forge nearby: field smithing only. Steel work needs a forge.", 3000);
    }
  }

  /** Re-render the forge from the live inventory and Armorer skill. */
  private _refreshForge(): void {
    if (!this.forgePanel.isVisible) return;
    this.forgePanel.update(
      this.recipes,
      this.smithing.getMaterials(),
      this._s?.get(SkillsKey).level("armorer") ?? 0,
      this._station(),
    );
  }
}
