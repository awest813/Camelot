export type EquipSlot = "mainHand" | "offHand" | "head" | "chest" | "legs" | "feet";

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  stackable: boolean;
  maxStack?: number;
  slot?: EquipSlot;
  tags?: string[];
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export interface InventorySnapshot {
  capacity: number;
  items: InventoryEntry[];
  equipped: Partial<Record<EquipSlot, string>>;
}

export type InventoryFailureReason =
  | "UNKNOWN_ITEM"
  | "INVALID_QUANTITY"
  | "CAPACITY_EXCEEDED"
  | "STACK_LIMIT_EXCEEDED"
  | "INSUFFICIENT_ITEMS"
  | "NOT_EQUIPPABLE"
  | "SLOT_MISMATCH"
  | "SLOT_OCCUPIED";

export interface InventoryOperationResult {
  success: boolean;
  reason?: InventoryFailureReason;
  message: string;
  snapshot: InventorySnapshot;
}
