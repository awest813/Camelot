import { describe, it, expect } from "vitest";
import { makeEl } from "./dom-utils";

describe("makeEl()", () => {
  it("creates the element with class, text and attributes", () => {
    const el = makeEl("button", { class: "btn primary", text: "OK", "aria-label": "Confirm", tabindex: 0 });
    expect(el.tagName).toBe("BUTTON");
    expect(el.className).toBe("btn primary");
    expect(el.textContent).toBe("OK");
    expect(el.getAttribute("aria-label")).toBe("Confirm");
    expect(el.getAttribute("tabindex")).toBe("0");
  });

  it("appends to the parent, sets trusted html, and skips null values", () => {
    const parent = makeEl("div");
    const child = makeEl("p", { html: "<b>bold</b>", title: null, id: undefined }, parent);
    expect(parent.firstElementChild).toBe(child);
    expect(child.querySelector("b")?.textContent).toBe("bold");
    expect(child.hasAttribute("title")).toBe(false);
    expect(child.hasAttribute("id")).toBe(false);
  });
});
