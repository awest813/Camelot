/**
 * Followers as a kernel feature: the hireling roster (recruit, dismiss,
 * follow/wait orders) and the follower panel (G).
 *
 * Inputs:   services feedback, modal, gameplay, purse.
 * Outputs:  the `followers` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { FollowerSystem } from "../../systems/follower-system";
import { FollowerUI } from "../../ui/follower-ui";
import { FeedbackKey, GameplayKey, ModalKey, PurseKey } from "../services";

export interface FollowersService {
  readonly followers: FollowerSystem;
  readonly panel: FollowerUI;
  /** G: open or close the follower panel. */
  togglePanel(): void;
}

export const FollowersKey = createServiceKey<FollowersService>("followers");

export class FollowersFeature implements Feature {
  public readonly id = "followers";
  public readonly followers = new FollowerSystem();
  public readonly panel = new FollowerUI();

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    const notify = (text: string, ms: number) => s.get(FeedbackKey).notify(text, ms);
    const f = this.followers;

    f.onFollowerRecruited = (_id, name) => notify(`${name} has joined you.`, 3000);
    f.onFollowerDismissed = (_id, name, home) => notify(`${name} has returned to ${home}.`, 3000);
    f.onFollowerDied = (_id, name) => notify(`${name} has fallen in battle and cannot be rehired!`, 4000);
    f.onCommandIssued = (command) => notify(`Follower command: ${command}`, 1500);
    f.onFollowerDamaged = (_amount, remaining) => {
      if (remaining <= 0) notify("Your follower needs help!", 2000);
    };

    this.panel.onRecruit = (templateId) => {
      const purse = s.get(PurseKey);
      if (!f.recruitFollower(templateId, purse.gold())) return;
      const cost = f.getFollowerTemplate(templateId)?.hireCost ?? 0;
      if (cost > 0) purse.spend(cost);
      this._refresh();
    };
    this.panel.onDismiss = () => {
      f.dismissFollower();
      this._refresh();
    };
    this.panel.onCommand = (command) => {
      f.commandFollower(command);
      this._refresh();
    };
    this.panel.onClose = () => s.get(ModalKey).restoreGameplay();

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
        const v = this._view();
        this.panel.open(v.templates, v.active, v.deceased, this._gold());
        s.get(ModalKey).suspendGameplay();
      },
    });

    ctx.scope.add(() => {
      f.onFollowerRecruited = null;
      f.onFollowerDismissed = null;
      f.onFollowerDied = null;
      f.onCommandIssued = null;
      f.onFollowerDamaged = null;
      if (this.panel.isVisible) this.panel.close();
    });
  }

  private _gold: () => number = () => 0;

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
    this.panel.refresh(v.templates, v.active, v.deceased, this._gold());
    this.panel.updateHUD(v.active);
  }
}
