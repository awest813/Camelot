import { describe, it, expect, vi, afterEach } from "vitest";
import { WaitDialogPanel } from "./wait-dialog";
import { AttributePanelView } from "./attribute-panel";
import { QuestLogView } from "./quest-log-panel";
import { AttributeSystem } from "../systems/attribute-system";
import type { Quest } from "../systems/quest-system";

const byText = (t: string) => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === t)!;
const byLabel = (t: string) => document.querySelector<HTMLElement>(`[aria-label="${t}"]`)!;
afterEach(() => { document.body.innerHTML = ""; });

describe("WaitDialogPanel", () => {
  it("picks 1–24 hours (buttons, arrow keys, slider), waits or cancels, and remembers the choice", () => {
    const panel = new WaitDialogPanel();
    const waited: number[] = [];
    const cancel = vi.fn();
    panel.open({ onWait: (h) => waited.push(h), onCancel: cancel });
    expect(document.querySelector("output")!.textContent).toBe("8 h");
    byLabel("Increase wait time").click();
    byLabel("Increase wait time").click();
    expect(document.querySelector("output")!.textContent).toBe("10 h");
    const selector = document.querySelector(".wait-dialog__selector")!;
    selector.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(panel.hours).toBe(9);
    const range = byLabel("Hours to wait") as HTMLInputElement;
    range.value = "30";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    expect(panel.hours, "clamped").toBe(24);
    expect((byLabel("Increase wait time") as HTMLButtonElement).disabled).toBe(true);
    byText("Wait").click();
    expect(waited).toEqual([24]);
    byText("Cancel").click();
    expect(cancel).toHaveBeenCalledOnce();
    panel.close();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    panel.open({ onWait: () => {}, onCancel: () => {} });
    expect(document.querySelector("output")!.textContent, "remembered").toBe("24 h");
  });
});

describe("AttributePanelView", () => {
  it("lists every attribute with its effect; +1 spends only while points wait", () => {
    const attrs = new AttributeSystem();
    const spent: string[] = [];
    const view = new AttributePanelView();
    view.open({ onSpend: (n) => spent.push(n), onClose: () => {} });
    view.refresh(attrs);
    const rows = document.querySelectorAll(".attribute-panel__table tr");
    expect(rows).toHaveLength(7);
    expect(rows[0].textContent).toMatch(/Strength.*Dmg \+/);
    expect((byLabel("Need points to increase Strength") as HTMLButtonElement).disabled).toBe(true);
    (attrs as unknown as { pendingPoints: number }).pendingPoints = 2;
    view.refresh(attrs);
    expect(document.querySelector(".craft-panel__subtitle")!.textContent).toBe("Points available: 2");
    byLabel("Increase Luck").click();
    expect(spent).toEqual(["luck"]);
  });
});

describe("QuestLogView", () => {
  const quest = (id: string, extra: Partial<Quest>): Quest => ({
    id, name: id, description: "", isActive: true, isCompleted: false,
    objectives: [{ id: `${id}.o`, type: "kill", description: `Do ${id}`, targetId: "x", required: 2, current: 1, completed: false }],
    ...extra,
  });

  it("lists active, then failed, then completed quests with objectives and rewards; ✕ reports the close", () => {
    const close = vi.fn();
    const view = new QuestLogView();
    view.update([quest("Done", { isCompleted: true, isActive: false }), quest("Failed", { isFailed: true, isActive: false }), quest("Now", { reward: "50 gold" })]);
    view.open(close);
    const names = Array.from(document.querySelectorAll(".quest-log__name")).map((n) => n.textContent);
    expect(names).toEqual(["◆ Now", "✕ Failed (failed)", "✓ Done (completed)"]);
    expect(document.querySelector(".quest-log__objectives")!.textContent).toBe("○ Do Now (1/2)");
    expect(document.querySelector(".quest-log__reward")!.textContent).toBe("Reward: 50 gold");
    view.update([]);
    expect(document.querySelector(".craft-panel__empty")!.textContent).toBe("No quests yet.");
    (document.querySelector(".graphics-settings__close") as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledOnce();
  });
});
