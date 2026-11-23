/**
 * First-run tips as a kernel feature: five short steps (move, inventory,
 * interact, sneak, quests) in a banner.  Each advances when the player does
 * the thing it teaches, or on Space when nothing else owns the screen.
 *
 * Inputs:   services onboarding-host, feedback; event `questlog:opened`.
 * Outputs:  the `onboarding` service.
 *
 * Extracted from game.ts (engine overhaul, Phase 1).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { TutorialSystem } from "../../systems/tutorial-system";
import { hasCompletedOnboardingTips, persistOnboardingTipsCompleted, shouldSkipOnboardingTips } from "../../onboarding-preferences";
import { FeedbackKey } from "../services";

export type OnboardingStepId = "move" | "inventory" | "interact" | "sneak" | "quests";

export const ONBOARDING_STEPS: ReadonlyArray<{ id: OnboardingStepId; message: string; advanceHint: string }> = [
  { id: "move", message: "Move with W A S D and look with the mouse. Click the game view if the cursor does not turn.", advanceHint: "Press Space when you have tried moving." },
  { id: "inventory", message: "Press I to open your inventory. Equip gear from there when you find items in the world.", advanceHint: "Open inventory with I, or press Space to skip ahead." },
  { id: "interact", message: "Face loot or a friendly NPC and press E to take items or start a conversation.", advanceHint: "Use E on something, or press Space to continue." },
  { id: "sneak", message: "Press C to crouch and sneak. Stay undetected and press E behind an NPC to pickpocket.", advanceHint: "Try crouching with C, or press Space to continue." },
  { id: "quests", message: "Press J to open the quest log and track objectives.", advanceHint: "Open the log with J, or press Space to finish tips." },
];

export interface OnboardingHostService {
  /** Nothing (pause, a menu, a conversation, the editor) owns the screen. */
  screenFree(): boolean;
}

export interface OnboardingService {
  /** Start the tips for a new player (no-op when done or turned off). */
  start(): void;
  /** Space: advance a tip; true when Space was used for that. */
  space(): boolean;
  /** The player did what `step` teaches. */
  did(step: OnboardingStepId): void;
  readonly active: boolean;
}

export const OnboardingHostKey = createServiceKey<OnboardingHostService>("onboarding-host");
export const OnboardingKey = createServiceKey<OnboardingService>("onboarding");

export class OnboardingFeature implements Feature {
  public readonly id = "onboarding";
  public readonly tips = new TutorialSystem();
  private _banner: HTMLDivElement | null = null;

  public install(ctx: FeatureContext): void {
    const s = ctx.kernel.services;
    const t = this.tips;
    t.onStepBegin = (_i, step) => this._show(step.message, step.advanceHint);
    t.onTutorialComplete = () => {
      this._hide();
      persistOnboardingTipsCompleted();
      s.get(FeedbackKey).notify("Tutorial tips dismissed. Press Esc for pause anytime.", 3200);
    };
    t.onTutorialSkipped = () => this._hide();

    const did = (step: OnboardingStepId) => {
      if (t.isActive && t.currentStep?.id === step) t.advance();
    };
    ctx.on("questlog:opened", () => did("quests"));
    ctx.on("pickpocket:opened", () => did("sneak"));

    ctx.provide(OnboardingKey, {
      get active() { return t.isActive; },
      did,
      space: () => {
        if (!t.isActive || !s.get(OnboardingHostKey).screenFree()) return false;
        t.advance();
        return true;
      },
      start: () => {
        if (typeof document === "undefined") return;
        if (shouldSkipOnboardingTips() || hasCompletedOnboardingTips()) return;
        t.clearSteps();
        for (const step of ONBOARDING_STEPS) t.addStep({ ...step });
        t.start();
      },
    });

    ctx.scope.add(() => {
      t.onStepBegin = t.onTutorialComplete = t.onTutorialSkipped = null;
      this._hide();
    });
  }

  private _show(message: string, advanceHint?: string): void {
    if (typeof document === "undefined") return;
    this._hide();
    const wrap = document.createElement("div");
    wrap.className = "onboarding-tip";
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-live", "polite");
    const line = (cls: string, text: string) => {
      const p = document.createElement("p");
      p.className = cls;
      p.textContent = text;
      wrap.appendChild(p);
    };
    line("onboarding-tip__title", "Getting started");
    line("onboarding-tip__msg", message);
    line("onboarding-tip__hint", advanceHint?.trim() || "Press Space to continue when you are ready (or perform the highlighted action).");
    document.body.appendChild(wrap);
    this._banner = wrap;
  }

  private _hide(): void {
    this._banner?.remove();
    this._banner = null;
  }
}
