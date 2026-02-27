import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveSystem } from './save-system';
import { Item } from './inventory-system';
import { EquipSlot } from './equipment-system';

const SAVE_KEY = 'camelot_save';

describe('SaveSystem', () => {
    let saveSystem: SaveSystem;
    let mockPlayer: any;
    let mockInventory: any;
    let mockEquipment: any;
    let mockUI: any;

    const sword: Item = {
        id: 'sword_01',
        name: 'Iron Sword',
        description: 'A rusty iron sword.',
        stackable: false,
        quantity: 1,
        slot: 'mainHand',
        stats: { damage: 10 }
    };

    beforeEach(() => {
        localStorage.clear();

        mockPlayer = {
            camera: {
                position: { x: 1, y: 5, z: 3, set: vi.fn() },
            },
            health: 80,
            magicka: 60,
            stamina: 100,
            maxHealth: 100,
            maxMagicka: 100,
            maxStamina: 100,
            bonusDamage: 10,
            bonusArmor: 2,
        };

        mockInventory = {
            items: [{ ...sword }],
        };

        const equippedSlots = new Map<EquipSlot, Item>();
        equippedSlots.set('mainHand', { ...sword });
        mockEquipment = {
            getEquipped: vi.fn(() => equippedSlots),
            restoreFromSave: vi.fn(),
        };

        mockUI = {
            showNotification: vi.fn(),
        };

        saveSystem = new SaveSystem(mockPlayer, mockInventory, mockEquipment, mockUI);
    });

    it('should save game state to localStorage', () => {
        saveSystem.save();
        const raw = localStorage.getItem(SAVE_KEY);
        expect(raw).not.toBeNull();
        const data = JSON.parse(raw!);
        expect(data.version).toBe(1);
        expect(data.player.health).toBe(80);
        expect(data.player.magicka).toBe(60);
        expect(data.player.bonusDamage).toBe(10);
        expect(data.inventory).toHaveLength(1);
        expect(data.equipment['mainHand']).toBeDefined();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Game Saved!', 2000);
    });

    it('should save player position', () => {
        saveSystem.save();
        const data = JSON.parse(localStorage.getItem(SAVE_KEY)!);
        expect(data.player.position).toEqual({ x: 1, y: 5, z: 3 });
    });

    it('should load game state from localStorage', () => {
        saveSystem.save();

        // Mutate player to simulate different state before load
        mockPlayer.health = 10;
        mockPlayer.bonusDamage = 0;
        mockInventory.items = [];

        saveSystem.load();

        expect(mockPlayer.health).toBe(80);
        expect(mockPlayer.bonusDamage).toBe(10);
        expect(mockInventory.items).toHaveLength(1);
        expect(mockEquipment.restoreFromSave).toHaveBeenCalled();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Game Loaded!', 2000);
    });

    it('should restore player position on load', () => {
        saveSystem.save();
        saveSystem.load();
        expect(mockPlayer.camera.position.set).toHaveBeenCalledWith(1, 5, 3);
    });

    it('should notify when no save file found', () => {
        saveSystem.load();
        expect(mockUI.showNotification).toHaveBeenCalledWith('No save file found.', 2000);
    });

    it('should notify when save file is incompatible', () => {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 99 }));
        saveSystem.load();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Save file incompatible.', 2000);
    });

    it('should notify when save file is corrupted', () => {
        localStorage.setItem(SAVE_KEY, 'not-valid-json{{{');
        saveSystem.load();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Failed to load save.', 2000);
    });

    it('hasSave returns false when no save exists', () => {
        expect(saveSystem.hasSave()).toBe(false);
    });

    it('hasSave returns true after saving', () => {
        saveSystem.save();
        expect(saveSystem.hasSave()).toBe(true);
    });
});
