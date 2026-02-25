import { describe, it, expect, vi, beforeEach } from 'vitest';
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
            toggleCharacterMenu: vi.fn(),
            updateInventory: vi.fn(),
            updateStats: vi.fn(), // Added mock for updateStats
            setInteractionText: vi.fn(),
            addNotification: vi.fn(),
        };
        mockCanvas = {
            requestPointerLock: vi.fn(),
        };

        inventorySystem = new InventorySystem(mockPlayer, mockUI, mockCanvas);
    });

    it('should add an item', () => {
        const item: Item = { id: '1', name: 'Test Item', description: 'Desc', stackable: false, quantity: 1 };
        const result = inventorySystem.addItem(item);
        expect(result).toBe(true);
        expect(inventorySystem.items.length).toBe(1);
        expect(mockUI.updateInventory).toHaveBeenCalled();
        expect(mockUI.addNotification).toHaveBeenCalled();
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

    it('should toggle character menu', () => {
        // Mock document.exitPointerLock
        document.exitPointerLock = vi.fn();

        inventorySystem.toggleCharacterMenu();
        expect(inventorySystem.isOpen).toBe(true);
        expect(mockUI.toggleCharacterMenu).toHaveBeenCalledWith(true);
        expect(mockPlayer.camera.detachControl).toHaveBeenCalled();
        expect(mockUI.setInteractionText).toHaveBeenCalledWith("");
        expect(mockUI.updateStats).toHaveBeenCalled();

        inventorySystem.toggleCharacterMenu();
        expect(inventorySystem.isOpen).toBe(false);
        expect(mockUI.toggleCharacterMenu).toHaveBeenCalledWith(false);
        expect(mockPlayer.camera.attachControl).toHaveBeenCalled();
    });
});
