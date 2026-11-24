/**
 * Where a Preact panel lives in the page: a container appended to <body>
 * on first show, rendered into on every show, emptied on hide.
 * (Engine overhaul, Phase 8.)
 */
import { render, type VNode } from "preact";

export class PanelHost {
  private _el: HTMLDivElement | null = null;

  /** Render (or re-render) `vnode`. */
  public show(vnode: VNode): void {
    if (typeof document === "undefined") return;
    if (!this._el) {
      this._el = document.createElement("div");
      document.body.appendChild(this._el);
    }
    render(vnode, this._el);
  }

  public hide(): void {
    if (this._el) render(null, this._el);
  }

  public destroy(): void {
    this.hide();
    this._el?.remove();
    this._el = null;
  }
}
