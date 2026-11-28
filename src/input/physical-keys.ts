/**
 * Keys by where they are, not what they type: the game's controls (WASD, the
 * number row, I, M…) are laid out for a QWERTY keyboard, so on AZERTY,
 * QWERTZ, Dvorak… a key press is read as the QWERTY key in the same place.
 * Forward is the key above S on every layout, and the number row gives
 * digits without Shift (AZERTY types "&é\"'(" there).
 *
 * The rewrite happens once, in a capture listener on the window, before the
 * game, Babylon's camera or the editors see the event. Typing in a text
 * field, and AltGr characters, are left as they are.
 */

/** The QWERTY characters of Shift + the number row. */
const SHIFTED_DIGITS = ")!@#$%^&*(";

export interface PhysicalKey { key: string; keyCode: number }

/** The QWERTY key in this press's place, or null to leave the press as it is. */
export function physicalKey(ev: Pick<KeyboardEvent, "code" | "key" | "shiftKey" | "altKey">): PhysicalKey | null {
  if (ev.altKey) return null; // AltGr (Ctrl+Alt) characters: @ # { [ on many layouts
  const letter = /^Key([A-Z])$/.exec(ev.code);
  if (letter) {
    const upper = letter[1];
    return { key: ev.shiftKey ? upper : upper.toLowerCase(), keyCode: upper.charCodeAt(0) };
  }
  const digit = /^Digit(\d)$/.exec(ev.code);
  if (digit) {
    const d = Number(digit[1]);
    return { key: ev.shiftKey ? SHIFTED_DIGITS[d] : String(d), keyCode: 48 + d };
  }
  return null;
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

/** Rewrite every key press on the page to its QWERTY place (see above). */
export function installPhysicalKeys(win: Window = window): () => void {
  const rewrite = (ev: KeyboardEvent) => {
    if (isTyping(ev.target)) return;
    const p = physicalKey(ev);
    if (!p || (p.key === ev.key && p.keyCode === ev.keyCode)) return;
    // The event's fields are prototype getters: an own property shadows them.
    Object.defineProperty(ev, "key", { value: p.key, configurable: true });
    Object.defineProperty(ev, "keyCode", { value: p.keyCode, configurable: true });
    Object.defineProperty(ev, "which", { value: p.keyCode, configurable: true });
  };
  win.addEventListener("keydown", rewrite, true);
  win.addEventListener("keyup", rewrite, true);
  return () => {
    win.removeEventListener("keydown", rewrite, true);
    win.removeEventListener("keyup", rewrite, true);
  };
}
