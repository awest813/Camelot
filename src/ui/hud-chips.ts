/**
 * The HUD chips' stack: the small status chips (companion, follower, the
 * word ready to speak, the daily powers) sit in one column at the bottom
 * right, above the resource bars, so they never overlap whichever are shown.
 * `order` sets a chip's place: lower is nearer the bottom.
 */
export function addHudChip(chip: HTMLElement, order: number): void {
  let stack = document.getElementById("hud-chips");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "hud-chips";
    stack.className = "hud-chips";
    Object.assign(stack.style, {
      position: "fixed", right: "14px", bottom: "110px",
      display: "flex", flexDirection: "column-reverse", alignItems: "flex-end", gap: "6px",
      zIndex: "20" /* HUD chips: under every panel */, pointerEvents: "none",
    });
    document.body.appendChild(stack);
  }
  chip.style.order = String(order);
  stack.appendChild(chip);
}

/** A one-line chip in the stack: `set(text)` shows it, `set(null)` hides it (writes only on change). */
export function statusChip(order: number, label: string): { set(text: string | null, color?: string): void } {
  let el: HTMLDivElement | null = null;
  let last: string | null = null;
  return {
    set(text, color = "#E0533F") {
      if (typeof document === "undefined" || `${text}|${color}` === last) return;
      last = `${text}|${color}`;
      if (!el) {
        el = document.createElement("div");
        el.setAttribute("role", "status");
        el.setAttribute("aria-label", label);
        Object.assign(el.style, {
          background: "rgba(30, 19, 11, 0.97)", border: "1px solid #8A6A2C", borderRadius: "6px",
          padding: "4px 9px", pointerEvents: "none", fontFamily: "'EB Garamond', Georgia, serif", fontSize: "13px",
        });
        addHudChip(el, order);
      }
      el.textContent = text ?? "";
      el.style.color = color;
      el.style.display = text ? "block" : "none";
    },
  };
}
