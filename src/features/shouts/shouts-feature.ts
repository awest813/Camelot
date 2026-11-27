/**
 * The Words of the Old Tongue as a kernel feature: awen and the ranks it
 * masters, the words panel (N), speaking the ready word (Shift+N), each
 * word's effect on the world, and the timed buffs (Held Moment, Battle-wind).
 *
 * Inputs:   services feedback, modal, gameplay, shout-host; event
 *           `player:kill` (dragons), `landmark:cleared` (camps),
 *           `location:discovered` (obelisks teach); a sim-phase system ticks
 *           the buffs.
 * Outputs:  the `shouts` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { DragonShoutSystem, type ShoutTierEffect } from "../../systems/dragon-shout-system";
import { ShoutUI, type ShoutView } from "../../ui/shout-ui";
import type { ActiveEffect } from "../../systems/active-effects-system";
import type { DamageType, NPC } from "../../entities/npc";
import { FeedbackKey, GameplayKey, ModalKey, ownSave } from "../services";

/** What a shout does to the world, through the game. */
export interface ShoutHostService {
  /** In-game minutes (cooldowns run on game time). */
  gameTime(): number;
  /** The player's position and the flat direction they face. */
  stance(): { origin: Vector3; forward: Vector3 };
  /** NPCs a shout can reach. */
  targets(): readonly NPC[];
  /** Move the player up to `distance` forward, stopping short of walls. */
  dash(distance: number): void;
  addEffect(effect: Omit<ActiveEffect, "totalDuration">): void;
  /** Resisted damage, with aggro and the usual kill handling. */
  damage(npc: NPC, raw: number, type: DamageType): void;
  setAttackSpeedMultiplier(multiplier: number): void;
  clearWeather(): void;
}

export interface ShoutsService {
  readonly shouts: DragonShoutSystem;
  readonly panel: ShoutUI;
  /** N: open or close the shouts panel. */
  togglePanel(): void;
  /** Shift+N: shout the equipped shout. */
  use(): void;
  /** Clock multiplier for hostile AI (below 1 during Slow Time). */
  hostileTimeScale(): number;
  /** A dragon died: take its soul and learn the next Word of Power. */
  absorbDragonSoul(): void;
  /** Keep the HUD chip (name, word pips, cooldown) current. */
  updateHud(): void;
}

export const ShoutHostKey = createServiceKey<ShoutHostService>("shout-host");
export const ShoutsKey = createServiceKey<ShoutsService>("shouts");

/** A shout reaches 16 m ahead, within about 75° of where the player faces. */
const REACH = 16;
const CONE_COS = 0.25;
const MAX_DASH = 30;

export class ShoutsFeature implements Feature {
  public readonly id = "shouts";
  public readonly shouts = new DragonShoutSystem();
  public readonly panel = new ShoutUI();
  private _timeScale = 1;
  private _slowTimeLeft = 0;
  private _furyLeft = 0;
  private _s: ServiceRegistry | null = null;

