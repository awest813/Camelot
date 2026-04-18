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
