import { manageDialogFocus, type DialogFocusSession } from "./dialog-focus";
import type { BoardView } from "../systems/village-jobs";

/**
 * JobBoardUI — the village notice board / innkeeper "Any work going?" window.
 *
 * Shows the offered or active job (title, description, reward, progress) with
 * Accept / Hand in / Abandon / Close.  Pure DOM; the game supplies a
 * {@link BoardView} and reacts to the callbacks, then calls `render` again.
 */
export class JobBoardUI {
  public isVisible = false;
  public onAccept: (() => void) | null = null;
  public onHandIn: (() => void) | null = null;
  /** Turn the offer down, or abandon the active job. */
  public onDecline: (() => void) | null = null;
  public onClose: (() => void) | null = null;

  private _root: HTMLDivElement | null = null;
  private _body: HTMLDivElement | null = null;
  private _title: HTMLHeadingElement | null = null;
  private _focus: DialogFocusSession | null = null;

  public show(placeName: string, view: BoardView): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (!this._root) return;
    this.render(placeName, view);
    this._root.style.display = "flex";
    this.isVisible = true;
    if (!this._focus) this._focus = manageDialogFocus(this._root);
  }

  public hide(): void {
    if (this._root) this._root.style.display = "none";
    this.isVisible = false;
    this._focus?.release();
    this._focus = null;
  }

  /** (Re)draw the window contents for a board state. */
  public render(placeName: string, view: BoardView): void {
    if (!this._body || !this._title) return;
    this._title.textContent = `Work in ${placeName}`;
    const b = this._body;
    b.innerHTML = "";
    const t = view.template;

    const status = document.createElement("p");
    status.className = "job-board__status";
    status.textContent = view.job ? (view.canHandIn ? "Ready to hand in" : "Taken") : "Posted";
    b.appendChild(status);

    const name = document.createElement("h3");
    name.className = "job-board__job-title";
    name.textContent = t.title;
    b.appendChild(name);

    const desc = document.createElement("p");
    desc.className = "job-board__desc";
    desc.textContent = view.description;
    b.appendChild(desc);

    const reward = document.createElement("p");
    reward.className = "job-board__reward";
    reward.textContent = `Reward: ${t.rewardGold} gold, ${t.rewardXp} XP`;
    b.appendChild(reward);

    if (view.job || t.kind === "supply") {
      const prog = document.createElement("p");
      prog.className = "job-board__progress";
      const label = t.kind === "bounty" ? "Slain" : "Carried";
      prog.textContent = `${label}: ${view.progress} / ${t.required}`;
      const bar = document.createElement("div");
      bar.className = "job-board__bar";
      const fill = document.createElement("div");
      fill.className = "job-board__bar-fill";
      fill.style.width = `${Math.round((view.progress / t.required) * 100)}%`;
      bar.appendChild(fill);
      b.appendChild(prog);
      b.appendChild(bar);
    }

    const actions = document.createElement("div");
    actions.className = "job-board__actions";
    const button = (label: string, cls: string, handler: (() => void) | null, disabled = false) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `job-board__btn ${cls}`;
      btn.textContent = label;
      btn.disabled = disabled;
      btn.addEventListener("click", () => handler?.());
      actions.appendChild(btn);
      return btn;
    };
    if (!view.job) {
      button("Accept", "job-board__btn--primary", () => this.onAccept?.());
      button("Not now", "", () => this.onDecline?.());
    } else {
      button("Hand in", "job-board__btn--primary", () => this.onHandIn?.(), !view.canHandIn);
      button("Abandon", "job-board__btn--danger", () => this.onDecline?.());
    }
    button("Close", "", () => { this.hide(); this.onClose?.(); });
    b.appendChild(actions);
  }

  public destroy(): void {
    this.hide();
    this._root?.remove();
    this._root = null;
  }

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;
    const root = document.createElement("div");
    root.className = "graphics-settings job-board";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "job-board-title");
    root.style.display = "none";

    const panel = document.createElement("div");
    panel.className = "graphics-settings__panel job-board__panel";
    const header = document.createElement("div");
    header.className = "graphics-settings__header";
    const title = document.createElement("h2");
    title.id = "job-board-title";
    title.className = "graphics-settings__title";
    header.appendChild(title);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "graphics-settings__close";
    close.setAttribute("aria-label", "Close job board");
    close.textContent = "✕";
    close.addEventListener("click", () => { this.hide(); this.onClose?.(); });
    header.appendChild(close);
    panel.appendChild(header);

    const body = document.createElement("div");
    body.className = "job-board__body";
    panel.appendChild(body);
    root.appendChild(panel);
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.hide();
        this.onClose?.();
      }
    });
    document.body.appendChild(root);
    this._root = root;
    this._body = body;
    this._title = title;
  }
}
