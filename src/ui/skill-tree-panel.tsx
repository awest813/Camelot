/**
 * The skill tree (K): one column per tree, each skill with its rank and an
 * Upgrade button (locked until its prerequisites are met, mastered at max
 * rank).  A Preact panel on the DOM layer (engine overhaul, Phase 8; it was
 * Babylon GUI in the UI manager, which still opens, refreshes and closes it).
 */
import type { SkillTree } from "../systems/skill-tree-system";
import { ModalDialog } from "./preact/modal-dialog";
import { PanelHost } from "./preact/panel-host";

export interface SkillTreeState {
  trees: readonly SkillTree[];
  skillPoints: number;
  prereqMet?: (treeIndex: number, skillIndex: number) => boolean;
}

/** What a skill's button says and whether it can be pressed. */
export function skillAction(state: SkillTreeState, t: number, s: number): { label: string; aria: string; canBuy: boolean; kind: "max" | "locked" | "buy" | "poor" } {
  const skill = state.trees[t].skills[s];
  const isMax = skill.currentRank >= skill.maxRank;
  const isLocked = !isMax && state.prereqMet ? !state.prereqMet(t, s) : false;
  const canBuy = !isMax && !isLocked && state.skillPoints > 0;
  if (isMax) return { label: "✦ Mastered", aria: `${skill.name} Mastered`, canBuy, kind: "max" };
  if (isLocked) return { label: "🔒 Locked", aria: `${skill.name} Locked — prerequisites not met`, canBuy, kind: "locked" };
  if (canBuy) return { label: "Upgrade", aria: `Upgrade ${skill.name}`, canBuy, kind: "buy" };
  return { label: "Need Points", aria: `Need Points for ${skill.name}`, canBuy, kind: "poor" };
}

export function SkillTreePanel(p: { state: SkillTreeState; onBuy(t: number, s: number): void; onClose(): void }) {
  return (
    <ModalDialog id="skill-tree-title" title="Skill Trees" className="craft-panel skill-tree" panelClassName="craft-panel__panel skill-tree__panel" onClose={p.onClose}>
      <p class="craft-panel__subtitle craft-panel__status--ok" aria-live="polite">Skill Points: {p.state.skillPoints}</p>
      <div class="skill-tree__columns">
        {p.state.trees.map((tree, t) => (
          <section key={tree.name} class="craft-panel__section skill-tree__column" aria-label={tree.name}>
            <h3 class="craft-panel__section-title">{tree.name}</h3>
            {tree.skills.map((skill, s) => {
              const a = skillAction(p.state, t, s);
              return (
                <article key={skill.id} class={`skill-tree__skill skill-tree__skill--${a.kind}`}>
                  <h4 class="skill-tree__name">{skill.name}</h4>
                  <p class="skill-tree__rank" aria-label={`Rank ${skill.currentRank} of ${skill.maxRank}`}>
                    {"★".repeat(skill.currentRank)}{"☆".repeat(Math.max(0, skill.maxRank - skill.currentRank))}  ({skill.currentRank}/{skill.maxRank})
                  </p>
                  <p class="skill-tree__desc">{skill.description}</p>
                  <button type="button" class="craft-panel__btn craft-panel__btn--small" disabled={!a.canBuy} aria-label={a.aria} onClick={() => p.onBuy(t, s)}>{a.label}</button>
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </ModalDialog>
  );
}

/** Opened, refreshed and closed by the UI manager. */
export class SkillTreeView {
  private readonly _host = new PanelHost();
  private _state: SkillTreeState = { trees: [], skillPoints: 0 };
  private _handlers: { onBuy(t: number, s: number): void; onClose(): void } | null = null;

  public open(handlers: { onBuy(t: number, s: number): void; onClose(): void }): void {
    this._handlers = handlers;
    this._render();
  }

  public refresh(state: SkillTreeState): void {
    this._state = state;
    if (this._handlers) this._render();
  }

  public close(): void {
    this._handlers = null;
    this._host.hide();
  }

  private _render(): void {
    const h = this._handlers;
    if (h) this._host.show(<SkillTreePanel state={this._state} onBuy={h.onBuy} onClose={h.onClose} />);
  }
}