  public install(ctx: FeatureContext): void {
    ownSave(ctx, { key: "dragonShouts", save: () => this.shouts.getSaveState(), load: (data) => { if (data) this.shouts.restoreFromSave(data as never); } });
    const s = ctx.kernel.services;
    this._s = s;
    const feedback = () => s.get(FeedbackKey);
    const modal = () => s.get(ModalKey);
    const host = () => s.get(ShoutHostKey);
    const sh = this.shouts;

    sh.onShoutUsed = (shoutId, _words, tier) => this._apply(shoutId, tier);
    sh.onWordLearned = (_id, _i, word) => {
      feedback().notify(`A word of the Old Tongue: ${word.word}, "${word.translation}"`, 3600);
    };
    sh.onWordUnlocked = (shoutId, wordIndex, word) => {
      const def = sh.getShout(shoutId);
      feedback().notify(`${def?.name ?? shoutId}: ${word.word} mastered (rank ${wordIndex + 1} of 3).`, 3000);
      if (this.panel.isVisible) this._refreshPanel();
      feedback().markDirty();
    };
    sh.onDragonSoulGained = (total) => feedback().notify(`Awen gained (${total} held).`, 3000);

    this.panel.onEquip = (shoutId) => {
      if (!sh.equipShout(shoutId)) return;
      this._refreshPanel();
      const def = sh.getShout(shoutId);
      feedback().notify(`${def?.name ?? shoutId} ready: Shift+N to speak it.`, 2400);
      feedback().markDirty();
    };
    this.panel.onUnlockWord = (shoutId, wordIndex) => {
      if (!sh.unlockWord(shoutId, wordIndex)) {
        feedback().notify("You need awen to master that rank.", 2400);
      }
    };
    this.panel.onClose = () => modal().restoreGameplay();

    ctx.provide(ShoutsKey, {
      shouts: sh,
      panel: this.panel,
      togglePanel: () => {
        if (this.panel.isVisible) {
          this.panel.close();
          modal().restoreGameplay();
          return;
        }
        if (!s.get(GameplayKey).canAct()) return;
        this.panel.open(this._views(), sh.dragonSouls, sh.equippedShoutId);
        modal().suspendGameplay();
      },
      use: () => {
        if (!s.get(GameplayKey).canAct()) return;
        const result = sh.useShout(host().gameTime());
        if (result.success) return; // effects arrive through onShoutUsed
        switch (result.reason) {
          case "no_shout_equipped":
            feedback().notify("No word is ready: choose one in the words panel (N).", 2200);
            break;
          case "no_words_unlocked":
            feedback().notify("You have mastered no rank of that word yet: spend awen (N).", 2600);
            break;
          case "on_cooldown":
            feedback().notify(`Your voice needs ${Math.ceil(result.cooldownRemainingSeconds ?? 0)}s to recover.`, 1800);
            break;
          default:
            break;
        }
      },
      hostileTimeScale: () => this._timeScale,
      absorbDragonSoul: () => {
        sh.gainDragonSoul();
        this._learnNextWord();
        feedback().markDirty();
      },
      updateHud: () => {
        const id = sh.equippedShoutId;
        if (!id) { this.panel.updateHUD(null); return; }
        this.panel.updateHUD({
          name: sh.getShout(id)?.name ?? id,
          tier: sh.getUnlockedTier(id),
          cooldownSeconds: sh.cooldownRemaining(id, host().gameTime()),
        });
      },
    });

    // Great deeds bring awen and teach the next rank of a word: slaying a
    // dragon, or clearing a bandit camp (a roost pays through its dragon).
    ctx.on("player:kill", ({ npcId }) => {
      if (/^DragonBoss/.test(npcId)) s.get(ShoutsKey).absorbDragonSoul();
    });
    ctx.on("landmark:cleared", ({ id }) => {
      if (id.startsWith("site_bandit-camp_")) s.get(ShoutsKey).absorbDragonSoul();
    });
    // The old places teach: finding an obelisk (an old waymarker) teaches the
    // next rank of a word.  Mastering it still takes awen.
    ctx.on("location:discovered", ({ id }) => {
      if (!id.startsWith("site_obelisk_")) return;
      this._learnNextWord();
      feedback().markDirty();
    });

    ctx.system({ id: "shouts.buffs", phase: "sim", update: (dt) => this._tickBuffs(dt) });
    // The HUD chip (name, word pips, cooldown); updateHUD skips unchanged writes.
    ctx.system({ id: "shouts.hud", phase: "ui", update: () => s.get(ShoutsKey).updateHud() });

    ctx.scope.add(() => {
      sh.onShoutUsed = null;
      sh.onWordLearned = null;
      sh.onWordUnlocked = null;
      sh.onDragonSoulGained = null;
      if (this.panel.isVisible) this.panel.close();
      this._s = null;
    });
  }

  /** Learn the first rank not yet known, in catalogue order. */
  private _learnNextWord(): void {
    for (const def of this.shouts.getAllShouts()) {
      for (let i = 0 as 0 | 1 | 2; i < def.words.length; i = (i + 1) as 0 | 1 | 2) {
        if (!this.shouts.isWordLearned(def.id, i)) {
          this.shouts.learnWord(def.id, i);
          return;
        }
      }
    }
  }

  private _views(): ShoutView[] {
    return this.shouts.getAllShouts().map((def) => {
      const learned: boolean[] = [];
      const unlocked: boolean[] = [];
      for (let i = 0 as 0 | 1 | 2; i < def.words.length; i = (i + 1) as 0 | 1 | 2) {
        learned.push(this.shouts.isWordLearned(def.id, i));
        unlocked.push(this.shouts.isWordUnlocked(def.id, i));
      }
      return { def, learned, unlocked };
    });
  }

  private _refreshPanel(): void {
    this.panel.refresh(this._views(), this.shouts.dragonSouls, this.shouts.equippedShoutId);
  }

