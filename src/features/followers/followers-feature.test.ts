import { describe, it, expect, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey, GameplayKey, ModalKey, PurseKey } from "../services";
import { FollowersFeature, FollowersKey } from "./followers-feature";

function setup(gold = 600) {
  const k = new Kernel();
  const notes: string[] = [];
  let purse = gold;
  let canAct = true;
  const modal = { suspendGameplay: vi.fn(), restoreGameplay: vi.fn() };
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.services.provide(ModalKey, modal);
  k.services.provide(GameplayKey, { canAct: () => canAct });
  k.services.provide(PurseKey, {
    gold: () => purse,
    spend: (n) => { if (purse < n) return false; purse -= n; return true; },
  });
  k.install(new FollowersFeature());
  return { k, notes, modal, f: k.services.get(FollowersKey), gold: () => purse, block: () => { canAct = false; } };
}

describe("FollowersFeature (headless, through the kernel)", () => {
  it("G opens the panel; hiring a mercenary costs gold; orders and dismissal notify", () => {
    const t = setup(600);
    t.f.togglePanel();
    expect(t.f.panel.isVisible).toBe(true);
    expect(t.modal.suspendGameplay).toHaveBeenCalledOnce();

    t.f.panel.onRecruit!("dagonet");
    expect(t.gold()).toBe(100);
    expect(t.f.followers.getActiveFollower()?.name).toBe("Sir Dagonet");
    expect(t.notes.at(-1)).toBe("Sir Dagonet has joined you.");

    t.f.panel.onCommand!("wait");
    expect(t.notes.at(-1)).toBe("Follower command: wait");
    t.f.panel.onDismiss!();
    expect(t.f.followers.getActiveFollower()).toBeNull();
    expect(t.notes.at(-1)).toMatch(/^Sir Dagonet has returned to /);

    t.f.togglePanel();
    expect(t.f.panel.isVisible).toBe(false);
    expect(t.modal.restoreGameplay).toHaveBeenCalled();
    t.k.uninstall("followers");
  });

  it("a hire the purse can't cover takes nothing", () => {
    const t = setup(100);
    t.f.panel.onRecruit!("dagonet");
    expect(t.gold()).toBe(100);
    expect(t.f.followers.getActiveFollower()).toBeNull();
    t.k.uninstall("followers");
  });

  it("does not open while gameplay is blocked", () => {
    const t = setup();
    t.block();
    t.f.togglePanel();
    expect(t.f.panel.isVisible).toBe(false);
    t.k.uninstall("followers");
  });
});
