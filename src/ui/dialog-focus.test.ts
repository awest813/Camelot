// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { manageDialogFocus, queryDialogTabStops } from "./dialog-focus";

function buildDialog(): { root: HTMLDivElement; buttons: HTMLButtonElement[] } {
  document.body.innerHTML = "";
  const trigger = document.createElement("button");
  trigger.textContent = "outside";
  document.body.appendChild(trigger);

  const root = document.createElement("div");
  root.setAttribute("role", "dialog");
  const buttons: HTMLButtonElement[] = [];
  for (const label of ["one", "two", "three"]) {
    const btn = document.createElement("button");
    btn.textContent = label;
    root.appendChild(btn);
    buttons.push(btn);
  }
  document.body.appendChild(root);
  return { root, buttons };
}

function pressTab(target: HTMLElement, shift = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

describe("dialog-focus", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("queryDialogTabStops returns buttons in document order", () => {
    const { root, buttons } = buildDialog();
    expect(queryDialogTabStops(root)).toEqual(buttons);
  });

  it("moves focus into the container when focus is outside", () => {
    const { root } = buildDialog();
    (document.querySelector("button") as HTMLButtonElement).focus();
    const session = manageDialogFocus(root);
    expect(document.activeElement).toBe(root);
    session.release();
  });

  it("preserves panel-specific focus already inside the container", () => {
    const { root, buttons } = buildDialog();
    buttons[1].focus();
    const session = manageDialogFocus(root);
    expect(document.activeElement).toBe(buttons[1]);
    session.release();
  });

  it("wraps Tab from the last stop to the first", () => {
    const { root, buttons } = buildDialog();
    const session = manageDialogFocus(root);
    buttons[buttons.length - 1].focus();
    const event = pressTab(buttons[buttons.length - 1]);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    session.release();
  });

  it("wraps Shift+Tab from the first stop to the last", () => {
    const { root, buttons } = buildDialog();
    const session = manageDialogFocus(root);
    buttons[0].focus();
    const event = pressTab(buttons[0], true);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    session.release();
  });

  it("ignores non-Tab keys", () => {
    const { root, buttons } = buildDialog();
    const session = manageDialogFocus(root);
    buttons[0].focus();
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    buttons[0].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(buttons[0]);
    session.release();
  });

  it("release() restores the previously focused element", () => {
    const { root } = buildDialog();
    const trigger = document.querySelector("button") as HTMLButtonElement;
    trigger.focus();
    const session = manageDialogFocus(root);
    expect(document.activeElement).toBe(root);
    session.release();
    expect(document.activeElement).toBe(trigger);
  });

  it("release() is idempotent and removes the trap", () => {
    const { root, buttons } = buildDialog();
    const session = manageDialogFocus(root);
    session.release();
    session.release();
    // Trap gone: tabbing past the end no longer wraps.
    buttons[buttons.length - 1].focus();
    const event = pressTab(buttons[buttons.length - 1]);
    expect(event.defaultPrevented).toBe(false);
  });

  it("prevents Tab when the dialog has no tab stops", () => {
    document.body.innerHTML = "";
    const root = document.createElement("div");
    root.setAttribute("role", "dialog");
    root.textContent = "no buttons here";
    document.body.appendChild(root);
    const session = manageDialogFocus(root);
    const event = pressTab(root);
    expect(event.defaultPrevented).toBe(true);
    session.release();
  });
});
