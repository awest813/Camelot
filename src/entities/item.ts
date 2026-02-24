export enum ItemType {
  WEAPON,
  ARMOR,
  POTION,
  MISC
}

export class Item {
  public id: string;
  public name: string;
  public type: ItemType;
  public weight: number;
  public value: number;
  public icon: string; // Placeholder for icon path

  constructor(id: string, name: string, type: ItemType, weight: number, value: number) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.weight = weight;
    this.value = value;
  }
}
