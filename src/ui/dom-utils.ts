/**
 * dom-utils: create an element with its attributes in one call, instead of
 * the createElement → setAttribute → append steps.
 */

/**
 * A new element.  `attrs`: `class` → className, `text` → textContent,
 * `html` → innerHTML (trusted markup only), anything else an attribute
 * (null and undefined are skipped).  Appended to `parent` when given.
 *
 * @example
 * const panel = makeEl("section", { class: "my-panel", role: "dialog" });
 * const btn   = makeEl("button", { class: "btn", text: "OK" }, panel);
 */
export function makeEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, unknown>,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null) continue;
    if (key === "class") el.className = String(value);
    else if (key === "text") el.textContent = String(value);
    else if (key === "html") el.innerHTML = String(value);
    else el.setAttribute(key, String(value));
  }
  parent?.appendChild(el);
  return el;
}
