import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";

/** A requirement that must be satisfied before a skill can be purchased. */
export interface SkillPrerequisite {
  /** The `id` of the skill that must be learned first. */
  skillId: string;
  /** The minimum rank the prerequisite skill must have reached. */
  minRank: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  maxRank: number;
  currentRank: number;
  effect: (player: Player, rankDelta: number) => void;
  /** Optional list of prerequisite skills. ALL must be satisfied to purchase. */
  prerequisites?: SkillPrerequisite[];
}

export interface SkillTree {
  name: string;
  skills: Skill[];
}

export interface SkillSaveState {
  id: string;
  rank: number;
}

export class SkillTreeSystem {
  private _player: Player;
  private _ui: UIManager;
  public isOpen: boolean = false;
  public trees: SkillTree[];

  constructor(player: Player, ui: UIManager) {
    this._player = player;
    this._ui = ui;
    this.trees = this._buildTrees();
  }

  private _buildTrees(): SkillTree[] {
    return [
      {
        name: "Combat",
        skills: [
          {
            id: "iron_skin",
            name: "Iron Skin",
            description: "+5 Armor per rank",
            maxRank: 3,
            currentRank: 0,
            effect: (p, d) => { p.bonusArmor += 5 * d; },
          },
          {
            id: "warriors_edge",
            name: "Warrior's Edge",
            description: "+5 melee dmg per rank (requires Iron Skin rank 1)",
            maxRank: 3,
            currentRank: 0,
            effect: (p, d) => { p.bonusDamage += 5 * d; },
            prerequisites: [{ skillId: "iron_skin", minRank: 1 }],
          },
          {
            id: "endurance",
            name: "Endurance",
            description: "+25 max Stamina per rank",
            maxRank: 2,
            currentRank: 0,
            effect: (p, d) => { p.maxStamina += 25 * d; },
          },
        ],
      },
      {
        name: "Magic",
        skills: [
          {
            id: "arcane_power",
            name: "Arcane Power",
            description: "+5 magic dmg per rank",
            maxRank: 3,
            currentRank: 0,
            effect: (p, d) => { p.bonusMagicDamage += 5 * d; },
          },
          {
            id: "mystic_reserve",
            name: "Mystic Reserve",
            description: "+25 max Magicka per rank",
            maxRank: 2,
            currentRank: 0,
            effect: (p, d) => { p.maxMagicka += 25 * d; },
          },
          {
            id: "mana_flow",
            name: "Mana Flow",
            description: "+1 Magicka regen per rank (requires Arcane Power rank 1)",
            maxRank: 3,
            currentRank: 0,
            effect: (p, d) => { p.magickaRegen += d; },
            prerequisites: [{ skillId: "arcane_power", minRank: 1 }],
          },
        ],
      },
      {
        name: "Survival",
        skills: [
          {
            id: "vitality",
            name: "Vitality",
            description: "+25 max Health per rank",
            maxRank: 3,
            currentRank: 0,
            effect: (p, d) => { p.maxHealth += 25 * d; },
          },
          {
            id: "swift_recovery",
            name: "Swift Recovery",
            description: "+0.5 HP regen per rank",
            maxRank: 3,
            currentRank: 0,
            effect: (p, d) => { p.healthRegen += 0.5 * d; },
          },
          {
            id: "second_wind",
            name: "Second Wind",
            description: "+5 Stamina regen per rank (requires Swift Recovery rank 1)",
            maxRank: 2,
            currentRank: 0,
            effect: (p, d) => { p.staminaRegen += 5 * d; },
            prerequisites: [{ skillId: "swift_recovery", minRank: 1 }],
          },
        ],
      },
    ];
  }

  public purchaseSkill(treeIndex: number, skillIndex: number): boolean {
    if (this._player.skillPoints <= 0) {
      this._ui.showNotification("No skill points available!", 2000);
      return false;
    }
    const tree = this.trees[treeIndex];
    const skill = tree.skills[skillIndex];
    if (skill.currentRank >= skill.maxRank) {
      this._ui.showNotification("Skill already at max rank!", 2000);
      return false;
    }

    // Check prerequisites
    if (skill.prerequisites && skill.prerequisites.length > 0) {
      const unmet = this._findUnmetPrerequisites(skill.prerequisites);
      if (unmet.length > 0) {
        const names = unmet.map((p) => `${p.skillId} (rank ${p.minRank})`).join(", ");
        this._ui.showNotification(`Requires: ${names}`, 2500);
        return false;
      }
    }

    skill.currentRank++;
    this._player.skillPoints--;
    skill.effect(this._player, 1);
    this._ui.showNotification(`${skill.name} upgraded to rank ${skill.currentRank}!`, 2500);
    this._ui.refreshSkillTree(this.trees, this._player.skillPoints);
    return true;
  }

  /**
   * Returns the subset of prerequisites that are not yet satisfied.
   */
  private _findUnmetPrerequisites(prerequisites: SkillPrerequisite[]): SkillPrerequisite[] {
    return prerequisites.filter((req) => {
      const skill = this._findSkillById(req.skillId);
      return !skill || skill.currentRank < req.minRank;
    });
  }

  /**
   * Check whether all prerequisites for a skill are currently met.
   * Useful for UI rendering (greying out locked skills).
   */
  public arePrerequisitesMet(treeIndex: number, skillIndex: number): boolean {
    const tree = this.trees[treeIndex];
    if (!tree) return false;
    const skill = tree.skills[skillIndex];
    if (!skill?.prerequisites?.length) return true;
    return this._findUnmetPrerequisites(skill.prerequisites).length === 0;
  }

  /** Search all trees for a skill with the given id. */
  private _findSkillById(skillId: string): Skill | undefined {
    for (const tree of this.trees) {
      const found = tree.skills.find((s) => s.id === skillId);
      if (found) return found;
    }
    return undefined;
  }

  public toggle(): void {
    this.isOpen = !this.isOpen;
    this._ui.toggleSkillTree(this.isOpen);
    if (this.isOpen) {
      this._ui.refreshSkillTree(this.trees, this._player.skillPoints);
    }
  }

  public getSaveState(): SkillSaveState[] {
    const result: SkillSaveState[] = [];
    for (const tree of this.trees) {
      for (const skill of tree.skills) {
        if (skill.currentRank > 0) {
          result.push({ id: skill.id, rank: skill.currentRank });
        }
      }
    }
    return result;
  }

  public restoreState(state: SkillSaveState[]): void {
    // Reset all ranks to 0 first so that loading into any session state
    // (e.g. loading a second time, or loading after purchasing skills) is idempotent.
    // SaveSystem already zeroed the underlying stat bonuses before calling this,
    // so we only need to reset the rank counters here.
    for (const tree of this.trees) {
      for (const skill of tree.skills) {
        skill.currentRank = 0;
      }
    }

    const rankMap = new Map(state.map(s => [s.id, s.rank]));
    for (const tree of this.trees) {
      for (const skill of tree.skills) {
        const savedRank = rankMap.get(skill.id) ?? 0;
        if (savedRank > 0) {
          skill.effect(this._player, savedRank);
          skill.currentRank = savedRank;
        }
      }
    }
  }
}