  /** A validated shout's tier effects, delivered to the world. */
  private _apply(shoutId: string, tier: ShoutTierEffect): void {
    const s = this._s;
    const def = this.shouts.getShout(shoutId);
    if (!s || !def) return;
    const host = s.get(ShoutHostKey);
    const fx = tier.effects;
    const words = def.words.slice(0, this.shouts.getUnlockedTier(shoutId)).map((w) => w!.word).join(" ");
    s.get(FeedbackKey).notify(`"${words}!" — ${tier.description}`, 2400);

    const { origin, forward } = host.stance();
    const inCone = (npc: NPC): boolean => {
      if (npc.isDead) return false;
      const dx = npc.mesh.position.x - origin.x, dz = npc.mesh.position.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist > REACH) return false;
      if (dist < 0.001) return true;
      return (forward.x * dx + forward.z * dz) / dist > CONE_COS;
    };
    // Re-checked per effect: an earlier effect may have killed someone.
    const inReach = () => host.targets().filter(inCone);

    if (fx.knockback_force) {
      const stagger = fx.stagger_duration ?? 1.0;
      const impulse = forward.scale(fx.knockback_force / 10);
      for (const npc of inReach()) {
        npc.physicsAggregate?.body?.applyImpulse(impulse, npc.mesh.position);
        npc.isStaggered = true;
        npc.isAttackTelegraphing = false;
        npc.attackTelegraphTimer = 0;
        npc.staggerTimer = stagger;
        if (fx.knockback_damage) host.damage(npc, fx.knockback_damage, "physical");
      }
    }

    if (fx.dash_distance) host.dash(Math.min(fx.dash_distance, MAX_DASH));

    if (fx.ethereal_duration) {
      host.addEffect({
        id: `shout_ethereal_${Date.now()}`,
        name: "Shade-step",
        effectType: "resist_damage",
        magnitude: 100,
        duration: fx.ethereal_duration,
      });
    }

    if (fx.fire_damage) {
      for (const npc of inReach()) {
        host.damage(npc, fx.fire_damage, "fire");
        if (fx.fire_dot_damage && fx.fire_dot_duration && !npc.isDead) {
          npc.applyStatusEffect({
            type: "burn", damagePerTick: fx.fire_dot_damage, tickInterval: 1, tickTimer: 1,
            remainingDuration: fx.fire_dot_duration,
          });
        }
      }
    }

    if (fx.freeze_duration) {
      // Ice Form freezes one opponent: the closest in the cone.
      let target: NPC | null = null;
      let best = Infinity;
      for (const npc of inReach()) {
        const d = Vector3.DistanceSquared(npc.mesh.position, origin);
        if (d < best) { best = d; target = npc; }
      }
      if (target) {
        target.applyStatusEffect({
          type: "freeze", damagePerTick: 0, tickInterval: 1, tickTimer: 1,
          remainingDuration: fx.freeze_duration,
        });
        target.isStaggered = true;
        target.isAttackTelegraphing = false;
        target.attackTelegraphTimer = 0;
        target.staggerTimer = fx.freeze_duration;
        if (fx.frost_damage) host.damage(target, fx.frost_damage, "frost");
      }
    }

    if (fx.time_scale && fx.slow_duration) {
      this._timeScale = fx.time_scale;
      this._slowTimeLeft = fx.slow_duration;
    }

    if (fx.attack_speed_mult && fx.attack_speed_duration) {
      host.setAttackSpeedMultiplier(fx.attack_speed_mult);
      this._furyLeft = fx.attack_speed_duration;
    }

    if (fx.clear_fog) host.clearWeather();
  }

  /** Expire Slow Time and Elemental Fury. */
  private _tickBuffs(dt: number): void {
    const s = this._s;
    if (!s) return;
    if (this._slowTimeLeft > 0) {
      this._slowTimeLeft = Math.max(0, this._slowTimeLeft - dt);
      if (this._slowTimeLeft === 0) {
        this._timeScale = 1;
        s.get(FeedbackKey).notify("Time resumes its flow.", 1600);
      }
    }
    if (this._furyLeft > 0) {
      this._furyLeft = Math.max(0, this._furyLeft - dt);
      if (this._furyLeft === 0) {
        s.get(ShoutHostKey).setAttackSpeedMultiplier(1);
        s.get(FeedbackKey).notify("The fury of the wind fades.", 1600);
      }
    }
  }
}
