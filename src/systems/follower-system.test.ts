import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FollowerSystem,
  BUILTIN_FOLLOWERS,
  MAX_FOLLOWERS,
  DEFAULT_FOLLOWER_HEALTH,
  DEFAULT_FOLLOWER_DAMAGE,
  HEALTH_PER_LEVEL,
  DAMAGE_PER_LEVEL,
} from "./follower-system";
import type {
  FollowerTemplate,
  FollowerSaveState,
  ActiveFollowerState,
} from "./follower-system";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<FollowerTemplate> = {}): FollowerTemplate {
  return {
    id: "test_follower",
    name: "Test Follower",
    description: "A follower for testing.",
    level: 5,
    combatRole: "warrior",
    carryWeightBonus: 30,
    hireCost: 0,
    homeLocationId: "test_home",
    ...overrides,
  };
}

// ── Initial state ─────────────────────────────────────────────────────────────

describe("FollowerSystem — initial state", () => {
  it("starts with no active follower", () => {
    const sys = new FollowerSystem();
    expect(sys.getActiveFollower()).toBeNull();
    expect(sys.hasFollower).toBe(false);
  });

  it("registers all built-in follower templates on construction", () => {
    const sys = new FollowerSystem();
    for (const def of BUILTIN_FOLLOWERS) {
      expect(sys.registeredTemplateIds).toContain(def.id);
    }
  });

  it("registers exactly 8 built-in templates", () => {
    const sys = new FollowerSystem();
    expect(sys.registeredTemplateIds).toHaveLength(8);
  });

  it("no follower is deceased by default", () => {
    const sys = new FollowerSystem();
    for (const def of BUILTIN_FOLLOWERS) {
      expect(sys.isFollowerDeceased(def.id)).toBe(false);
    }
  });

  it("activeCarryWeightBonus is 0 with no follower", () => {
    const sys = new FollowerSystem();
    expect(sys.activeCarryWeightBonus).toBe(0);
  });
});

// ── registerFollowerTemplate / removeFollowerTemplate ─────────────────────────

describe("FollowerSystem — template CRUD", () => {
  it("registers a custom template", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    expect(sys.registeredTemplateIds).toContain("test_follower");
  });

  it("getFollowerTemplate returns a defensive copy", () => {
    const sys = new FollowerSystem();
    const original = makeTemplate();
    sys.registerFollowerTemplate(original);
    const copy = sys.getFollowerTemplate("test_follower");
    expect(copy).not.toBe(original);
    expect(copy!.name).toBe("Test Follower");
  });

  it("getFollowerTemplate returns undefined for unknown id", () => {
    const sys = new FollowerSystem();
    expect(sys.getFollowerTemplate("no_such_follower")).toBeUndefined();
  });

  it("removeFollowerTemplate removes and returns true", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    expect(sys.removeFollowerTemplate("test_follower")).toBe(true);
    expect(sys.registeredTemplateIds).not.toContain("test_follower");
  });

  it("removeFollowerTemplate returns false for unknown id", () => {
    const sys = new FollowerSystem();
    expect(sys.removeFollowerTemplate("no_such_follower")).toBe(false);
  });

  it("re-registering replaces the template definition", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.registerFollowerTemplate(makeTemplate({ name: "Updated Name" }));
    expect(sys.getFollowerTemplate("test_follower")!.name).toBe("Updated Name");
  });
});

// ── canRecruit ────────────────────────────────────────────────────────────────

describe("FollowerSystem — canRecruit", () => {
  it("returns unknown_template for unregistered id", () => {
    const sys = new FollowerSystem();
    const result = sys.canRecruit("no_such_follower");
    expect(result.canRecruit).toBe(false);
    expect(result.reason).toBe("unknown_template");
  });

  it("returns canRecruit true for free follower with enough gold", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    const result = sys.canRecruit("test_follower", 0);
    expect(result.canRecruit).toBe(true);
  });

  it("returns insufficient_gold when player cannot afford hire cost", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ hireCost: 500 }));
    const result = sys.canRecruit("test_follower", 100);
    expect(result.canRecruit).toBe(false);
    expect(result.reason).toBe("insufficient_gold");
  });

  it("returns already_have_follower when one is active", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.registerFollowerTemplate(makeTemplate({ id: "follower_2", name: "Second" }));
    sys.recruitFollower("test_follower");
    const result = sys.canRecruit("follower_2");
    expect(result.canRecruit).toBe(false);
    expect(result.reason).toBe("already_have_follower");
  });

  it("returns follower_deceased for a dead follower", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.followerTakeDamage(99999);
    const result = sys.canRecruit("test_follower");
    expect(result.canRecruit).toBe(false);
    expect(result.reason).toBe("follower_deceased");
  });

  it("exposes the hire cost in the check result", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ hireCost: 250 }));
    const result = sys.canRecruit("test_follower", 1000);
    expect(result.hireCost).toBe(250);
  });
});

