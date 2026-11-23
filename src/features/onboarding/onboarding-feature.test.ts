import { describe, it, expect, vi, beforeEach } from "vitest";
import { Kernel } from "../../core/kernel";
import { FeedbackKey } from "../services";
import { ONBOARDING_DONE_STORAGE_KEY, ONBOARDING_SKIP_STORAGE_KEY } from "../../onboarding-preferences";
import { OnboardingFeature, OnboardingHostKey, OnboardingKey } from "./onboarding-feature";

function setup(free = true) {
  const k = new Kernel();
  const notes: string[] = [];
  let screenFree = free;
  k.services.provide(OnboardingHostKey, { screenFree: () => screenFree });
  k.services.provide(FeedbackKey, { notify: (t) => { notes.push(t); }, grant: vi.fn(), addFame: vi.fn(), markDirty: vi.fn() });
  k.install(new OnboardingFeature());
  const banner = () => document.querySelector(".onboarding-tip__msg")?.textContent ?? null;
  return { k, notes, tips: k.services.get(OnboardingKey), banner, busy: () => { screenFree = false; } };
}

describe("OnboardingFeature (headless, through the kernel)", () => {
  beforeEach(() => localStorage.clear());

  it("walks the five tips: actions advance their own step; Space advances any", () => {
    const t = setup();
    t.tips.start();
    expect(t.banner()).toMatch(/W A S D/);
    t.tips.did("quests"); // not the current step: nothing happens
    expect(t.banner()).toMatch(/W A S D/);
    expect(t.tips.space()).toBe(true);
    t.tips.did("inventory");
    t.tips.did("interact");
    t.k.events.emit("pickpocket:opened", { npcName: "x" });
    expect(t.banner()).toMatch(/quest log/);
    t.k.events.emit("questlog:opened", {});
    expect(t.tips.active).toBe(false);
    expect(t.banner()).toBeNull();
    expect(localStorage.getItem(ONBOARDING_DONE_STORAGE_KEY)).toBe("1");
    expect(t.notes.at(-1)).toMatch(/Tutorial tips dismissed/);
    t.k.uninstall("onboarding");
  });

  it("Space doesn't skip a tip while a menu owns the screen", () => {
    const t = setup();
    t.tips.start();
    t.busy();
    expect(t.tips.space()).toBe(false);
    expect(t.banner()).toMatch(/W A S D/);
    t.k.uninstall("onboarding");
    expect(t.banner(), "the banner goes with the feature").toBeNull();
  });

  it("doesn't start when turned off or already done", () => {
    localStorage.setItem(ONBOARDING_SKIP_STORAGE_KEY, "1");
    const t = setup();
    t.tips.start();
    expect(t.tips.active).toBe(false);
    t.k.uninstall("onboarding");
  });
});
