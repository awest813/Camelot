/**
 * Experience and leveling system.
 * Handles player leveling, stat growth, and level-based progression.
 */

export interface LevelData {
  level: number;
  requiredXP: number; // XP needed to reach this level from previous
  statBonuses: {
    health: number;
    magicka: number;
    stamina: number;
  };
}

export class ExperienceSystem {
  // Current progression
  public level: number = 1;
  public experience: number = 0;
  public nextLevelXP: number = 100; // XP needed for next level

  // Level progression table
  private _levelTable: LevelData[] = this._generateLevelTable();

  constructor() {}

  /**
   * Generate level progression table with exponential scaling.
   * XP requirements increase by ~20% per level (soft cap at level 50).
   */
  private _generateLevelTable(): LevelData[] {
    const table: LevelData[] = [];
    let baseXP = 100;
    const scaleFactor = 1.2;
    const maxLevel = 50;

    for (let level = 1; level <= maxLevel; level++) {
      const requiredXP = Math.round(baseXP * Math.pow(scaleFactor, level - 1));
      table.push({
        level,
        requiredXP,
        statBonuses: {
          health: 10 + level, // 11, 12, 13... per level
          magicka: 5 + Math.floor(level * 0.5), // 5, 5, 6, 6... per level
          stamina: 5 + Math.floor(level * 0.5), // 5, 5, 6, 6... per level
        },
      });
    }

    return table;
  }

  /**
   * Gain experience and check for level up.
   * Returns the new level if leveled up, otherwise 0.
   */
  public gainXP(amount: number): number {
    if (this.level >= this._levelTable.length) return 0;

    this.experience += amount;

    let leveledUp = 0;
    while (this.experience >= this.nextLevelXP && this.level < this._levelTable.length) {
      this.experience -= this.nextLevelXP;
      leveledUp = this._levelUp();
    }

    return leveledUp;
  }

  /**
   * Level up the player and get stat bonuses.
   */
  private _levelUp(): number {
    if (this.level >= this._levelTable.length) return 0;

    this.level++;
    const levelData = this._levelTable[this.level - 1];

    // Update next level XP requirement
    if (this.level < this._levelTable.length) {
      this.nextLevelXP = this._levelTable[this.level].requiredXP;
    }

    return this.level;
  }

  /**
   * Get stat bonuses for current level.
   */
  public getStatBonuses(): { health: number; magicka: number; stamina: number } {
    let totalHealth = 0;
    let totalMagicka = 0;
    let totalStamina = 0;

    // Sum all bonuses from levels 1 to current level
    for (let i = 0; i < this.level; i++) {
      const levelData = this._levelTable[i];
      totalHealth += levelData.statBonuses.health;
      totalMagicka += levelData.statBonuses.magicka;
      totalStamina += levelData.statBonuses.stamina;
    }

    return {
      health: totalHealth,
      magicka: totalMagicka,
      stamina: totalStamina,
    };
  }

  /**
   * Get XP progress to next level (0-100).
   */
  public getXPProgress(): number {
    // Find total XP needed from level 1 to current level
    let totalXPNeeded = 0;
    for (let i = 0; i < this.level - 1; i++) {
      totalXPNeeded += this._levelTable[i].requiredXP;
    }

    const currentXP = totalXPNeeded + this.experience;
    const nextLevelXP = totalXPNeeded + this.nextLevelXP;

    return (currentXP / nextLevelXP) * 100;
  }

  /**
   * Get current and next level XP values for UI display.
   */
  public getXPDisplay(): { current: number; next: number } {
    return {
      current: this.experience,
      next: this.nextLevelXP,
    };
  }
}