// ── recruitFollower ───────────────────────────────────────────────────────────

describe("FollowerSystem — recruitFollower", () => {
  it("returns null for unknown template", () => {
    const sys = new FollowerSystem();
    expect(sys.recruitFollower("no_such_follower")).toBeNull();
  });

  it("returns active follower state on success", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ level: 5 }));
    const result = sys.recruitFollower("test_follower");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Test Follower");
    expect(result!.isAlive).toBe(true);
    expect(result!.command).toBe("follow");
  });

  it("scales maxHealth by level", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ level: 10 }));
    const result = sys.recruitFollower("test_follower")!;
    expect(result.maxHealth).toBe(DEFAULT_FOLLOWER_HEALTH + 10 * HEALTH_PER_LEVEL);
  });

  it("scales attackDamage by level", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ level: 10 }));
    const result = sys.recruitFollower("test_follower")!;
    expect(result.attackDamage).toBe(DEFAULT_FOLLOWER_DAMAGE + 10 * DAMAGE_PER_LEVEL);
  });

  it("follower starts at full health", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    const result = sys.recruitFollower("test_follower")!;
    expect(result.health).toBe(result.maxHealth);
  });

  it("fires onFollowerRecruited callback", () => {
    const sys = new FollowerSystem();
    const cb  = vi.fn();
    sys.onFollowerRecruited = cb;
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    expect(cb).toHaveBeenCalledWith("test_follower", "Test Follower");
  });

  it("returns null when a follower is already active", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.registerFollowerTemplate(makeTemplate({ id: "follower_2", name: "Second" }));
    sys.recruitFollower("test_follower");
    expect(sys.recruitFollower("follower_2")).toBeNull();
  });

  it("returns null when player cannot afford hire cost", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ hireCost: 1000 }));
    expect(sys.recruitFollower("test_follower", 0)).toBeNull();
  });

  it("hasFollower becomes true after recruiting", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    expect(sys.hasFollower).toBe(true);
  });

  it("getActiveFollower returns a defensive copy", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    const result = sys.recruitFollower("test_follower")!;
    const active = sys.getActiveFollower()!;
    expect(active).not.toBe(result);
    expect(active.name).toBe("Test Follower");
  });
});

// ── dismissFollower ───────────────────────────────────────────────────────────

describe("FollowerSystem — dismissFollower", () => {
  it("returns false when no follower is active", () => {
    const sys = new FollowerSystem();
    expect(sys.dismissFollower()).toBe(false);
  });

  it("returns true and clears active follower", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    expect(sys.dismissFollower()).toBe(true);
    expect(sys.getActiveFollower()).toBeNull();
    expect(sys.hasFollower).toBe(false);
  });

  it("fires onFollowerDismissed callback with home location", () => {
    const sys = new FollowerSystem();
    const cb  = vi.fn();
    sys.onFollowerDismissed = cb;
    sys.registerFollowerTemplate(makeTemplate({ homeLocationId: "test_home" }));
    sys.recruitFollower("test_follower");
    sys.dismissFollower();
    expect(cb).toHaveBeenCalledWith("test_follower", "Test Follower", "test_home");
  });

  it("allows recruiting again after dismiss", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.dismissFollower();
    const result = sys.recruitFollower("test_follower");
    expect(result).not.toBeNull();
  });
});

// ── commandFollower ───────────────────────────────────────────────────────────

describe("FollowerSystem — commandFollower", () => {
  it("returns false with no active follower", () => {
    const sys = new FollowerSystem();
    expect(sys.commandFollower("wait")).toBe(false);
  });

  it("updates the follower's standing command", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.commandFollower("wait");
    expect(sys.getActiveFollower()!.command).toBe("wait");
  });

  it("fires onCommandIssued callback", () => {
    const sys = new FollowerSystem();
    const cb  = vi.fn();
    sys.onCommandIssued = cb;
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.commandFollower("trade");
    expect(cb).toHaveBeenCalledWith("trade");
  });

  it("supports all three commands", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    for (const cmd of ["follow", "wait", "trade"] as const) {
      sys.commandFollower(cmd);
      expect(sys.getActiveFollower()!.command).toBe(cmd);
    }
  });
});

