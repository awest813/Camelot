// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShoutUI, type ShoutView } from "./shout-ui";
import type { ShoutDefinition } from "../systems/dragon-shout-system";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeWord(dragonWord: string, translation: string) {
  return { dragonWord, translation };
}

function makeShoutDef(overrides: Partial<ShoutDefinition> = {}): ShoutDefinition {
  return {
    id: "unrelenting_force",
    name: "Unrelenting Force",
    description: "Your Voice is raw power.",
    words: [
      makeWord("FUS", "Force"),
      makeWord("RO", "Balance"),
      makeWord("DAH", "Push"),
    ],
    tiers: [
      { description: "Staggers nearby enemies.", cooldownSeconds: 2, effects: { knockback_force: 50 } },
      { description: "Blasts enemies away.", cooldownSeconds: 5, effects: { knockback_force: 120, stagger_duration: 1.5 } },
      { description: "Sends enemies flying.", cooldownSeconds: 15, effects: { knockback_force: 250, stagger_duration: 3.0, knockback_damage: 10 } },
    ],
    ...overrides,
  };
}

function makeView(overrides: {
  def?: ShoutDefinition;
  learned?: boolean[];
  unlocked?: boolean[];
} = {}): ShoutView {
  return {
    def: overrides.def ?? makeShoutDef(),
    learned: overrides.learned ?? [false, false, false],
    unlocked: overrides.unlocked ?? [false, false, false],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ShoutUI", () => {
  let ui: ShoutUI;

  beforeEach(() => {
    document.body.innerHTML = "";
    ui = new ShoutUI();
  });

  // ── Panel lifecycle ─────────────────────────────────────────────────────────

  it("open() shows the panel and sets isVisible", () => {
    ui.open([makeView()], 2, null);
    expect(ui.isVisible).toBe(true);
    const panel = document.querySelector(".shout-ui") as HTMLDivElement;
    expect(panel).not.toBeNull();
    expect(panel.style.display).toBe("flex");
  });

  it("close() hides the panel and clears isVisible", () => {
    ui.open([makeView()], 2, null);
    ui.close();
    expect(ui.isVisible).toBe(false);
    const panel = document.querySelector(".shout-ui") as HTMLDivElement;
    expect(panel.style.display).toBe("none");
  });

  it("refresh() re-renders while open but is a no-op while closed", () => {
    ui.open([makeView()], 0, null);
    ui.refresh([makeView()], 3, null);
    const souls = document.querySelector('[aria-label="Dragon souls"]') as HTMLSpanElement;
    expect(souls.textContent).toContain("3");

    ui.close();
    // Must not throw while closed.
    expect(() => ui.refresh([makeView()], 1, null)).not.toThrow();
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  it("renders every shout with its name and description", () => {
    const shoutA = makeView();
    const shoutB = makeView({
      def: makeShoutDef({ id: "fire_breath", name: "Fire Breath", description: "Exhale flame." }),
    });
    ui.open([shoutA, shoutB], 0, null);
    const text = (document.querySelector(".shout-ui") as HTMLDivElement).textContent ?? "";
    expect(text).toContain("Unrelenting Force");
    expect(text).toContain("Your Voice is raw power.");
    expect(text).toContain("Fire Breath");
    expect(text).toContain("Exhale flame.");
  });

  it("shows the dragon soul count", () => {
    ui.open([makeView()], 4, null);
    const souls = document.querySelector('[aria-label="Dragon souls"]') as HTMLSpanElement;
    expect(souls.textContent).toContain("4");
  });

  it("masks unknown words and reveals learned/unlocked words", () => {
    const view = makeView({ learned: [true, false, false], unlocked: [true, false, false] });
    ui.open([view], 0, null);
    const text = (document.querySelector(".shout-ui") as HTMLDivElement).textContent ?? "";
    expect(text).toContain("FUS · Force");     // unlocked → revealed
    expect(text).toContain("??? · Unknown");   // unknown words masked
    expect(text).not.toContain("RO · Balance");
  });

  it("shows an empty-state message when no shouts are provided", () => {
    ui.open([], 0, null);
    const text = (document.querySelector(".shout-ui") as HTMLDivElement).textContent ?? "";
    expect(text).toContain("No shouts are known to you yet.");
  });

  // ── Equip interaction ───────────────────────────────────────────────────────

  it("Equip button fires onEquip with the shout id", () => {
    const onEquip = vi.fn();
    ui.onEquip = onEquip;
    ui.open([makeView()], 0, null);

    const btn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent === "Equip") as HTMLButtonElement;
    expect(btn).toBeDefined();
    btn.click();
    expect(onEquip).toHaveBeenCalledWith("unrelenting_force");
  });

  it("the equipped shout is badged and its Equip button is inert", () => {
    const onEquip = vi.fn();
    ui.onEquip = onEquip;
    ui.open([makeView()], 0, "unrelenting_force");

    const text = (document.querySelector(".shout-ui") as HTMLDivElement).textContent ?? "";
    expect(text).toContain("EQUIPPED");

    const btn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent === "Equipped") as HTMLButtonElement;
    expect(btn).toBeDefined();
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    btn.click();
    expect(onEquip).not.toHaveBeenCalled();
  });

  // ── Unlock interaction ──────────────────────────────────────────────────────

  it("shows an Unlock button for a learned-but-locked word and fires onUnlockWord", () => {
    const onUnlockWord = vi.fn();
    ui.onUnlockWord = onUnlockWord;
    ui.open([makeView({ learned: [true, false, false] })], 1, null);

    const btn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent?.includes("Unlock FUS")) as HTMLButtonElement;
    expect(btn).toBeDefined();
    btn.click();
    expect(onUnlockWord).toHaveBeenCalledWith("unrelenting_force", 0);
  });

  it("disables the Unlock button when the player has no souls", () => {
    ui.open([makeView({ learned: [true, false, false] })], 0, null);
    const btn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent?.includes("Unlock FUS")) as HTMLButtonElement;
    expect(btn).toBeDefined();
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.style.cursor).toBe("not-allowed");
  });

  it("shows the word-wall hint instead of an Unlock button for undiscovered words", () => {
    ui.open([makeView({ learned: [false, false, false] })], 5, null);
    const text = (document.querySelector(".shout-ui") as HTMLDivElement).textContent ?? "";
    expect(text).toContain("Next word awaits at a Word Wall");
    const unlockBtn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent?.includes("Unlock"));
    expect(unlockBtn).toBeUndefined();
  });

  // ── Close interactions ──────────────────────────────────────────────────────

  it("close button fires onClose", () => {
    const onClose = vi.fn();
    ui.onClose = onClose;
    ui.open([makeView()], 0, null);
    (document.querySelector('[aria-label="Close shouts panel"]') as HTMLButtonElement).click();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(ui.isVisible).toBe(false);
  });

  it("Escape inside the panel closes it and fires onClose", () => {
    const onClose = vi.fn();
    ui.onClose = onClose;
    ui.open([makeView()], 0, null);
    const panel = document.querySelector(".shout-ui") as HTMLDivElement;
    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(ui.isVisible).toBe(false);
  });

  // ── HUD chip ────────────────────────────────────────────────────────────────

  it("updateHUD(null) hides the chip", () => {
    ui.updateHUD(null);
    // Chip element is not even created for a null update before any show.
    const chip = document.querySelector('[aria-label="Equipped shout"]');
    expect(chip).toBeNull();
  });

  it("updateHUD shows name, tier pips, and READY state", () => {
    ui.updateHUD({ name: "Unrelenting Force", tier: 2, cooldownSeconds: 0 });
    const chip = document.querySelector('[aria-label="Equipped shout"]') as HTMLDivElement;
    expect(chip.style.display).toBe("flex");
    expect(chip.textContent).toContain("Unrelenting Force");
    expect(chip.textContent).toContain("READY");
    expect(chip.textContent).toContain("◆◆◇");
  });

  it("updateHUD shows a ceil-ed cooldown countdown while recovering", () => {
    ui.updateHUD({ name: "Fire Breath", tier: 1, cooldownSeconds: 4.2 });
    const chip = document.querySelector('[aria-label="Equipped shout"]') as HTMLDivElement;
    expect(chip.textContent).toContain("5s");
    expect(chip.textContent).not.toContain("READY");
  });

  it("updateHUD skips DOM writes when the state is unchanged", () => {
    ui.updateHUD({ name: "Fire Breath", tier: 1, cooldownSeconds: 4.2 });
    const chip = document.querySelector('[aria-label="Equipped shout"]') as HTMLDivElement;
    const before = chip.innerHTML;
    ui.updateHUD({ name: "Fire Breath", tier: 1, cooldownSeconds: 4.1 });
    expect(chip.innerHTML).toBe(before); // same ceil bucket (5s) → no write
  });
});
