// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock helpers so they're available inside vi.mock() ─────────────────
const { enterMock, exitMock, resolvedAnim } = vi.hoisted(() => {
  const resolvedAnim = { cancel: vi.fn(), promise: Promise.resolve() };
  return {
    enterMock:    vi.fn(() => resolvedAnim),
    exitMock:     vi.fn(() => resolvedAnim),
    resolvedAnim,
  };
});

// ── Mock @mathigon/boost ───────────────────────────────────────────────────────
vi.mock("@mathigon/boost", () => {
  const makeView = (el: HTMLElement) => ({
    _el:   el,
    enter: enterMock,
    exit:  exitMock,
  });

  return {
    // $() wraps an existing element
    $:  vi.fn((query: unknown) => {
      if (query instanceof HTMLElement) return makeView(query);
      return undefined;
    }),
    // $N() creates a new element
    $N: vi.fn((tag: string, attrs: Record<string, unknown> = {}, parentView?: { _el: HTMLElement }) => {
      const el = document.createElement(tag);
      for (const [key, val] of Object.entries(attrs)) {
        if (key === "text")       el.textContent = String(val);
        else if (key === "html")  el.innerHTML   = String(val);
        else if (key === "class") el.className    = String(val);
        else                      el.setAttribute(key, String(val));
      }
      if (parentView?._el) parentView._el.appendChild(el);
      return makeView(el);
    }),
  };
});

import { $, $N } from "@mathigon/boost";
const mock$ = $ as ReturnType<typeof vi.fn>;
const mock$N = $N as ReturnType<typeof vi.fn>;

import { makeEl, boostFadeIn, boostFadeOut, FADE_IN_DURATION_MS, FADE_OUT_DURATION_MS } from "./dom-utils";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("dom-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  // ── makeEl ─────────────────────────────────────────────────────────────────

  describe("makeEl()", () => {
    it("calls $N with the given tag", () => {
      makeEl("div");
      expect(mock$N).toHaveBeenCalledOnce();
      expect(mock$N.mock.calls[0][0]).toBe("div");
    });

    it("passes attrs to $N", () => {
      makeEl("button", { class: "btn", text: "OK" });
      expect(mock$N.mock.calls[0][1]).toEqual({ class: "btn", text: "OK" });
    });

    it("returns an HTMLElement of the correct tag", () => {
      const el = makeEl("section");
      expect(el).toBeInstanceOf(HTMLElement);
      expect(el.tagName.toLowerCase()).toBe("section");
    });

    it("sets className from attrs.class", () => {
      const el = makeEl("div", { class: "my-panel" });
      expect(el.className).toBe("my-panel");
    });

    it("sets textContent from attrs.text", () => {
      const el = makeEl("span", { text: "hello" });
      expect(el.textContent).toBe("hello");
    });

    it("sets arbitrary attributes", () => {
      const el = makeEl("button", { "aria-label": "close", role: "button" });
      expect(el.getAttribute("aria-label")).toBe("close");
      expect(el.getAttribute("role")).toBe("button");
    });

    it("wraps parent with $() and passes it to $N", () => {
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      makeEl("p", {}, parent);
      expect(mock$).toHaveBeenCalledWith(parent);
    });

    it("appends the new element to the parent", () => {
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      makeEl("span", { text: "child" }, parent);
      expect(parent.children).toHaveLength(1);
      expect(parent.children[0].tagName.toLowerCase()).toBe("span");
    });

    it("does not call $() when parent is omitted", () => {
      makeEl("div");
      expect(mock$).not.toHaveBeenCalled();
    });

    it("sets innerHTML from attrs.html", () => {
      const el = makeEl("div", { html: "<strong>bold</strong>" });
      expect(el.innerHTML).toBe("<strong>bold</strong>");
    });

    it("coerces numeric attributes to strings via setAttribute", () => {
      const el = makeEl("input", { tabindex: 1, maxlength: 50 });
      expect(el.getAttribute("tabindex")).toBe("1");
      expect(el.getAttribute("maxlength")).toBe("50");
    });
  });

  // ── boostFadeIn ────────────────────────────────────────────────────────────

  describe("boostFadeIn()", () => {
    it("wraps the element with $()", () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      void boostFadeIn(el);
      expect(mock$).toHaveBeenCalledWith(el);
    });

    it("calls enter('fade') with the given duration", async () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      await boostFadeIn(el, 400);
      expect(enterMock).toHaveBeenCalledWith("fade", 400);
    });

    it("uses 300 ms as default duration", async () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      await boostFadeIn(el);
      expect(enterMock).toHaveBeenCalledWith("fade", FADE_IN_DURATION_MS);
    });

    it("returns a Promise", () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      const result = boostFadeIn(el);
      expect(result).toBeInstanceOf(Promise);
    });

    it("resolves when the animation finishes", async () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      await expect(boostFadeIn(el)).resolves.toBeUndefined();
    });
  });

  // ── boostFadeOut ───────────────────────────────────────────────────────────

  describe("boostFadeOut()", () => {
    it("wraps the element with $()", () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      void boostFadeOut(el);
      expect(mock$).toHaveBeenCalledWith(el);
    });

    it("calls exit('fade') with the given duration", async () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      await boostFadeOut(el, 150);
      expect(exitMock).toHaveBeenCalledWith("fade", 150);
    });

    it("uses 200 ms as default duration", async () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      await boostFadeOut(el);
      expect(exitMock).toHaveBeenCalledWith("fade", FADE_OUT_DURATION_MS);
    });

    it("returns a Promise", () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      const result = boostFadeOut(el);
      expect(result).toBeInstanceOf(Promise);
    });

    it("resolves when the animation finishes", async () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      await expect(boostFadeOut(el)).resolves.toBeUndefined();
    });

    it("rapid sequential calls both start animations independently", async () => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      await Promise.all([boostFadeOut(el, 50), boostFadeOut(el, 50)]);
      expect(exitMock).toHaveBeenCalledTimes(2);
    });
  });

  // ── edge cases ─────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("boostFadeIn resolves immediately when $() returns undefined", async () => {
      mock$.mockReturnValueOnce(undefined);
      const el = document.createElement("div");
      await expect(boostFadeIn(el)).resolves.toBeUndefined();
    });

    it("boostFadeOut resolves immediately when $() returns undefined", async () => {
      mock$.mockReturnValueOnce(undefined);
      const el = document.createElement("div");
      await expect(boostFadeOut(el)).resolves.toBeUndefined();
    });

    it("makeEl creates elements with any valid HTML tag", () => {
      const tags = ["header", "footer", "nav", "article", "aside"] as const;
      for (const tag of tags) {
        const el = makeEl(tag);
        expect(el.tagName.toLowerCase()).toBe(tag);
      }
    });
  });
});
