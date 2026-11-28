/**
 * Character progression as a kernel feature: character levels (earned by
 * raising major skills), the level-up dialog where three attributes are
 * chosen, a perk point per level, and the character sheet (Tab) where perks
 * are spent.
 *
 * Inputs:   services progression-host, feedback, modal, gameplay.
 * Outputs:  the `progression` service; `player:levelUp` events.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { PlayerLevelSystem } from "../../systems/player-level-system";
import { LevelUpUI } from "../../ui/level-up-ui";
import type { CharacterSheetUI, CharacterSheetData } from "../../ui/character-sheet-ui";
import { LazyPanel } from "../../ui/lazy-panel";
import type { AttributeSystem } from "../../systems/attribute-system";
import type { ClassSystem } from "../../systems/class-system";
import type { PerkSystem } from "../../systems/perk-system";
import { FeedbackKey, GameplayKey, ModalKey, declareStateless } from "../services";

export interface ProgressionHostService {
  readonly attributes: AttributeSystem;
  readonly classes: ClassSystem;
  perks(): PerkSystem;
  /** Max health, magicka, stamina and carry weight from the attributes. */
  syncMaxStats(): void;
  /** A new character level (trainers allow more lessons). */
  levelReached(level: number): void;
  /** Offer the attribute panel (only when nothing else owns the screen). */
  offerAttributes(): void;
  /** The character sheet, apart from level and perks. */
  sheet(): Omit<CharacterSheetData, "level" | "perkPoints" | "perks">;
  /** The HUD knows the sheet is up. */
  setSheetOpen(open: boolean): void;
}

export interface ProgressionService {
  readonly levels: PlayerLevelSystem;
  readonly levelUp: LevelUpUI;
  /** The sheet (loaded on first use). */
  readonly sheet: LazyPanel<CharacterSheetUI>;
  /** Tab: the character sheet. */
  toggleSheet(): void;
  closeSheet(): void;
  /** A major skill went up (counts toward the next character level). */
  skillRaised(skillId: string): void;
}

export const ProgressionHostKey = createServiceKey<ProgressionHostService>("progression-host");
export const ProgressionKey = createServiceKey<ProgressionService>("progression");

export class ProgressionFeature implements Feature {
  public readonly id = "progression";
  public readonly levels = new PlayerLevelSystem();
  /** The one level-up dialog. (There used to be two, and the one shown lost its confirm.) */
  public readonly levelUp = new LevelUpUI();
  /** The character sheet: its code loads the first time it opens. */
  public readonly sheet = new LazyPanel<CharacterSheetUI>(async () => {
    const { CharacterSheetUI } = await import("../../ui/character-sheet-ui");
    const ui = new CharacterSheetUI();
    this._wireSheet?.(ui);
    return ui;
  });
  private _wireSheet: ((ui: CharacterSheetUI) => void) | null = null;
  private _s: ServiceRegistry | null = null;

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "levels, attributes and perks are saved by the save system");
    const s = ctx.kernel.services;
    this._s = s;
    const host = () => s.get(ProgressionHostKey);
    const feedback = () => s.get(FeedbackKey);
    const modal = () => s.get(ModalKey);

    this.levels.attachToClassSystem(host().classes);
    this.levels.attachToAttributeSystem(host().attributes);
    // A level-up can come from anywhere (a skill raised in a menu, in a
    // conversation): the dialog waits until nothing else has the screen, so it
    // never stacks on another menu (both would hand input back on close).
    let pending: Parameters<NonNullable<typeof this.levels.onLevelUpReady>>[0] | null = null;
    this.levels.onLevelUpReady = (bonuses) => { pending = bonuses; };
    ctx.system({
      id: "progression.level-up-when-free", phase: "ui", update: () => {
        if (pending && !this.levels.levelUpPending) pending = null; // a load took it back
        if (!pending || this.levelUp.isVisible || !s.get(GameplayKey).canAct()) return;
        const bonuses = pending;
        pending = null;
        modal().suspendGameplay();
        this.levelUp.open(this.levels.characterLevel + 1, bonuses);
      },
    });
    this.levelUp.onConfirm = (primary, second, third) => {
      this.levels.confirmLevelUp(primary, second, third);
      modal().restoreGameplay();
    };
    this.levels.onLevelUpComplete = (level) => {
      host().syncMaxStats();
      feedback().notify(`Character Level ${level}!`, 4000);
      ctx.kernel.events.emit("player:levelUp", { newLevel: level });
      host().levelReached(level);
      host().perks().addPerkPoints(1);
      feedback().markDirty();
      if (this.sheet.isVisible) this._refresh();
      host().offerAttributes();
    };

    this._wireSheet = (ui) => {
      ui.onClose = () => {
        host().setSheetOpen(false);
        modal().restoreGameplay();
      };
      ui.onPerkUnlock = (perkId) => {
        if (!host().perks().unlock(perkId)) return;
        feedback().markDirty();
        this._refresh();
      };
    };

    /** The sheet's code is loading (Tab again waits for it). */
    let opening = false;
    const close = () => {
      if (!this.sheet.isVisible) return;
      this.sheet.current?.hide();
      host().setSheetOpen(false);
      modal().restoreGameplay();
    };
    // Skill level-ups count toward the character level (major skills).
    ctx.on("skill:levelUp", ({ skillId }) => this.levels.handleSkillLevelUp(skillId as never));
    ctx.provide(ProgressionKey, {
      levels: this.levels,
      levelUp: this.levelUp,
      sheet: this.sheet,
      closeSheet: close,
      toggleSheet: () => {
        if (this.sheet.isVisible) { close(); return; }
        if (opening || !s.get(GameplayKey).canAct()) return;
        opening = true;
        modal().suspendGameplay();
        host().setSheetOpen(true);
        this.sheet.get().then((ui) => {
          opening = false;
          this._refresh();
          ui.show();
        }, () => {
          // Couldn't load (a chunk that failed to arrive): give the input back; the next Tab tries again.
          opening = false;
          host().setSheetOpen(false);
          modal().restoreGameplay();
        });
      },
      skillRaised: (id) => this.levels.handleSkillLevelUp(id as never),
    });

    ctx.scope.add(() => {
      this.levels.onLevelUpReady = this.levels.onLevelUpComplete = null;
      this.levelUp.onConfirm = null;
      const ui = this.sheet.current;
      if (ui) { ui.close(); ui.onClose = ui.onPerkUnlock = null; }
      this._wireSheet = null;
      this._s = null;
    });
  }

  /** Push the latest numbers into the sheet. */
  private _refresh(): void {
    const s = this._s;
    if (!s) return;
    const host = s.get(ProgressionHostKey);
    const perks = host.perks();
    this.sheet.current?.update({ ...host.sheet(), level: this.levels.characterLevel, perkPoints: perks.perkPoints, perks: perks.getAllPerks() });
  }
}
