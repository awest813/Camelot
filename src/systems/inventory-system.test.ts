import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InventorySystem, Item } from './inventory-system';

describe('InventorySystem', () => {
    let inventorySystem: InventorySystem;
    let mockPlayer: any;
    let mockUI: any;
    let mockCanvas: any;

    beforeEach(() => {
        mockPlayer = {
            camera: {
                detachControl: vi.fn(),
                attachControl: vi.fn(),
            },
            canvas: {
                requestPointerLock: vi.fn(),
            }
        };
        mockUI = {
            toggleInventory: vi.fn(),
            updateInventory: vi.fn(),
            setInteractionText: vi.fn(), // Added this mock
            showNotification: vi.fn(),
        };
        mockCanvas = {
            requestPointerLock: vi.fn(),
        };

            inventorySystem = new InventorySystem(mockPlayer, mockUI, mockCanvas);

        vi.stubGlobal('document', { exitPointerLock: vi.fn() });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should add an item', () => {
        const item: Item = { id: '1', name: 'Test Item', description: 'Desc', stackable: false, quantity: 1 };
        const result = inventorySystem.addItem(item);
        expect(result).toBe(true);
        expect(inventorySystem.items.length).toBe(1);
        expect(mockUI.updateInventory).toHaveBeenCalled();
    });

    it('should stack stackable items', () => {
        const item: Item = { id: '1', name: 'Test Item', description: 'Desc', stackable: true, quantity: 1 };
        inventorySystem.addItem(item);
        inventorySystem.addItem(item);
        expect(inventorySystem.items.length).toBe(1);
        expect(inventorySystem.items[0].quantity).toBe(2);
    });

    it('should not stack non-stackable items', () => {
        const item: Item = { id: '1', name: 'Test Item', description: 'Desc', stackable: false, quantity: 1 };
        inventorySystem.addItem(item);
        inventorySystem.addItem(item);
        expect(inventorySystem.items.length).toBe(2);
    });

    it('should remove an item', () => {
        const item: Item = { id: '1', name: 'Test Item', description: 'Desc', stackable: false, quantity: 1 };
        inventorySystem.addItem(item);
        const result = inventorySystem.removeItem('1');
        expect(result).toBe(true);
        expect(inventorySystem.items.length).toBe(0);
    });

    it('should toggle inventory', () => {
        inventorySystem.toggleInventory();
        expect(inventorySystem.isOpen).toBe(true);
        expect(mockUI.toggleInventory).toHaveBeenCalledWith(true);
        expect(mockPlayer.camera.detachControl).toHaveBeenCalled();
        expect(mockUI.setInteractionText).toHaveBeenCalledWith(""); // Verify interaction text clear

        inventorySystem.toggleInventory();
        expect(inventorySystem.isOpen).toBe(false);
        expect(mockUI.toggleInventory).toHaveBeenCalledWith(false);
        expect(mockPlayer.camera.attachControl).toHaveBeenCalled();
    });

    // ── useItem ───────────────────────────────────────────────────────────────

    it('useItem restores health from a potion and removes it from inventory', () => {
        const potion: Item = { id: 'hp_01', name: 'Health Potion', description: '', stackable: true, quantity: 1, stats: { heal: 50 } };
        mockPlayer.health = 40;
        mockPlayer.maxHealth = 100;
        inventorySystem.addItem(potion);

        const result = inventorySystem.useItem('hp_01');

        expect(result).toBe(true);
        expect(mockPlayer.health).toBe(90);
        expect(inventorySystem.items.length).toBe(0); // removed
        expect(mockUI.showNotification).toHaveBeenCalledWith('Used Health Potion. +50 HP', 2000);
    });

    it('useItem does not exceed maxHealth', () => {
        const potion: Item = { id: 'hp_01', name: 'Health Potion', description: '', stackable: true, quantity: 1, stats: { heal: 50 } };
        mockPlayer.health = 90;
        mockPlayer.maxHealth = 100;
        inventorySystem.addItem(potion);

        inventorySystem.useItem('hp_01');

        expect(mockPlayer.health).toBe(100); // clamped to max
    });

    it('useItem returns false for non-consumable items', () => {
        const sword: Item = { id: 'sword_01', name: 'Iron Sword', description: '', stackable: false, quantity: 1, slot: 'mainHand', stats: { damage: 10 } };
        inventorySystem.addItem(sword);

        const result = inventorySystem.useItem('sword_01');

        expect(result).toBe(false);
        expect(inventorySystem.items.length).toBe(1); // not removed
    });

    it('useItem returns false for unknown item id', () => {
        const result = inventorySystem.useItem('nonexistent');
        expect(result).toBe(false);
    });

    it('useItem decrements stack quantity rather than removing when quantity > 1', () => {
        const potion: Item = { id: 'hp_01', name: 'Health Potion', description: '', stackable: true, quantity: 3, stats: { heal: 30 } };
        mockPlayer.health = 50;
        mockPlayer.maxHealth = 100;
        inventorySystem.addItem(potion);

        inventorySystem.useItem('hp_01');

        expect(inventorySystem.items.length).toBe(1);
        expect(inventorySystem.items[0].quantity).toBe(2);
        expect(mockPlayer.health).toBe(80);
    });
});