// ── followerTakeDamage / followerHeal ─────────────────────────────────────────

describe("FollowerSystem — combat damage and healing", () => {
  it("followerTakeDamage returns false when no active follower", () => {
    const sys = new FollowerSystem();
    expect(sys.followerTakeDamage(10)).toBe(false);
  });

  it("reduces follower health", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ level: 1 }));
    sys.recruitFollower("test_follower");
    const maxHealth = sys.getActiveFollower()!.maxHealth;
    sys.followerTakeDamage(30);
    expect(sys.getActiveFollower()!.health).toBe(maxHealth - 30);
  });

  it("fires onFollowerDamaged callback", () => {
    const sys = new FollowerSystem();
    const cb  = vi.fn();
    sys.onFollowerDamaged = cb;
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.followerTakeDamage(20);
    expect(cb).toHaveBeenCalledWith(20, expect.any(Number));
  });

  it("fires onFollowerDied and removes active follower when health reaches 0", () => {
    const sys = new FollowerSystem();
    const cb  = vi.fn();
    sys.onFollowerDied = cb;
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.followerTakeDamage(99999);
    expect(cb).toHaveBeenCalledWith("test_follower", "Test Follower");
    expect(sys.getActiveFollower()).toBeNull();
  });

  it("marks follower as deceased after death", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.followerTakeDamage(99999);
    expect(sys.isFollowerDeceased("test_follower")).toBe(true);
  });

  it("followerHeal restores health", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ level: 1 }));
    sys.recruitFollower("test_follower");
    const maxHealth = sys.getActiveFollower()!.maxHealth;
    sys.followerTakeDamage(50);
    sys.followerHeal(20);
    expect(sys.getActiveFollower()!.health).toBe(maxHealth - 30);
  });

  it("followerHeal does not exceed maxHealth", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    const maxHealth = sys.getActiveFollower()!.maxHealth;
    sys.followerHeal(99999);
    expect(sys.getActiveFollower()!.health).toBe(maxHealth);
  });

  it("followerHeal returns false when no active follower", () => {
    const sys = new FollowerSystem();
    expect(sys.followerHeal(50)).toBe(false);
  });

  it("followerTakeDamage ignores negative amounts", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    const before = sys.getActiveFollower()!.health;
    sys.followerTakeDamage(-10);
    expect(sys.getActiveFollower()!.health).toBe(before);
  });
});

// ── activeCarryWeightBonus ────────────────────────────────────────────────────

describe("FollowerSystem — activeCarryWeightBonus", () => {
  it("returns the template carry weight bonus while follower is active", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ carryWeightBonus: 75 }));
    sys.recruitFollower("test_follower");
    expect(sys.activeCarryWeightBonus).toBe(75);
  });

  it("returns 0 after follower is dismissed", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ carryWeightBonus: 75 }));
    sys.recruitFollower("test_follower");
    sys.dismissFollower();
    expect(sys.activeCarryWeightBonus).toBe(0);
  });
});

// ── Built-in follower spot-checks ─────────────────────────────────────────────

describe("FollowerSystem — built-in followers", () => {
  const sys = new FollowerSystem();

  it("Lydia has hireCost 0", () => {
    expect(sys.getFollowerTemplate("lydia")!.hireCost).toBe(0);
  });

  it("Jenassa has hireCost 500", () => {
    expect(sys.getFollowerTemplate("jenassa")!.hireCost).toBe(500);
  });

  it("J'zargo has combatRole mage", () => {
    expect(sys.getFollowerTemplate("j_zargo")!.combatRole).toBe("mage");
  });

  it("Aela has combatRole archer", () => {
    expect(sys.getFollowerTemplate("aela")!.combatRole).toBe("archer");
  });

  it("Farkas carries extra weight", () => {
    expect(sys.getFollowerTemplate("farkas")!.carryWeightBonus).toBeGreaterThan(0);
  });
});

// ── Save / restore ────────────────────────────────────────────────────────────

