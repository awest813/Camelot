/**
 * Followers as a kernel feature: the hireling roster (recruit, dismiss,
 * follow/wait orders), the follower panel (G), and the hired follower's body
 * in the world, which walks after the player, strikes whoever is hostile
 * nearby and can be struck down.
 *
 * Hirelings are found at inns: asking the innkeeper ("followers:hire" from
 * dialogue) opens the panel with its Recruit buttons live; G alone manages
 * the one you have.
 *
 * Inputs:   services feedback, modal, gameplay, purse, player, actors,
 *           animation; `dialogue:action`, `dialogue:closed`, `save:loaded`.
 * Outputs:  the `followers` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext, ServiceRegistry } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import type { Scene } from "@babylonjs/core/scene";
import { simClock } from "../../core/sim-clock";
import { FollowerSystem, type FollowerCombatRole } from "../../systems/follower-system";
import type { FollowerUI } from "../../ui/follower-ui";
import { CompanionChip, followerChip } from "../../ui/companion-chip";
import { LazyPanel } from "../../ui/lazy-panel";
import { CompanionBody, COMPANION_CATCH_UP } from "../../entities/companion-body";
import type { NPC } from "../../entities/npc";
import { ActorsKey, AnimationKey, FeedbackKey, GameplayKey, LooksKey, ModalKey, PlayerKey, PurseKey, ownSave } from "../services";

/** How far each kind of fighter reaches (m), and seconds between blows. */
const REACH: Record<FollowerCombatRole, number> = { warrior: 2.6, rogue: 2.4, archer: 16, mage: 14 };
const BLOW_EVERY = 1.6;
/** A hostile this close (m) to the follower lands a blow on them every `STRUCK_EVERY` s. */
const STRUCK_REACH = 2.2;
const STRUCK_EVERY = 2;
/** The women of the roster (the rest wear the men's models). */
const WOMEN = new Set(["lynette"]);
/** Fighters wear mail; a mage goes in plain clothes. */
const MODEL: Record<FollowerCombatRole, "Ranger" | "Peasant"> = { warrior: "Ranger", archer: "Ranger", rogue: "Ranger", mage: "Peasant" };
const LOOKS: Record<FollowerCombatRole, { r: number; g: number; b: number }> = {
  warrior: { r: 0.45, g: 0.12, b: 0.1 }, archer: { r: 0.2, g: 0.36, b: 0.16 },
  mage: { r: 0.22, g: 0.2, b: 0.5 }, rogue: { r: 0.18, g: 0.16, b: 0.14 },
};

export interface FollowersService {
  readonly followers: FollowerSystem;
  readonly panel: LazyPanel<FollowerUI>;
  /** G: open or close the follower panel. */
  togglePanel(): void;
}

export const FollowersKey = createServiceKey<FollowersService>("followers");

export class FollowersFeature implements Feature {
  public readonly id = "followers";
  public readonly followers = new FollowerSystem();
  /** The follower panel (G), loaded the first time it opens. */
  public readonly panel = new LazyPanel<FollowerUI>(async () => {
    const { FollowerUI } = await import("../../ui/follower-ui");
    const panel = new FollowerUI();
    this._wirePanel?.(panel);
    return panel;
  });
  /** The active follower's HUD chip. */
  public readonly hud = new CompanionChip(2);
  private _wirePanel: ((panel: FollowerUI) => void) | null = null;
  private _body: CompanionBody | null = null;
  private _blowTimer = 0;
  private _struckTimer = STRUCK_EVERY;
  private _hireAfterTalk = false;
  /** Whether the open panel was opened at an inn (Recruit is live). */
  private _hiring = false;

  constructor(private readonly _scene: Scene | null = null) {}

  /** The follower's body in the world, when one is hired and out. */
  public get body(): CompanionBody | null { return this._body; }

