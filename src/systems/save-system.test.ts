import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SaveSystem, SaveData } from './save-system';
import { Item } from './inventory-system';

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
        expect(data.version).toBe(6);
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

    it('should show a load notification on success', () => {
        saveSystem.save();
        saveSystem.load();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Game Loaded!', 2500);
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

    it('should reject saves with a mismatched version', () => {
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
        expect(mockUI.showNotification).toHaveBeenCalledWith('Incompatible save version.', 2500);
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
        expect(mockUI.showNotification).toHaveBeenCalledWith('Import failed: incompatible save version.', 2500);
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
