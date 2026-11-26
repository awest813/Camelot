// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PauseMenuView, type PauseActions } from "./pause-menu";

function actions(savedAt: number | null): PauseActions & Record<string, ReturnType<typeof vi.fn>> {
  return {
    resume: vi.fn(), save: vi.fn(), load: vi.fn(), exportSave: vi.fn(), importSave: vi.fn(),
    settings: vi.fn(), credits: vi.fn(), quit: vi.fn(), savedAt: vi.fn(() => savedAt),
  } as never;
}
const button = (text: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>(".pause-menu button")).find((b) => b.textContent === text)!;
/** Click and let Preact re-render. */
const press = (text: string) => act(() => button(text).click());
const text = () => document.querySelector(".pause-menu")?.textContent ?? "";

describe("PauseMenu", () => {
  const view = new PauseMenuView();
  afterEach(() => view.close());

  it("says when the game was last saved", () => {
    act(() => view.open(actions(Date.now() - 5 * 60_000)));
    expect(text()).toContain("Last saved 5 minutes ago.");
  });

  it("quitting asks first: save and quit, quit, or back", () => {
    const a = actions(Date.now() - 2 * 60_000);
    act(() => view.open(a));
    press("Quit to Menu");
    expect(a.quit).not.toHaveBeenCalled();
    expect(text()).toContain("Anything done since the last save (2 minutes ago) will be lost.");
    expect(document.activeElement, "the first answer has focus").toBe(button("Save and quit"));
    press("Back");
    expect(document.querySelector(".pause-menu__confirm")).toBeNull();
    press("Quit to Menu");
    press("Save and quit");
    expect(a.save).toHaveBeenCalledOnce();
    expect(a.quit).toHaveBeenCalledOnce();
  });

  it("Escape in the question goes back to the menu, not to play", () => {
    const a = actions(Date.now());
    act(() => view.open(a));
    press("Load Game");
    act(() => { document.querySelector(".pause-menu__confirm-btn")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(a.resume).not.toHaveBeenCalled();
    expect(document.querySelector(".pause-menu__items")).not.toBeNull();
  });

  it("loading asks first; with no save, Load Game is disabled", () => {
    const a = actions(Date.now());
    act(() => view.open(a));
    press("Load Game");
    press("Load");
    expect(a.load).toHaveBeenCalledOnce();
    view.close();
    act(() => view.open(actions(null)));
    expect(button("Load Game").disabled).toBe(true);
    expect(text()).toContain("This tale has not been saved.");
  });

  it("saving updates the note", () => {
    let at: number | null = null;
    const a = { ...actions(null), savedAt: () => at, save: vi.fn(() => { at = Date.now(); }) };
    act(() => view.open(a));
    press("Save Game");
    expect(text()).toContain("Last saved just now.");
  });
});