describe("FollowerSystem — getSaveState / restoreFromSave", () => {
  it("save → restore round-trips null active follower", () => {
    const sys  = new FollowerSystem();
    const sys2 = new FollowerSystem();
    sys2.restoreFromSave(sys.getSaveState());
    expect(sys2.getActiveFollower()).toBeNull();
  });

  it("save → restore round-trips active follower", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ level: 8 }));
    sys.recruitFollower("test_follower");
    sys.commandFollower("wait");
    sys.followerTakeDamage(20);

    const sys2 = new FollowerSystem();
    sys2.registerFollowerTemplate(makeTemplate({ level: 8 }));
    sys2.restoreFromSave(sys.getSaveState());

    const active = sys2.getActiveFollower()!;
    expect(active).not.toBeNull();
    expect(active.templateId).toBe("test_follower");
    expect(active.command).toBe("wait");
    expect(active.health).toBeLessThan(active.maxHealth);
    expect(active.isAlive).toBe(true);
  });

  it("save → restore round-trips deceased follower ids", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.followerTakeDamage(99999);

    const sys2 = new FollowerSystem();
    sys2.registerFollowerTemplate(makeTemplate());
    sys2.restoreFromSave(sys.getSaveState());

    expect(sys2.isFollowerDeceased("test_follower")).toBe(true);
    expect(sys2.canRecruit("test_follower").reason).toBe("follower_deceased");
  });

  it("restore does not fire callbacks", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    const saved = sys.getSaveState();

    const sys2 = new FollowerSystem();
    const cb   = vi.fn();
    sys2.onFollowerRecruited  = cb;
    sys2.onFollowerDismissed  = cb;
    sys2.restoreFromSave(saved);
    expect(cb).not.toHaveBeenCalled();
  });

  it("restore with malformed activeFollower sets active to null", () => {
    const badSave: FollowerSaveState = {
      activeFollower: null,
      deceasedFollowerIds: [],
    };
    const sys = new FollowerSystem();
    sys.restoreFromSave(badSave);
    expect(sys.getActiveFollower()).toBeNull();
  });

  it("hasFollower is true after restoring an active follower", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");

    const sys2 = new FollowerSystem();
    sys2.restoreFromSave(sys.getSaveState());
    expect(sys2.hasFollower).toBe(true);
  });
});

// ── Stance (Phase 2 — Avowed-inspired companion synergy) ─────────────────────

import {
  ROLE_ABILITIES,
  BUILTIN_COMBOS,
} from "./follower-system";
import type {
  FollowerStance,
  FollowerAbilityResult,
  ComboResult,
  ComboTrigger,
} from "./follower-system";

describe("FollowerSystem — stance", () => {
  it("initial stance is 'aggressive'", () => {
    const sys = new FollowerSystem();
    expect(sys.followerStance).toBe("aggressive");
  });

  it("setFollowerStance returns false when no follower is active", () => {
    const sys = new FollowerSystem();
    expect(sys.setFollowerStance("defensive")).toBe(false);
  });

  it("setFollowerStance changes the stance when a follower is active", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.setFollowerStance("defensive");
    expect(sys.followerStance).toBe("defensive");
  });

  it("setFollowerStance fires onStanceChanged callback", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    const cb = vi.fn();
    sys.onStanceChanged = cb;
    sys.setFollowerStance("stealth");
    expect(cb).toHaveBeenCalledWith("stealth");
  });

  it("setFollowerStance does NOT fire callback when stance is unchanged", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.setFollowerStance("defensive");
    const cb = vi.fn();
    sys.onStanceChanged = cb;
    sys.setFollowerStance("defensive"); // same stance
    expect(cb).not.toHaveBeenCalled();
  });

  it("setFollowerStance returns false when follower is dead", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate());
    sys.recruitFollower("test_follower");
    sys.followerTakeDamage(9999);
    expect(sys.setFollowerStance("stealth")).toBe(false);
  });
});

// ── Abilities (Phase 2) ───────────────────────────────────────────────────────

