import { DialogueDefinition } from "../dialogue/dialogue-types";
import { FactionDefinition } from "../factions/faction-types";
import { ItemDefinition } from "../inventory/inventory-types";
import { QuestDefinition } from "../quests/quest-types";

export interface RpgContentBundle {
  dialogues: DialogueDefinition[];
  quests: QuestDefinition[];
  items: ItemDefinition[];
  factions: FactionDefinition[];
}

export interface ContentCollision {
  domain: keyof RpgContentBundle;
  id: string;
  replacedSource: string;
  incomingSource: string;
}
