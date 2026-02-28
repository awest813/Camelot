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

    it('should reject adding an item with non-positive quantity', () => {
        const item: Item = { id: '1', name: 'Broken Item', description: 'Desc', stackable: true, quantity: 0 };
        const result = inventorySystem.addItem(item);

        expect(result).toBe(false);
        expect(inventorySystem.items).toHaveLength(0);
        expect(mockUI.updateInventory).not.toHaveBeenCalled();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Invalid item quantity.', 2000);
    });

    it('should reject removing a non-positive amount', () => {
        const item: Item = { id: '1', name: 'Test Item', description: 'Desc', stackable: true, quantity: 2 };
        inventorySystem.addItem(item);

        const result = inventorySystem.removeItem('1', 0);

        expect(result).toBe(false);
        expect(inventorySystem.items[0].quantity).toBe(2);
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
});