describe("FollowerSystem — triggerFollowerAbility()", () => {
  it("returns null when no follower is active", () => {
    const sys = new FollowerSystem();
    expect(sys.triggerFollowerAbility(10)).toBeNull();
  });

  it("triggers warrior ability (shield_bash) for warrior follower", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    const result = sys.triggerFollowerAbility(10);
    expect(result).not.toBeNull();
    expect(result!.ability.id).toBe("shield_bash");
  });

  it("triggers archer ability for archer follower", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "archer" }));
    sys.recruitFollower("test_follower");
    const result = sys.triggerFollowerAbility(10);
    expect(result!.ability.id).toBe("arrow_volley");
  });

  it("triggers mage ability for mage follower", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "mage" }));
    sys.recruitFollower("test_follower");
    const result = sys.triggerFollowerAbility(10);
    expect(result!.ability.id).toBe("arcane_surge");
  });

  it("triggers rogue ability for rogue follower", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "rogue" }));
    sys.recruitFollower("test_follower");
    const result = sys.triggerFollowerAbility(10);
    expect(result!.ability.id).toBe("smoke_bomb");
  });

  it("fires onAbilityUsed callback", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    const cb = vi.fn();
    sys.onAbilityUsed = cb;
    sys.triggerFollowerAbility(10);
    expect(cb).toHaveBeenCalledOnce();
    const arg = cb.mock.calls[0][0] as FollowerAbilityResult;
    expect(arg.ability.id).toBe("shield_bash");
    expect(arg.templateId).toBe("test_follower");
  });

  it("respects ability cooldown — returns null on second call within cooldown", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    sys.triggerFollowerAbility(10); // uses ability
    const second = sys.triggerFollowerAbility(11); // 1 hour later, warrior CD = 2h
    expect(second).toBeNull();
  });

  it("fires again after cooldown has elapsed", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    sys.triggerFollowerAbility(10); // warrior CD = 2h
    const result = sys.triggerFollowerAbility(12.1); // past cooldown
    expect(result).not.toBeNull();
  });

  it("abilityCooldownRemaining is 0 before first use", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    expect(sys.abilityCooldownRemaining(10)).toBe(0);
  });

  it("abilityCooldownRemaining reports remaining hours after use", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    sys.triggerFollowerAbility(10); // CD = 2h
    const remaining = sys.abilityCooldownRemaining(11);
    expect(remaining).toBeCloseTo(1, 5);
  });

  it("returns null when follower is dead", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    sys.followerTakeDamage(9999);
    expect(sys.triggerFollowerAbility(10)).toBeNull();
  });
});

// ── Combo synergy (Phase 2) ───────────────────────────────────────────────────

describe("FollowerSystem — notifyPlayerAction() combo synergy", () => {
  it("returns null when no follower is active", () => {
    const sys = new FollowerSystem();
    expect(sys.notifyPlayerAction("power_attack", 10)).toBeNull();
  });

  it("fires a synergy combo when player action matches follower role", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    const result = sys.notifyPlayerAction("power_attack", 10);
    expect(result).not.toBeNull();
    expect(result!.comboId).toBe("momentum_surge");
  });

  it("fires onComboTriggered callback", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    const cb = vi.fn();
    sys.onComboTriggered = cb;
    sys.notifyPlayerAction("power_attack", 10);
    expect(cb).toHaveBeenCalledOnce();
    const r = cb.mock.calls[0][0] as ComboResult;
    expect(r.comboId).toBe("momentum_surge");
  });

  it("returns null when player action does not match any registered combo", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    // warrior combos don't include cast_spell
    const result = sys.notifyPlayerAction("cast_spell", 10);
    expect(result).toBeNull();
  });

  it("returns null when follower role does not match the combo", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "archer" }));
    sys.recruitFollower("test_follower");
    // archer + power_attack has no built-in combo
    const result = sys.notifyPlayerAction("power_attack", 10);
    expect(result).toBeNull();
  });

  it("respects combo cooldown — does not fire before cooldown elapses", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    sys.notifyPlayerAction("power_attack", 10); // momentum_surge CD = 4h
    const second = sys.notifyPlayerAction("power_attack", 12); // 2h later
    expect(second).toBeNull();
  });

  it("fires again after combo cooldown elapses", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    sys.notifyPlayerAction("power_attack", 10); // CD = 4h
    const result = sys.notifyPlayerAction("power_attack", 14.1);
    expect(result).not.toBeNull();
  });

  it("returns null when follower is dead", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    sys.recruitFollower("test_follower");
    sys.followerTakeDamage(9999);
    expect(sys.notifyPlayerAction("power_attack", 10)).toBeNull();
  });

  it("archer + arrow_shot triggers rain_of_arrows", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "archer" }));
    sys.recruitFollower("test_follower");
    const result = sys.notifyPlayerAction("arrow_shot", 10);
    expect(result!.comboId).toBe("rain_of_arrows");
  });

  it("mage + cast_spell triggers arcane_resonance", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "mage" }));
    sys.recruitFollower("test_follower");
    const result = sys.notifyPlayerAction("cast_spell", 10);
    expect(result!.comboId).toBe("arcane_resonance");
  });

  it("rogue + sneak_attack triggers shadow_strike", () => {
    const sys = new FollowerSystem();
    sys.registerFollowerTemplate(makeTemplate({ combatRole: "rogue" }));
    sys.recruitFollower("test_follower");
    const result = sys.notifyPlayerAction("sneak_attack", 10);
    expect(result!.comboId).toBe("shadow_strike");
  });
});

