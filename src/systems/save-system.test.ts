import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SaveSystem, SaveData, OLD_SAVE_MESSAGE } from './save-system';
import { Item } from './inventory-system';
import { listen } from "../testing/listen";

describe('SaveSystem', () => {
    let saveSystem: SaveSystem;
    let mockPlayer: any;
    let mockInventory: any;
    let mockEquipment: any;
    let mockSkills: any;
    let mockFrameworkRuntime: any;
    let mockUI: any;
    let localStorageMock: Record<string, string>;

    const sword: Item = {
        id: 'sword_01', name: 'Iron Sword', description: 'Desc',
        stackable: false, quantity: 1, slot: 'mainHand', stats: { damage: 10 }
    };
    const potion: Item = {
        id: 'potion_01', name: 'Health Potion', description: 'Desc',
        stackable: true, quantity: 3
    };

    beforeEach(() => {
        // Stub localStorage
        localStorageMock = {};
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
            setItem: vi.fn((key: string, val: string) => { localStorageMock[key] = val; }),
            removeItem: vi.fn((key: string) => { delete localStorageMock[key]; }),
        });

        mockPlayer = {
            camera: { position: { x: 1, y: 5, z: 3 } },
            health: 80,
            magicka: 60,
            stamina: 90,
            level: 1,
            experience: 0,
            experienceToNextLevel: 100,
            maxHealth: 100,
            maxMagicka: 100,
            maxStamina: 100,
        };
        mockInventory = { items: [{ ...potion }] };
        mockEquipment = {
            getEquipped: vi.fn(() => new Map([['mainHand', sword]])),
            equipSilent: vi.fn(),
            unequipSilent: vi.fn(),
            refreshUI: vi.fn(),
        };
        mockSkills = {
            getSaveState: vi.fn(() => []),
            restoreState: vi.fn(),
        };
        mockFrameworkRuntime = {
            getSaveSnapshot: vi.fn(() => ({
                dialogueState: { active: "guard_intro" },
                questState: {},
                inventoryState: {},
                factionState: {},
                flags: { accepted_job: true },
            })),
            restoreFromSave: vi.fn(),
        };
        mockUI = { showNotification: vi.fn() };

        saveSystem = new SaveSystem(mockPlayer, mockInventory, mockEquipment, mockUI);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // ── save() ──────────────────────────────────────────────────────────────

    it('should persist player stats, inventory, and equipment to localStorage', () => {
        saveSystem.save();
        expect(localStorage.setItem).toHaveBeenCalledOnce();
        const raw = localStorageMock['camelot_save'];
        const data: SaveData = JSON.parse(raw);
        expect(data.version).toBe(30);
        expect(data.player.health).toBe(80);
        expect(data.player.magicka).toBe(60);
        expect(data.player.stamina).toBe(90);
        expect(data.player.position).toEqual({ x: 1, y: 5, z: 3 });
        expect(data.inventory).toHaveLength(1);
        expect(data.inventory[0].id).toBe('potion_01');
        expect(data.equipment).toHaveLength(1);
        expect(data.equipment[0].slot).toBe('mainHand');
        expect(data.equipment[0].item.id).toBe('sword_01');
    });

    it("the Continue line shows the character level (the HUD's), not the experience level", () => {
        const store = new Map<string, string>();
        saveSystem.setStorage({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); }, removeItem: (k) => { store.delete(k); } } as never);
        saveSystem.save(true);
        const key = [...store.keys()][0];
        const data = JSON.parse(store.get(key)!);
        store.set(key, JSON.stringify({ ...data, player: { ...data.player, level: 9 }, playerLevel: { characterLevel: 4 } }));
        expect(saveSystem.peekSummary()?.level).toBe(4);
    });

    it('runs onBeforeSave before serialising, so its changes land in the save', () => {
        listen(saveSystem, "save:beforeSave", (_p) => (() => { mockInventory.items[0].instanceId = 'tidied'; })());
        saveSystem.save();
        const data: SaveData = JSON.parse(localStorageMock['camelot_save']);
        expect(data.inventory[0].instanceId).toBe('tidied');
    });

    it('a renamed part is read from its former key in a save from before the rename', () => {
        const loads: unknown[] = [];
        const unregister = saveSystem.registerCodec({ key: 'oldTongue', save: () => ({ awen: 1 }), load: (d) => { loads.push(d); } });
        saveSystem.save();
        const raw = JSON.parse(localStorageMock['camelot_save']);
        raw.dragonShouts = { dragonSouls: 3 };
        delete raw.oldTongue;
        localStorageMock['camelot_save'] = JSON.stringify(raw);
        expect(saveSystem.load()).toBe(true);
        expect(loads.at(-1)).toEqual({ dragonSouls: 3 });
        unregister();
    });

    it('feature codecs own their part of the save: written, read back, and absent saves reset', () => {
        let pets = ['wolf'];
        const loads: unknown[] = [];
        const unregister = saveSystem.registerCodec({
            key: 'pets', save: () => ({ owned: pets }), load: (d) => { loads.push(d); pets = (d as { owned: string[] } | undefined)?.owned ?? []; },
        });
        expect(() => saveSystem.registerCodec({ key: 'pets', save: () => 1, load: () => {} }), 'one owner per key').toThrow();
        saveSystem.save();
        expect(JSON.parse(localStorageMock['camelot_save']).pets).toEqual({ owned: ['wolf'] });
        pets = [];
        expect(saveSystem.load()).toBe(true);
        expect(pets).toEqual(['wolf']);

        // An older save without the key: the codec gets undefined and resets.
        const raw = JSON.parse(localStorageMock['camelot_save']);
        delete raw.pets;
        localStorageMock['camelot_save'] = JSON.stringify(raw);
        saveSystem.load();
        expect(loads.at(-1)).toBeUndefined();
        expect(pets).toEqual([]);

        // A codec that throws doesn't stop the load.
        const bad = saveSystem.registerCodec({ key: 'bad', save: () => undefined, load: () => { throw new Error('boom'); } });
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(saveSystem.load()).toBe(true);
        err.mockRestore();
        bad();
        unregister();
        saveSystem.save();
        expect(JSON.parse(localStorageMock['camelot_save']).pets, 'gone once unregistered').toBeUndefined();
    });

    it('round-trips every built-in part through its codec, in load order', () => {
        const special = new Set(['setStorage', 'setQuestSystem', 'setSkillTreeSystem', 'setFrameworkRuntime', 'setAttributeSystem', 'setAutosaveInterval', 'setMaximaRestorer']);
        const setters = Object.getOwnPropertyNames(SaveSystem.prototype).filter((n) => n.startsWith('set') && !special.has(n));
        expect(setters.length, 'every system setter').toBeGreaterThanOrEqual(36);
        const restored: Array<{ setter: string; data: unknown }> = [];
        for (const setter of setters) {
            const value = { from: setter };
            const stub = {
                getSaveState: () => value, getSnapshot: () => value,
                restoreFromSave: (d: unknown) => restored.push({ setter, data: d }),
                restoreSnapshot: (d: unknown) => restored.push({ setter, data: d }),
            };
            (saveSystem as any)[setter](stub);
        }
        saveSystem.save();
        expect(saveSystem.load()).toBe(true);
        expect(restored.map((r) => r.setter).sort()).toEqual([...setters].sort());
        for (const r of restored) expect(r.data, r.setter).toEqual({ from: r.setter });
        // Time restores before the daily schedule re-derives who is asleep.
        const order = restored.map((r) => r.setter);
        expect(order.indexOf('setTimeSystem')).toBeLessThan(order.indexOf('setScheduleSleep'));
    });

    it('should show a save notification', () => {
        saveSystem.save();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Game Saved!', 2500);
    });

    it('should include framework save payload when runtime is configured', () => {
        saveSystem.setFrameworkRuntime(mockFrameworkRuntime);
        saveSystem.save();
        const raw = localStorageMock['camelot_save'];
        const data: SaveData = JSON.parse(raw);
        expect(typeof data.framework).toBe('string');
        expect(mockFrameworkRuntime.getSaveSnapshot).toHaveBeenCalled();
    });

    it('hasSave returns false when nothing is saved', () => {
        expect(saveSystem.hasSave()).toBe(false);
    });

    it('hasSave returns true after save', () => {
        saveSystem.save();
        expect(saveSystem.hasSave()).toBe(true);
    });

    it('deleteSave removes the save', () => {
        saveSystem.save();
        saveSystem.deleteSave();
        expect(saveSystem.hasSave()).toBe(false);
    });



    it('autosave persists once the interval elapses while dirty', () => {
        saveSystem.setAutosaveInterval(5);
        saveSystem.markDirty();

        saveSystem.tickAutosave(2);
        expect(localStorage.setItem).not.toHaveBeenCalled();

        saveSystem.tickAutosave(3);
        expect(localStorage.setItem).toHaveBeenCalledOnce();
    });

    it('autosave does not run when state is not dirty', () => {
        saveSystem.setAutosaveInterval(1);
        saveSystem.tickAutosave(10);
        expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('manual save clears dirty autosave state', () => {
        saveSystem.setAutosaveInterval(1);
        saveSystem.markDirty();
        saveSystem.save();

        (localStorage.setItem as any).mockClear();
        saveSystem.tickAutosave(5);
        expect(localStorage.setItem).not.toHaveBeenCalled();
    });


    // ── load() ──────────────────────────────────────────────────────────────

    it('should notify and return false when no save exists', () => {
        const result = saveSystem.load();
        expect(result).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('No save file found.', 2500);
    });

    it('should restore player stats and position from save', () => {
        saveSystem.save();

        // Mutate player to simulate time passing
        mockPlayer.health = 10;
        mockPlayer.camera.position = { x: 99, y: 99, z: 99 };

        const result = saveSystem.load();
        expect(result).toBe(true);
        expect(mockPlayer.health).toBe(80);
        expect(mockPlayer.magicka).toBe(60);
        expect(mockPlayer.stamina).toBe(90);
        // Vector3 constructor is called; just check the values were set
        expect(mockPlayer.camera.position.x).toBe(1);
        expect(mockPlayer.camera.position.y).toBe(5);
        expect(mockPlayer.camera.position.z).toBe(3);
    });

    it('should restore inventory from save', () => {
        saveSystem.save();
        mockInventory.items = [];

        saveSystem.load();
        expect(mockInventory.items).toHaveLength(1);
        expect(mockInventory.items[0].id).toBe('potion_01');
    });

    it('should restore equipment via equipSilent and call refreshUI', () => {
        saveSystem.save();
        mockEquipment.getEquipped.mockReturnValue(new Map());

        saveSystem.load();
        expect(mockEquipment.equipSilent).toHaveBeenCalledWith(expect.objectContaining({ id: 'sword_01' }), 'mainHand');
        expect(mockEquipment.refreshUI).toHaveBeenCalled();
    });

    it('should unequip all current equipment before loading', () => {
        saveSystem.save();
        // Pretend something is already equipped before load
        mockEquipment.getEquipped.mockReturnValue(new Map([['head', { id: 'helm_01' }]]));

        saveSystem.load();
        expect(mockEquipment.unequipSilent).toHaveBeenCalledWith('head');
    });

    it('takes the old gear off before resetting stats and puts the saved gear on after the maxima', () => {
        // Real gear arithmetic: an amulet adds to max health, a sword to damage.
        const amulet = { id: 'amulet', name: 'Amulet', description: '', stackable: false, quantity: 1, slot: 'neck', stats: { healthBonus: 20 } };
        const worn = new Map<string, any>([['neck', amulet], ['mainHand', sword]]);
        mockEquipment.getEquipped.mockImplementation(() => worn);
        mockEquipment.equipSilent.mockImplementation((item: any, slot: string) => {
            worn.set(slot, item);
            mockPlayer.maxHealth += item.stats?.healthBonus ?? 0;
            mockPlayer.bonusDamage = (mockPlayer.bonusDamage ?? 0) + (item.stats?.damage ?? 0);
        });
        mockEquipment.unequipSilent.mockImplementation((slot: string) => {
            const item = worn.get(slot);
            worn.delete(slot);
            mockPlayer.maxHealth -= item?.stats?.healthBonus ?? 0;
            mockPlayer.bonusDamage = (mockPlayer.bonusDamage ?? 0) - (item?.stats?.damage ?? 0);
        });
        mockPlayer.maxHealth = 120;
        mockPlayer.health = 120;
        mockPlayer.bonusDamage = sword.stats?.damage ?? 0;
        saveSystem.save();
        const restore = vi.fn();
        saveSystem.setMaximaRestorer(restore);

        saveSystem.load();
        expect(mockPlayer.bonusDamage, 'the sword still counts once').toBe(sword.stats?.damage ?? 0);
        expect(mockPlayer.maxHealth, 'the amulet lands on top of the reset maximum').toBe(120);
        expect(mockPlayer.health, 'full health stays full').toBe(120);
        expect(restore).toHaveBeenCalledOnce();
    });

    it('should show a load notification on success', () => {
        saveSystem.save();
        saveSystem.load();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Game Loaded!', 2500);
    });

    it('should round-trip the player name', () => {
        mockPlayer.name = 'Aldric';
        saveSystem.save();
        mockPlayer.name = 'Someone Else';
        saveSystem.load();
        expect(mockPlayer.name).toBe('Aldric');
    });

    it('should keep the default name when the save has none', () => {
        saveSystem.save();
        mockPlayer.name = 'Someone Else';
        saveSystem.load();
        expect(mockPlayer.name).toBe('Someone Else');
    });

    it('should restore feature-owned state (e.g. pickpocket stats) instead of dropping it', () => {
        const mockPickpocket = {
            getSaveState: vi.fn(() => ({ totalAttempts: 3, totalSuccesses: 2, totalCaught: 1 })),
            restoreFromSave: vi.fn(),
        };
        saveSystem.registerCodec({
            key: 'pickpocket', save: () => mockPickpocket.getSaveState(), load: (d) => mockPickpocket.restoreFromSave(d),
        });
        saveSystem.save();

        mockPickpocket.restoreFromSave.mockClear();
        const result = saveSystem.load();
        expect(result).toBe(true);
        expect(mockPickpocket.restoreFromSave).toHaveBeenCalledWith(
            expect.objectContaining({ totalAttempts: 3, totalSuccesses: 2, totalCaught: 1 }),
        );
    });

    it('load restores attribute-derived maxima and clamps resources to them', () => {
        const mockAttributes = {
            getSaveState: vi.fn(() => ({ attributes: { endurance: 70 } })),
            restoreFromSave: vi.fn(),
            maxHealth: 180,
            maxMagicka: 140,
            maxStamina: 140,
            carryWeight: 300,
        };
        saveSystem.setAttributeSystem(mockAttributes as any);

        // Saved while attribute-boosted: resource values above the collapsed maxima
        mockPlayer.health = 170;
        mockPlayer.magicka = 130;
        mockPlayer.stamina = 135;
        saveSystem.save();

        // Simulate the level-only maxima estimate that load applies mid-restore
        mockPlayer.maxHealth = 100;
        mockPlayer.maxMagicka = 100;
        mockPlayer.maxStamina = 100;

        const result = saveSystem.load();
        expect(result).toBe(true);
        expect(mockAttributes.restoreFromSave).toHaveBeenCalled();
        expect(mockPlayer.maxHealth).toBe(180);
        expect(mockPlayer.maxMagicka).toBe(140);
        expect(mockPlayer.maxStamina).toBe(140);
        expect(mockPlayer.maxCarryWeight).toBe(300);
        expect(mockPlayer.health).toBe(170);
        expect(mockPlayer.magicka).toBe(130);
        expect(mockPlayer.stamina).toBe(135);
    });

    it('load clamps saved resources that exceed the restored maxima', () => {
        const mockAttributes = {
            getSaveState: vi.fn(() => ({ attributes: { endurance: 70 } })),
            restoreFromSave: vi.fn(),
            maxHealth: 180,
            maxMagicka: 140,
            maxStamina: 140,
            carryWeight: 300,
        };
        saveSystem.setAttributeSystem(mockAttributes as any);
        mockPlayer.health = 500; // saved while some temporary boost was active
        saveSystem.save();

        const result = saveSystem.load();
        expect(result).toBe(true);
        expect(mockPlayer.health).toBeLessThanOrEqual(mockPlayer.maxHealth);
    });

    it('should round-trip the stealth crouch state into save slots', () => {
        const mockStealth = {
            getSaveState: vi.fn(() => ({ isCrouching: true })),
            restoreFromSave: vi.fn(),
        };
        saveSystem.setStealthSystem(mockStealth as any);
        saveSystem.save();

        mockStealth.restoreFromSave.mockClear();
        const result = saveSystem.load();
        expect(result).toBe(true);
        expect(mockStealth.restoreFromSave).toHaveBeenCalledWith({ isCrouching: true });
    });

    it('should round-trip player combat status effects into save slots', () => {
        const effect = {
            type: 'poison',
            damagePerTick: 2,
            tickInterval: 1.5,
            tickTimer: 0.4,
            remainingDuration: 7,
        };
        const mockCombat = {
            getSaveState: vi.fn(() => [effect]),
            restoreFromSave: vi.fn(),
        };
        saveSystem.setCombatSystem(mockCombat as any);
        saveSystem.save();

        const raw = localStorageMock['camelot_save'];
        const data: SaveData = JSON.parse(raw);
        expect(data.combatEffects).toEqual([effect]);

        mockCombat.restoreFromSave.mockClear();
        const result = saveSystem.load();
        expect(result).toBe(true);
        expect(mockCombat.restoreFromSave).toHaveBeenCalledWith([effect]);
    });

    it('should omit stealth/combatEffects fields when those systems are not wired', () => {
        saveSystem.save();
        const data: SaveData = JSON.parse(localStorageMock['camelot_save']);
        expect(data.stealth).toBeUndefined();
        expect(data.combatEffects).toBeUndefined();
    });

    it('restores framework runtime state when framework data exists', () => {
        saveSystem.setFrameworkRuntime(mockFrameworkRuntime);
        saveSystem.save();

        saveSystem.load();
        expect(mockFrameworkRuntime.restoreFromSave).toHaveBeenCalled();
    });

    it('should restore an empty skill state when save has no skills', () => {
        saveSystem.setSkillTreeSystem(mockSkills);
        saveSystem.save();

        mockSkills.restoreState.mockClear();
        const result = saveSystem.load();
        expect(result).toBe(true);
        expect(mockSkills.restoreState).toHaveBeenCalledWith([]);
    });

    it('should handle corrupt JSON gracefully', () => {
        localStorageMock['camelot_save'] = 'not-valid-json{{{';
        const result = saveSystem.load();
        expect(result).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Save file is corrupt.', 2500);
    });


    it('should reject save data with corrupt player structure', () => {
        localStorageMock['camelot_save'] = JSON.stringify({
            version: 6,
            timestamp: Date.now(),
            player: { position: { x: 0, y: 0 }, health: 100, magicka: 100, stamina: 100, level: 1, experience: 0, experienceToNextLevel: 100 },
            inventory: [],
            equipment: [],
            quests: [],
        });

        const result = saveSystem.load();
        expect(result).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Save file is corrupt.', 2500);
    });

    it('importFromJson returns false for corrupt save structure', () => {
        const result = saveSystem.importFromJson(JSON.stringify({
            version: 6,
            timestamp: Date.now(),
            player: { position: { x: 0, y: 0, z: 0 }, health: 100, magicka: 100, stamina: 100, level: 1, experience: 0, experienceToNextLevel: 100 },
            inventory: {},
            equipment: [],
            quests: [],
        }));

        expect(result).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Import failed: corrupt save structure.', 2500);
    });

    it('should reject saves with a mismatched version (too new)', () => {
        const badData: SaveData = {
            version: 999,
            timestamp: Date.now(),
            player: { position: { x: 0, y: 0, z: 0 }, health: 100, magicka: 100, stamina: 100, level: 1, experience: 0, experienceToNextLevel: 100 },
            inventory: [],
            equipment: [],
            quests: [],
        };
        localStorageMock['camelot_save'] = JSON.stringify(badData);
        const result = saveSystem.load();
        expect(result).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith(OLD_SAVE_MESSAGE, 4000);
    });

    it('should reject saves from before the game\'s own setting (v29)', () => {
        const oldData: SaveData = {
            version: 29,
            timestamp: Date.now(),
            player: { position: { x: 0, y: 0, z: 0 }, health: 100, magicka: 100, stamina: 100, level: 1, experience: 0, experienceToNextLevel: 100 },
            inventory: [],
            equipment: [],
            quests: [],
        };
        localStorageMock['camelot_save'] = JSON.stringify(oldData);
        const result = saveSystem.load();
        expect(result).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith(OLD_SAVE_MESSAGE, 4000);
    });

    it('should load a v30 save whose optional parts are absent', () => {
        const v5Data: SaveData = {
            version: 30,
            timestamp: Date.now(),
            player: { position: { x: 1, y: 2, z: 3 }, health: 75, magicka: 50, stamina: 90, level: 2, experience: 50, experienceToNextLevel: 200 },
            inventory: [],
            equipment: [],
            quests: [],
            // optional parts (spells, persuasion, …) absent — handled gracefully
        };
        localStorageMock['camelot_save'] = JSON.stringify(v5Data);
        const result = saveSystem.load();
        expect(result).toBe(true);
        expect(mockPlayer.health).toBe(75);
        expect(mockPlayer.stamina).toBe(90);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Game Loaded!', 2500);
    });

    // ── importFromJson() ───────────────────────────────────────────────────

    it('importFromJson returns false for invalid JSON', () => {
        const result = saveSystem.importFromJson('{bad json!!}');
        expect(result).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Import failed: invalid JSON.', 2500);
    });

    it('importFromJson returns false for wrong version', () => {
        saveSystem.save();
        const raw = localStorageMock['camelot_save'];
        const data = JSON.parse(raw);
        data.version = 999;
        const result = saveSystem.importFromJson(JSON.stringify(data));
        expect(result).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith(`Import failed. ${OLD_SAVE_MESSAGE}`, 4000);
    });

    it('importFromJson loads valid save data and notifies the player', () => {
        saveSystem.save();
        const raw = localStorageMock['camelot_save'];

        // Mutate state to simulate a different session
        mockPlayer.health = 1;

        const result = saveSystem.importFromJson(raw);
        expect(result).toBe(true);
        expect(mockPlayer.health).toBe(80); // restored from exported save
    });
});
