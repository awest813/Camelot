import { describe, expect, it, vi } from "vitest";
import { Kernel } from "../../core/kernel";
import { TitleHostKey, type TitleHostService } from "../services";
import { TitleFeature, TitleKey } from "./title-feature";
import { savedAgo } from "../../ui/title-screen";

function setup(over: Partial<TitleHostService> = {}) {
  const k = new Kernel();
  const calls: string[] = [];
  const host: TitleHostService = {
    savedGame: () => null,
    hold: (on) => { calls.push(on ? "hold" : "release"); },
    continueGame: () => { calls.push("continue"); return true; },
    newGame: () => { calls.push("new"); },
    settings: vi.fn(), credits: vi.fn(), quit: null, skip: () => false,
    ...over,
  };
  k.services.provide(TitleHostKey, host);
  k.install(new TitleFeature());
  const items = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".title-screen__item"));
  const labels = () => items().map((b) => b.querySelector(".title-screen__label")!.textContent);
  return { k, calls, host, title: k.services.get(TitleKey), items, labels };
}

describe("TitleFeature", () => {
  it("opens over a held game; New Game lets go and starts the character creator", () => {
    const t = setup();
    t.title.show();
    expect(t.title.isOpen).toBe(true);
    expect(t.calls).toEqual(["hold"]);
    expect(t.labels(), "no save: no Continue; no Quit in the browser").toEqual(["New Game", "Settings", "Credits"]);
    expect(document.activeElement, "the first line has focus").toBe(t.items()[0]);
    expect(document.body.classList.contains("is-title"), "the HUD hides behind the cover").toBe(true);
    t.items()[0].click();
    expect(t.calls).toEqual(["hold", "release", "new"]);
    expect(document.querySelector(".title-screen")).toBeNull();
    expect(document.body.classList.contains("is-title")).toBe(false);
    t.k.uninstall("title");
  });

  it("a save from another version isn't offered; the title says so", () => {
    const t = setup({ savedGame: () => ({ name: "Gawain", level: 4, savedAt: 1, old: true }) });
    t.title.show();
    expect(t.labels()).toEqual(["New Game", "Settings", "Credits"]);
    expect(document.querySelector(".title-screen__note")?.textContent).toContain("The saved tale of Gawain is from another version of Camelot");
    t.k.uninstall("title");
  });

  it("Continue names the saved hero and loads; a save that won't load starts a new game", () => {
    const t = setup({ savedGame: () => ({ name: "Gawain", level: 4, savedAt: Date.now() - 3 * 3_600_000 }), quit: () => {} });
    t.title.show();
    expect(t.labels()).toEqual(["Continue", "New Game", "Settings", "Credits", "Quit"]);
    expect(t.items()[0].querySelector(".title-screen__detail")!.textContent).toBe("Gawain · Level 4 · saved 3 hours ago");
    t.items()[0].click();
    expect(t.calls).toEqual(["hold", "release", "continue"]);
    t.k.uninstall("title");

    const u = setup({ savedGame: () => ({ name: "X", level: 1, savedAt: 0 }), continueGame: () => false });
    u.title.show();
    u.items()[0].click();
    expect(u.calls).toEqual(["hold", "release", "new"]);
    u.k.uninstall("title");
  });

  it("arrow keys move between the lines; settings and credits keep the title up", () => {
    const t = setup();
    t.title.show();
    const root = document.querySelector<HTMLElement>(".title-screen")!;
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(t.items()[1]);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(document.activeElement, "wraps around").toBe(t.items()[2]);
    t.items()[1].click();
    expect(t.host.settings).toHaveBeenCalledOnce();
    expect(t.title.isOpen).toBe(true);
    t.k.uninstall("title");
    expect(document.querySelector(".title-screen"), "uninstall closes it").toBeNull();
  });

  it("replays skip it and go straight to a new game", () => {
    const t = setup({ skip: () => true });
    t.title.show();
    expect(t.calls).toEqual(["new"]);
    expect(t.title.isOpen).toBe(false);
    t.k.uninstall("title");
  });

  it("savedAgo reads naturally", () => {
    const now = 1_000_000_000;
    expect([0, 59_000, 60_000, 25 * 60_000, 3_600_000, 26 * 3_600_000].map((d) => savedAgo(now - d, now)))
      .toEqual(["just now", "1 minute ago", "1 minute ago", "25 minutes ago", "1 hour ago", "1 day ago"]);
  });
});
