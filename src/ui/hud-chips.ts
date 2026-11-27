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
