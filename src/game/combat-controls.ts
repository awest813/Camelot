/**
 * What the player's combat inputs do: swing or power-attack (or draw a bow),
 * dodge, block, cast (or charge a staff), cycle spells, loose an arrow, use
 * the racial power.  Each action is one method, bound to the input adapter
 * here; the mouse and the editor's key-up path reuse the same methods.
 *
 * Moved out of game.ts (engine overhaul, Phase 1).
 */
import type { CombatSystem } from "../systems/combat-system";
import type { ProjectileSystem } from "../systems/projectile-system";
import type { StealthSystem } from "../systems/stealth-system";
import type { SpellSystem } from "../systems/spell-system";
import type { RaceSystem } from "../systems/race-system";
import type { ActiveEffectsSystem } from "../systems/active-effects-system";

export interface CombatControlsDeps {
  combat(): CombatSystem;
  projectiles(): ProjectileSystem;
  stealth(): StealthSystem;
  spells(): SpellSystem;
  races(): RaceSystem;
  effects(): ActiveEffectsSystem;
  gameTime(): number;
  /** Combat input is off (paused, a menu, a conversation, the editor). */
  blocked(): boolean;
  /** Not paused and not talking (spell cycling works with menus open). */
  free(): boolean;
  /** The first-person weapon swing, and its sound. */
  swing(power: boolean): void;
  /** The bowstring / swing sound. */
  twang(): void;
  notify(text: string, ms: number): void;
}

type Adapter = { onAction(action: never, fn: () => void): void; isActive(action: never): boolean };

export class CombatControls {
  constructor(private readonly _d: CombatControlsDeps) {}

  /** Left mouse / attack: swing, or start drawing a bow. */
  public attack(): void {
    if (this._d.blocked()) return;
    if (this._d.combat().activeWeaponArchetype === "bow") { this.drawBow(); return; }
    // Weapon-skill XP is awarded by the combat system on a hit.
    if (this._d.combat().meleeAttack()) this._d.swing(false);
  }

  public powerAttack(): void {
    if (!this._d.blocked() && this._d.combat().powerAttack()) this._d.swing(true);
  }

  public drawBow(): void {
    if (this._d.blocked()) return;
    if (this._d.projectiles().beginDraw()) this._d.stealth().pushNoise(0.4);
  }

  /** Loose a drawn arrow (no-op when nothing is drawn). */
  public releaseBow(): void {
    const p = this._d.projectiles();
    if (p.isDrawing && p.releaseArrow()) this._d.twang();
  }

  /** Q down: cast the equipped spell, or start charging a staff. */
  public castDown(): void {
    if (this._d.blocked()) return;
    if (this._d.combat().activeWeaponArchetype === "staff") this._d.combat().beginStaffCharge();
    else this._d.spells().castSpell();
  }

  /** Q up: let a charged staff go (Destruction XP comes with the hit). */
  public castUp(): void {
    const c = this._d.combat();
    if (c.isChargingStaff) c.releaseStaffCharge();
  }

  public cycleSpell(): void {
    if (!this._d.free()) return;
    const sp = this._d.spells();
    const known = sp.knownSpells;
    if (known.length === 0) return;
    const i = sp.equippedSpell ? known.findIndex((s) => s.id === sp.equippedSpell!.id) : -1;
    sp.equipSpell(known[(i + 1) % known.length].id);
  }

  public racialPower(): void {
    if (this._d.blocked()) return;
    const races = this._d.races();
    const race = races.chosenRace;
    const now = this._d.gameTime();
    if (!race?.power) {
      this._d.notify("No racial power available.", 2000);
    } else if (!races.canActivatePower(now)) {
      const mins = Math.ceil(races.powerCooldownRemaining(now));
      this._d.notify(`${race.power.name} is recharging (${mins} game-minutes remaining).`, 2500);
    } else {
      races.activatePower(now, this._d.effects());
    }
  }

  public readyWeapon(): void {
    if (this._d.blocked()) return;
    if (this._d.combat().activeWeaponArchetype === "bow") this.releaseBow();
    this._d.notify("Weapon ready — switch with archetype keys (1-6)", 2000);
  }

  /** Register every combat action with the input adapter. */
  public bind(adapter: Adapter): void {
    const on = (action: string, fn: () => void) => adapter.onAction(action as never, fn);
    const c = () => this._d.combat();
    on("meleeAttack", () => this.attack());
    on("powerAttack", () => this.powerAttack());
    on("dodgeRoll", () => { if (!this._d.blocked()) c().tryDodgeRoll(); });
    on("block", () => { if (!this._d.blocked()) c().beginBlock(); });
    on("blockRelease", () => c().endBlock());
    // The same action fires on key down and key up.  Letting go always
    // releases a charged staff (even after entering the editor mid-charge).
    on("castSpell", () => {
      if (!adapter.isActive("castSpell" as never)) { this.castUp(); return; }
      this.castDown();
    });
    on("cycleSpell", () => this.cycleSpell());
    on("drawBow", () => this.drawBow());
    on("releaseBow", () => this.releaseBow());
    on("racialPower", () => this.racialPower());
    on("readyWeapon", () => this.readyWeapon());
  }
}