  public install(ctx: FeatureContext): void {
    ownSave(ctx, { key: "follower", save: () => this.followers.getSaveState(), load: (data) => { if (data) this.followers.restoreFromSave(data as never); } });
    const s = ctx.kernel.services;
    const notify = (text: string, ms: number) => s.get(FeedbackKey).notify(text, ms);
    const f = this.followers;

    f.onFollowerRecruited = (_id, name) => { notify(`${name} has joined you.`, 3000); this._spawn(s); };
    f.onFollowerDismissed = (_id, name, home) => { notify(`${name} has returned to ${home}.`, 3000); this._despawn(s); };
    f.onFollowerDied = (_id, name) => {
      notify(`${name} has fallen in battle and cannot be rehired!`, 4000);
      const body = this._body;
      this._body = null;
      if (!body) return;
      body.freeze();
      s.tryGet(AnimationKey)?.death(body.mesh);
      simClock.after(3000, () => { s.tryGet(AnimationKey)?.release(body.mesh); body.dispose(); });
    };
    f.onCommandIssued = (command) => notify(`Follower command: ${command}`, 1500);
    f.onFollowerDamaged = (_amount, remaining) => {
      if (remaining <= 0) notify("Your follower needs help!", 2000);
    };

    this._wirePanel = (panel) => {
      panel.onRecruit = (templateId) => {
        if (!this._hiring) return;
        const purse = s.get(PurseKey);
        if (!f.recruitFollower(templateId, purse.gold())) return;
        const cost = f.getFollowerTemplate(templateId)?.hireCost ?? 0;
        if (cost > 0) purse.spend(cost);
        this._refresh();
      };
      panel.onDismiss = () => {
        f.dismissFollower();
        this._refresh();
      };
      panel.onCommand = (command) => {
        f.commandFollower(command);
        this._refresh();
      };
      panel.onClose = () => s.get(ModalKey).restoreGameplay();
    };
    const open = (hiring: boolean) => {
      this._hiring = hiring;
      s.get(ModalKey).suspendGameplay();
      void this.panel.get().then((panel) => {
        const v = this._view();
        panel.open(v.templates, v.active, v.deceased, this._gold(), hiring);
      });
    };
    ctx.on("dialogue:action", ({ eventId }) => { if (eventId === "followers:hire") this._hireAfterTalk = true; });
    ctx.on("dialogue:closed", () => {
      if (!this._hireAfterTalk) return;
      this._hireAfterTalk = false;
      if (!this.panel.isVisible) open(true);
    });
    // A follower kept in the save walks out with the player again.
    ctx.on("save:loaded", () => { if (f.getActiveFollower()?.isAlive) this._spawn(s); else this._despawn(s); });

    this._gold = () => s.get(PurseKey).gold();
    ctx.provide(FollowersKey, {
      followers: f,
      panel: this.panel,
      togglePanel: () => {
        if (this.panel.isVisible) {
          this.panel.close();
          s.get(ModalKey).restoreGameplay();
          return;
        }
        if (!s.get(GameplayKey).canAct()) return;
        open(false);
      },
    });

    ctx.system({ id: "followers.ai", phase: "sim", update: (dt) => this._updateAI(s, dt) });

    // The follower HUD chip, redrawn when the follower, their health or their order changes.
    let hudKey = "";
    ctx.system({
      id: "followers.hud", phase: "ui", update: () => {
        const active = f.getActiveFollower();
        const key = active ? `${active.templateId}|${active.health}|${active.command}` : "";
        if (key === hudKey) return;
        hudKey = key;
        this.hud.show(active && followerChip(active, f.getFollowerTemplate(active.templateId)?.combatRole));
      },
    });

    ctx.scope.add(() => {
      this._despawn(s);
      f.onFollowerRecruited = null;
      f.onFollowerDismissed = null;
      f.onFollowerDied = null;
      f.onCommandIssued = null;
      f.onFollowerDamaged = null;
      if (this.panel.isVisible) this.panel.close();
    });
  }

  private _gold: () => number = () => 0;

