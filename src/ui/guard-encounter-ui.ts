export type GuardEncounterAction = "pay_fine" | "go_to_jail" | "resist_arrest" | "persuade";

export interface GuardEncounterView {
  guardName: string;
  factionId: string;
  bounty: number;
  playerGold: number;
  canPersuade: boolean;
}

import type { UIAnimator } from "./ui-animator";

/**
 * Guard challenge modal used when CrimeSystem raises an arrest interaction.
 */
export class GuardEncounterUI {
  public isVisible: boolean = false;
  public onResolve: ((action: GuardEncounterAction) => void) | null = null;

  private _root: HTMLDivElement | null = null;
  private _statusEl: HTMLParagraphElement | null = null;
  private _headerEl: HTMLHeadingElement | null = null;
  private _bountyEl: HTMLParagraphElement | null = null;
  private _payBtn: HTMLButtonElement | null = null;
  private _persuadeBtn: HTMLButtonElement | null = null;
  private _animator: UIAnimator | null = null;

  /** Attach a UIAnimator to enable entrance / exit animations. */
  public setAnimator(animator: UIAnimator): void {
    this._animator = animator;
  }

  public open(view: GuardEncounterView): void {
    if (typeof document === "undefined") return;
    this._ensureDom();
    if (!this._root || !this._headerEl || !this._bountyEl || !this._payBtn || !this._persuadeBtn) return;

    this._headerEl.textContent = `${view.guardName}: "You are under arrest."`;
    this._bountyEl.textContent = `Faction: ${view.factionId}  •  Bounty: ${view.bounty}g  •  Your Gold: ${view.playerGold}g`;

    const cannotPay = view.playerGold < view.bounty;
    this._payBtn.setAttribute("aria-disabled", cannotPay.toString());
    this._payBtn.title = cannotPay ? "Not enough gold to pay the fine." : "Pay the fine and clear your bounty.";

    const cannotPersuade = !view.canPersuade;
    this._persuadeBtn.setAttribute("aria-disabled", cannotPersuade.toString());
    this._persuadeBtn.title = cannotPersuade ? "Speechcraft too low to persuade." : "Attempt to persuade the guard to look the other way.";

    this.showStatus("Choose your response.");

    this._root.style.display = "grid";
    this._animator?.panelIn(this._root);
    this.isVisible = true;

    if (this._payBtn && this._payBtn.getAttribute("aria-disabled") !== "true") {
      this._payBtn.focus();
    } else if (this._persuadeBtn && this._persuadeBtn.getAttribute("aria-disabled") !== "true") {
      this._persuadeBtn.focus();
    } else if (this._root) {
      const firstBtn = this._root.querySelector("button");
      if (firstBtn) firstBtn.focus();
    }
  }

  public close(): void {
    if (!this._root) return;
    this.isVisible = false;
    if (this._animator) {
      this._animator.panelOut(this._root, () => {
        if (this._root) this._root.style.display = "none";
      });
    } else {
      this._root.style.display = "none";
    }
  }

  public showStatus(message: string, isError: boolean = false): void {
    if (!this._statusEl) return;
    this._statusEl.textContent = message;
    this._statusEl.classList.toggle("guard-encounter__status--error", isError);
    this._statusEl.classList.toggle("guard-encounter__status--ok", !isError);
  }

  private _ensureDom(): void {
    if (this._root || typeof document === "undefined") return;

    const root = document.createElement("div");
    root.className = "guard-encounter";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "guard-encounter-title");
    root.style.display = "none";

    const panel = document.createElement("section");
    panel.className = "guard-encounter__panel";
    root.appendChild(panel);

    const title = document.createElement("h2");
    title.id = "guard-encounter-title";
    title.className = "guard-encounter__title";
    title.textContent = "Guard Challenge";
    panel.appendChild(title);

    const header = document.createElement("h3");
    header.className = "guard-encounter__line";
    panel.appendChild(header);
    this._headerEl = header;

    const bounty = document.createElement("p");
    bounty.className = "guard-encounter__meta";
    panel.appendChild(bounty);
    this._bountyEl = bounty;

    const status = document.createElement("p");
    status.className = "guard-encounter__status";
    panel.appendChild(status);
    this._statusEl = status;

    const actions = document.createElement("div");
    actions.className = "guard-encounter__actions";
    panel.appendChild(actions);

    const makeBtn = (
      label: string,
      action: GuardEncounterAction,
      classes: string = "guard-encounter__btn",
    ): HTMLButtonElement => {
      const button = document.createElement("button");
      button.className = classes;
      button.textContent = label;
      button.addEventListener("click", (e) => {
        if (button.getAttribute("aria-disabled") === "true") {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        this.onResolve?.(action);
      });
      actions.appendChild(button);
      return button;
    };

    this._payBtn = makeBtn("Pay Fine", "pay_fine", "guard-encounter__btn guard-encounter__btn--primary");
    makeBtn("Go to Jail", "go_to_jail");
    this._persuadeBtn = makeBtn("Persuade", "persuade");
    makeBtn("Resist Arrest", "resist_arrest", "guard-encounter__btn guard-encounter__btn--danger");

    document.body.appendChild(root);
    this._root = root;
  }
}

