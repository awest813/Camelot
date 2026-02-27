import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentSystem } from './equipment-system';
import { Item } from './inventory-system';

describe('EquipmentSystem', () => {
    let equipmentSystem: EquipmentSystem;
    let mockPlayer: any;
    let mockInventory: any;
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

    const helm: Item = {
        id: 'helm_01',
        name: 'Iron Helm',
        description: 'A sturdy helm.',
        stackable: false,
        quantity: 1,
        slot: 'head',
        stats: { armor: 2 }
    };

    const potion: Item = {
        id: 'potion_01',
        name: 'Health Potion',
        description: 'Restores HP.',
        stackable: true,
        quantity: 1
    };

    beforeEach(() => {
        mockPlayer = { bonusDamage: 0, bonusArmor: 0, maxHealth: 100, maxMagicka: 100, maxStamina: 100 };
        mockInventory = {
            items: [{ ...sword }, { ...helm }],
            removeItem: vi.fn((id: string, amount: number) => {
                const idx = mockInventory.items.findIndex((i: Item) => i.id === id);
                if (idx !== -1) mockInventory.items.splice(idx, 1);
                return true;
            }),
            addItem: vi.fn((item: Item) => {
                mockInventory.items.push({ ...item });
                return true;
            }),
        };
        mockUI = {
            setEquippedIds: vi.fn(),
            updateInventory: vi.fn(),
            updateEquipment: vi.fn(),
            showNotification: vi.fn(),
        };
        equipmentSystem = new EquipmentSystem(mockPlayer, mockInventory, mockUI);
    });

    it('should equip an item and apply stats', () => {
        equipmentSystem.equip(sword);
        expect(mockPlayer.bonusDamage).toBe(10);
        expect(mockInventory.removeItem).toHaveBeenCalledWith('sword_01', 1);
    });

    it('should unequip an item and remove stats', () => {
        equipmentSystem.equip(sword);
        equipmentSystem.unequip('mainHand');
        expect(mockPlayer.bonusDamage).toBe(0);
    });

    it('should swap items in the same slot', () => {
        const sword2: Item = {
            id: 'sword_02',
            name: 'Steel Sword',
            description: 'A sharp steel sword.',
            stackable: false,
            quantity: 1,
            slot: 'mainHand',
            stats: { damage: 15 }
        };
        mockInventory.items.push({ ...sword2 });

        equipmentSystem.equip(sword);
        expect(mockPlayer.bonusDamage).toBe(10);

        // Add old sword back to inventory mock (equip removes it, unequip adds it back)
        mockInventory.items.push({ ...sword });
        equipmentSystem.equip(sword2);
        expect(mockPlayer.bonusDamage).toBe(15);
    });

    it('should report isEquipped correctly', () => {
        expect(equipmentSystem.isEquipped('sword_01')).toBe(false);
        equipmentSystem.equip(sword);
        expect(equipmentSystem.isEquipped('sword_01')).toBe(true);
        equipmentSystem.unequip('mainHand');
        expect(equipmentSystem.isEquipped('sword_01')).toBe(false);
    });

    it('should ignore items without a slot', () => {
        equipmentSystem.equip(potion as Item);
        expect(equipmentSystem.getEquipped().size).toBe(0);
        expect(mockPlayer.bonusDamage).toBe(0);
    });

    it('should apply armor bonus from armor items', () => {
        equipmentSystem.equip(helm);
        expect(mockPlayer.bonusArmor).toBe(2);
    });

    it('handleItemClick equips an unequipped item', () => {
        equipmentSystem.handleItemClick(sword);
        expect(equipmentSystem.isEquipped('sword_01')).toBe(true);
    });

    it('handleItemClick unequips an already-equipped item', () => {
        equipmentSystem.equip(sword);
        equipmentSystem.handleItemClick(sword);
        expect(equipmentSystem.isEquipped('sword_01')).toBe(false);
    });

    it('should update the UI on equip and unequip', () => {
        equipmentSystem.equip(sword);
        expect(mockUI.updateInventory).toHaveBeenCalled();
        expect(mockUI.updateEquipment).toHaveBeenCalled();
        expect(mockUI.showNotification).toHaveBeenCalledWith('Equipped Iron Sword');

        equipmentSystem.unequip('mainHand');
        expect(mockUI.showNotification).toHaveBeenCalledWith('Unequipped Iron Sword');
    });

    it('getEquippedIds returns ids of all equipped items', () => {
        equipmentSystem.equip(sword);
        equipmentSystem.equip(helm);
        const ids = equipmentSystem.getEquippedIds();
        expect(ids.has('sword_01')).toBe(true);
        expect(ids.has('helm_01')).toBe(true);
        expect(ids.size).toBe(2);
    });
});
