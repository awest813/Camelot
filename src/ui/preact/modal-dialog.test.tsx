import { describe, it, expect, vi } from "vitest";
import { render } from "preact";
import { ModalDialog } from "./modal-dialog";

function mount(onClose: () => void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  render(<ModalDialog id="t-title" title="Test" onClose={onClose}><button type="button">Inside</button></ModalDialog>, host);
  return host;
}

describe("ModalDialog", () => {
  it("is a labelled modal dialog", () => {
    const host = mount(() => {});
    const dlg = host.querySelector('[role="dialog"]')!;
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(dlg.getAttribute("aria-labelledby")).toBe("t-title");
    expect(host.querySelector("#t-title")?.textContent).toBe("Test");
    render(null, host);
  });

  it("✕, a backdrop click and Escape close it; a click inside doesn't", () => {
    const onClose = vi.fn();
    const host = mount(onClose);
    const dlg = host.querySelector<HTMLElement>('[role="dialog"]')!;
    host.querySelector<HTMLButtonElement>("button")!.click(); // the ✕ comes first
    dlg.click();
    dlg.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(3);
    host.querySelectorAll<HTMLButtonElement>("button")[1].click(); // "Inside"
    expect(onClose).toHaveBeenCalledTimes(3);
    render(null, host);
  });
});
