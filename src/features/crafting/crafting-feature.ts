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
 *           `chunk:unloaded`, and the combat reports that wear gear
 *           (`combat:weaponHit`, `combat:playerStruck`, `combat:blocked`,
 *           `projectile:playerHit`).
 * Outputs:  the `crafting` service.
 *
 * The three windows load the first time they open (out of the start-up
 * bundle); `alchemyPanel`, `enchantingPanel` and `forgePanel` are their
 * LazyPanels.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Rng } from "../../core/rng/rng";
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { AlchemySystem } from "../../systems/alchemy-system";
import type { AlchemyUI } from "../../ui/alchemy-ui";
import { EnchantingSystem } from "../../systems/enchanting-system";
import type { EnchantingUI } from "../../ui/enchanting-ui";
import { CraftingSystem, type CraftingStationId } from "../../systems/crafting-system";
import type { CraftingUI } from "../../ui/crafting-ui";
import { LazyPanel } from "../../ui/lazy-panel";
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
  readonly alchemyPanel: LazyPanel<AlchemyUI>;
  readonly enchanting: EnchantingSystem;
  readonly enchantingPanel: LazyPanel<EnchantingUI>;
  readonly recipes: CraftingSystem;
  readonly conditions: ItemConditionSystem;
  readonly smithing: SmithingController;
  readonly forgePanel: LazyPanel<CraftingUI>;
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
  public readonly alchemyPanel = new LazyPanel<AlchemyUI>(async () => {
    const { AlchemyUI } = await import("../../ui/alchemy-ui");
    const panel = new AlchemyUI(this.alchemy);
    this._wire?.alchemy(panel);
    return panel;
  });
  public readonly enchanting: EnchantingSystem;
  public readonly enchantingPanel = new LazyPanel<EnchantingUI>(async () => {
    const { EnchantingUI } = await import("../../ui/enchanting-ui");
    const panel = new EnchantingUI(this.enchanting);
    this._wire?.enchanting(panel);
    return panel;
  });
  public readonly recipes = new CraftingSystem();
  public readonly conditions = new ItemConditionSystem();
  public readonly smithing: SmithingController;
  public readonly forgePanel = new LazyPanel<CraftingUI>(async () => {
    const { CraftingUI } = await import("../../ui/crafting-ui");
    const panel = new CraftingUI({ title: "Smithing Forge" });
    panel.materialLabel = (id) => SMITHING_MATERIAL_ITEMS[id]?.name ?? id;
    this._wire?.forge(panel);
    return panel;
  });
  /** How a panel is hooked up once it has loaded (set on install). */
  private _wire: { alchemy(p: AlchemyUI): void; enchanting(p: EnchantingUI): void; forge(p: CraftingUI): void } | null = null;
  /** Smithies, armorer inns and the starting forge; steel work needs one in reach. */
  public readonly forges = new ForgeRegistry();
  private _s: ServiceRegistry | null = null;
  /** Which worn piece takes the wear (seeded, so replays match). */
  private _rng: Rng | null = null;
  private _forgeAfterTalk = false;

  /** Potency follows the Alchemy skill (trainer lessons count), never dropping below the brewer's own practice. */
  private _syncAlchemySkill(): void {
    const level = this._s?.tryGet(SkillsKey)?.level("alchemy") ?? 0;
    this.alchemy.alchemySkill = Math.max(this.alchemy.alchemySkill, level);
  }

  constructor(deps: CraftingDeps) {
    this.alchemy = new AlchemySystem(deps.player, deps.ui);
    this.enchanting = new EnchantingSystem(deps.player, deps.inventory, deps.equipment, deps.ui);
    this.smithing = new SmithingController(this.recipes, this.conditions, {
      inventory: deps.inventory,
      equipment: deps.equipment,
      player: deps.player,
      getArmorerSkill: () => this._s?.tryGet(SkillsKey)?.level("armorer") ?? 0,
      gainArmorerXp: (amount) => this._s?.tryGet(SkillsKey)?.gainXP("armorer", amount),
      notify: (message, ms) => this._s?.tryGet(FeedbackKey)?.notify(message, ms),
      random: () => this._rng?.next() ?? 0.5,
    });

    // Starter kit: a few ingredients, spirit vessels, and enough to use the forge
    // before the first merchant visit.
    for (const [id, n] of [
      ["plantain_leaves", 5], ["comfrey_root", 4], ["vervain", 4],
      ["st_johns_wort", 3], ["meadowsweet", 3],
    ] as const) this.alchemy.addIngredient(id, n);
    this.enchanting.addVessel("clay", 3);
    this.enchanting.addVessel("pewter", 2);
    this.enchanting.addVessel("silver", 1);
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
    this._rng = ctx.kernel.rng.stream("armor-wear");
    const feedback = () => s.get(FeedbackKey);
    const modal = () => s.get(ModalKey);
    const canAct = () => s.get(GameplayKey).canAct();

    // Gear wear: the weapon on each hit, armour on each blow taken, the
    // shield on each block.
    ctx.on("combat:weaponHit", ({ powerAttack }) => this.smithing.onWeaponHit(powerAttack));
    ctx.on("combat:playerStruck", () => this.smithing.onPlayerStruck());
    ctx.on("projectile:playerHit", () => this.smithing.onPlayerStruck());
    ctx.on("combat:blocked", () => this.smithing.onBlock());
    // New or restored gear: track its condition and the wear penalty.
    const refreshGear = () => { this.smithing.trackEquippedGear(); this.smithing.refreshPenalties(); };
    ctx.on("equipment:changed", refreshGear);
    ctx.on("save:loaded", refreshGear);

    this.alchemy.onPotionCrafted = () => s.get(SkillsKey).gainXP("alchemy", 15);
    // Hooked up when each window first loads (and now, if one already has).
    this._wire = {
      alchemy: (p) => {
        p.onCraft = (ids) => {
          this._syncAlchemySkill();
          this.alchemy.craftPotion(ids);
          p.refresh();
        };
        p.onDrink = (potionId) => { this.alchemy.drinkPotion(potionId); feedback().markDirty(); };
        p.onClosed = () => modal().restoreGameplay(); // its own ✕
      },
      enchanting: (p) => {
        p.onEnchant = (itemId, effectId, gem) => { this.enchanting.enchantItem(itemId, effectId, gem); p.refresh(); feedback().markDirty(); };
        p.onClosed = () => modal().restoreGameplay();
      },
      forge: (p) => {
        p.onCraft = (recipeId) => {
          if (this.smithing.craft(recipeId, this._station()).success) feedback().markDirty();
          this._refreshForge();
        };
        p.onClose = () => modal().restoreGameplay();
      },
    };
    if (this.alchemyPanel.current) this._wire.alchemy(this.alchemyPanel.current);
    if (this.enchantingPanel.current) this._wire.enchanting(this.enchantingPanel.current);
    if (this.forgePanel.current) this._wire.forge(this.forgePanel.current);

    const toggleAlchemy = () => {
      if (this.alchemyPanel.isVisible) {
        this.alchemyPanel.close();
        modal().restoreGameplay();
        return;
      }
      if (!canAct()) return;
      modal().suspendGameplay();
      this._syncAlchemySkill();
      void this.alchemyPanel.get().then((p) => p.toggle(true));
    };
    const toggleEnchanting = () => {
      if (this.enchantingPanel.isVisible) {
        this.enchantingPanel.close();
        modal().restoreGameplay();
        return;
      }
      if (!canAct()) return;
      modal().suspendGameplay();
      void this.enchantingPanel.get().then((p) => p.toggle(true));
    };
    const toggleSmithing = () => {
      if (this.forgePanel.isVisible) {
        this.forgePanel.close();
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
      this.alchemy.onPotionCrafted = null;
      const a = this.alchemyPanel.current, e = this.enchantingPanel.current, f = this.forgePanel.current;
      if (a) { a.onCraft = a.onDrink = null; a.onClosed = null; }
      if (e) { e.onEnchant = null; e.onClosed = null; }
      if (f) { f.onCraft = null; f.onClose = null; }
      this.alchemyPanel.close();
      this.enchantingPanel.close();
      this.forgePanel.close();
      this._wire = null;
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
    s.get(ModalKey).suspendGameplay();
    void this.forgePanel.get().then((panel) => {
      panel.show();
      this._refreshForge();
    });
    if (!this._station()) {
      s.get(FeedbackKey).notify("No forge nearby: field smithing only. Steel work needs a forge.", 3000);
    }
  }

  /** Re-render the forge from the live inventory and Armorer skill. */
  private _refreshForge(): void {
    const panel = this.forgePanel.current;
    if (!panel?.isVisible) return;
    panel.update(
      this.recipes,
      this.smithing.getMaterials(),
      this._s?.get(SkillsKey).level("armorer") ?? 0,
      this._station(),
    );
  }
}
