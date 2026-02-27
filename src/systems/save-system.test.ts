import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SaveSystem, SaveData } from './save-system';
import { Item } from './inventory-system';

describe('SaveSystem', () => {
    let saveSystem: SaveSystem;
    let mockPlayer: any;
    let mockInventory: any;
    let mockEquipment: any;
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
        };
        mockInventory = { items: [{ ...potion }] };
        mockEquipment = {
            getEquipped: vi.fn(() => new Map([['mainHand', sword]])),
            equipSilent: vi.fn(),
            unequipSilent: vi.fn(),
            refreshUI: vi.fn(),
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
        expect(data.version).toBe(1);
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

    it('should handle corrupt JSON gracefully', () => {
        localStorageMock['camelot_save'] = 'not-valid-json{{{';
        const result = saveSystem.load();
        expect(result).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Save file is corrupt.', 2500);
    });

    it('should reject saves with a mismatched version', () => {
        const badData: SaveData = {
            version: 999,
            timestamp: Date.now(),
            player: { position: { x: 0, y: 0, z: 0 }, health: 100, magicka: 100, stamina: 100 },
            inventory: [],
            equipment: [],
        };
        localStorageMock['camelot_save'] = JSON.stringify(badData);
        const result = saveSystem.load();
        expect(result).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Incompatible save version.', 2500);
    });
});
