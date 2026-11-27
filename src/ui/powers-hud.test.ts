// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { PowersHud, readiness } from "./powers-hud";

describe("PowersHud", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("says READY, or the wait in game hours and minutes", () => {
    expect(readiness(0)).toBe("READY");
    expect(readiness(40)).toBe("40m");
    expect(readiness(320)).toBe("5h 20m");
    expect(readiness(60)).toBe("1h 00m");
  });

  it("shows each power in the HUD chips' stack; hides with none; writes only on change", () => {
    const hud = new PowersHud();
    hud.update([{ key: "V", name: "Kingsvoice", minutesLeft: 0 }, { key: "Shift+V", name: "Grail's Grace", minutesLeft: 90 }]);
    const root = document.querySelector("#hud-chips > .powers-hud") as HTMLElement;
    expect(root.style.display).toBe("grid");
    expect(root.textContent).toBe("VKingsvoiceREADYShift+VGrail's Grace1h 30m");
    const row = root.firstElementChild;
    hud.update([{ key: "V", name: "Kingsvoice", minutesLeft: 0 }, { key: "Shift+V", name: "Grail's Grace", minutesLeft: 89.6 }]);
    expect(root.firstElementChild, "same text: nothing rewritten").toBe(row);
    hud.update([]);
    expect(root.style.display).toBe("none");
    hud.destroy();
    expect(document.querySelector(".powers-hud")).toBeNull();
  });
});