// ── registerComboTrigger / removeComboTrigger ─────────────────────────────────

describe("FollowerSystem — registerComboTrigger / removeComboTrigger", () => {
  const customCombo: ComboTrigger = {
    comboId:       "custom_combo",
    comboName:     "Custom Combo",
    description:   "Custom synergy for testing.",
    playerAction:  "power_attack",
    followerRole:  "warrior",
    cooldownHours: 1,
  };

  it("registers a custom combo trigger", () => {
    const sys = new FollowerSystem();
    sys.registerComboTrigger(customCombo);
    expect(sys.getComboTrigger("custom_combo")).toBeDefined();
  });

  it("removeComboTrigger removes by id", () => {
    const sys = new FollowerSystem();
    sys.registerComboTrigger(customCombo);
    sys.removeComboTrigger("custom_combo");
    expect(sys.getComboTrigger("custom_combo")).toBeUndefined();
  });

  it("removeComboTrigger returns true when existing, false when unknown", () => {
    const sys = new FollowerSystem();
    sys.registerComboTrigger(customCombo);
    expect(sys.removeComboTrigger("custom_combo")).toBe(true);
    expect(sys.removeComboTrigger("custom_combo")).toBe(false);
  });

  it("registeredComboIds includes built-in combos", () => {
    const sys = new FollowerSystem();
    expect(sys.registeredComboIds).toContain("momentum_surge");
    expect(sys.registeredComboIds).toContain("rain_of_arrows");
  });
});

// ── Save / restore with v28 additions ────────────────────────────────────────

describe("FollowerSystem — save/restore (stance + ability + combo cooldowns)", () => {
  it("saves and restores stance", () => {
    const a = new FollowerSystem();
    a.registerFollowerTemplate(makeTemplate());
    a.recruitFollower("test_follower");
    a.setFollowerStance("stealth");
    const saved = a.getSaveState();

    const b = new FollowerSystem();
    b.restoreFromSave(saved);
    expect(b.followerStance).toBe("stealth");
  });

  it("defaults stance to 'aggressive' on old saves without stance field", () => {
    const sys = new FollowerSystem();
    sys.restoreFromSave({
      activeFollower: null,
      deceasedFollowerIds: [],
      // no stance field — old save format
    });
    expect(sys.followerStance).toBe("aggressive");
  });

  it("saves and restores abilityLastUsedAtHours", () => {
    const a = new FollowerSystem();
    a.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    a.recruitFollower("test_follower");
    a.triggerFollowerAbility(8);
    const saved = a.getSaveState();

    const b = new FollowerSystem();
    b.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    b.restoreFromSave(saved);

    // Ability should still be on cooldown at hour 9
    expect(b.triggerFollowerAbility(9)).toBeNull();
    // Off cooldown at 10.1 (CD = 2h)
    const result = b.triggerFollowerAbility(10.1);
    expect(result).not.toBeNull();
  });

  it("saves and restores comboLastUsedAtHours", () => {
    const a = new FollowerSystem();
    a.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    a.recruitFollower("test_follower");
    a.notifyPlayerAction("power_attack", 10); // momentum_surge CD = 4h
    const saved = a.getSaveState();

    const b = new FollowerSystem();
    b.registerFollowerTemplate(makeTemplate({ combatRole: "warrior" }));
    b.restoreFromSave(saved);

    // Still on cooldown at hour 12
    expect(b.notifyPlayerAction("power_attack", 12)).toBeNull();
    // Off cooldown at 14.1
    expect(b.notifyPlayerAction("power_attack", 14.1)).not.toBeNull();
  });
});