  private _spawn(s: ServiceRegistry): void {
    this._despawn(s);
    const active = this.followers.getActiveFollower();
    const tmpl = active && this.followers.getFollowerTemplate(active.templateId);
    if (!this._scene || !active || !tmpl) return;
    const p = s.get(PlayerKey).position();
    this._body = new CompanionBody(this._scene, {
      // An NPC's height, so a character model stands on the ground.
      name: `follower_${tmpl.id}`, radius: 0.4, height: 2, color: LOOKS[tmpl.combatRole],
    }, { x: p.x - 1.5, y: Math.max(1.5, (p.y ?? 2) - 0.5), z: p.z - 1.5 });
    this._blowTimer = 0;
    this._struckTimer = STRUCK_EVERY;
    s.tryGet(LooksKey)?.dress(this._body.mesh, `${MODEL[tmpl.combatRole]}_${WOMEN.has(tmpl.id) ? "Female" : "Male"}`);
    s.tryGet(AnimationKey)?.idle(this._body.mesh);
  }

  private _despawn(s: ServiceRegistry): void {
    if (!this._body) return;
    s.tryGet(AnimationKey)?.release(this._body.mesh);
    this._body.dispose();
    this._body = null;
  }

  /** Walk after the player (unless told to wait), strike the nearest hostile, take their blows. */
  private _updateAI(s: ServiceRegistry, dt: number): void {
    const active = this.followers.getActiveFollower();
    const body = this._body;
    if (!active || !active.isAlive || !body) return;
    const tmpl = this.followers.getFollowerTemplate(active.templateId);
    const role = tmpl?.combatRole ?? "warrior";
    const anim = s.tryGet(AnimationKey);
    const p = s.get(PlayerKey).position();
    const at = body.position;
    if (active.command !== "wait") {
      const dx = p.x - at.x, dz = p.z - at.z;
      if (dx * dx + dz * dz > COMPANION_CATCH_UP * COMPANION_CATCH_UP) {
        body.placeAt({ x: p.x - 1.5, y: Math.max(1.5, (p.y ?? 2) - 0.5), z: p.z - 1.5 });
      }
      const gait = body.steer(p, 3, 6, dt);
      if (anim) anim[gait](body.mesh);
    } else {
      body.stop();
      anim?.idle(body.mesh);
    }

    let target: NPC | null = null;
    let best = REACH[role] * REACH[role];
    let near: NPC | null = null;
    let nearBest = STRUCK_REACH * STRUCK_REACH;
    for (const npc of s.get(ActorsKey).hostiles()) {
      const ex = npc.mesh.position.x - at.x, ez = npc.mesh.position.z - at.z;
      const d = ex * ex + ez * ez;
      if (d < best) { best = d; target = npc; }
      if (d < nearBest) { nearBest = d; near = npc; }
    }
    this._blowTimer -= dt;
    if (target && this._blowTimer <= 0) {
      body.face(target.mesh.position.x, target.mesh.position.z);
      target.takeDamage(active.attackDamage);
      this._blowTimer = BLOW_EVERY;
    }
    this._struckTimer -= dt;
    if (near && this._struckTimer <= 0) {
      this._struckTimer = STRUCK_EVERY;
      this.followers.followerTakeDamage(Math.max(1, near.attackDamage));
    } else if (!near) {
      this._struckTimer = Math.max(this._struckTimer, 0.5);
    }
  }

  private _view() {
    const f = this.followers;
    const ids = f.registeredTemplateIds;
    return {
      active: f.getActiveFollower(),
      deceased: ids.filter((id) => f.isFollowerDeceased(id)),
      templates: ids.map((id) => f.getFollowerTemplate(id)).filter((t): t is NonNullable<typeof t> => t !== undefined),
    };
  }

  private _refresh(): void {
    const v = this._view();
    this.panel.current?.refresh(v.templates, v.active, v.deceased, this._gold(), this._hiring);
  }
}
