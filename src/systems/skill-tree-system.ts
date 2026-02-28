import { Player } from "../entities/player";
import { UIManager } from "../ui/ui-manager";

export interface Skill {
  id: string;
  name: string;
  description: string;
  maxRank: number;
  currentRank: number;
  effect: (player: Player, rankDelta: number) => void;
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
            description: "+5 melee dmg per rank",
            maxRank: 3,
            currentRank: 0,
            effect: (p, d) => { p.bonusDamage += 5 * d; },
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
            description: "+1 Magicka regen per rank",
            maxRank: 3,
            currentRank: 0,
            effect: (p, d) => { p.magickaRegen += d; },
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
            description: "+5 Stamina regen per rank",
            maxRank: 2,
            currentRank: 0,
            effect: (p, d) => { p.staminaRegen += 5 * d; },
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
    skill.currentRank++;
    this._player.skillPoints--;
    skill.effect(this._player, 1);
    this._ui.showNotification(`${skill.name} upgraded to rank ${skill.currentRank}!`, 2500);
    this._ui.refreshSkillTree(this.trees, this._player.skillPoints);
    return true;
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
