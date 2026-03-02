import { RpgContentBundle } from "./content-types";

export const frameworkBaseContent: RpgContentBundle = {
  dialogues: [
    {
      id: "guard_intro",
      startNodeId: "start",
      nodes: [
        {
          id: "start",
          speaker: "Guard",
          text: "Halt traveler. State your business.",
          choices: [
            {
              id: "friendly_greeting",
              text: "I'm here to help the village.",
              nextNodeId: "help_offer",
              effects: [{ type: "faction_delta", factionId: "village_guard", amount: 5 }],
            },
            {
              id: "threaten_guard",
              text: "Out of my way.",
              nextNodeId: "hostile_reply",
              effects: [{ type: "faction_delta", factionId: "village_guard", amount: -10 }],
            },
          ],
        },
        {
          id: "help_offer",
          speaker: "Guard",
          text: "Then help us clear the rogue sentry in the ruins.",
          choices: [
            {
              id: "accept_job",
              text: "I'll handle it.",
              endsDialogue: true,
              effects: [
                { type: "set_flag", flag: "accepted_ruin_job", value: true },
                { type: "emit_event", eventId: "quest:talk:Guard" },
              ],
            },
          ],
        },
        {
          id: "hostile_reply",
          speaker: "Guard",
          text: "Watch your tongue. You're close to being barred from the gate.",
          choices: [
            {
              id: "leave",
              text: "Fine. I'm leaving.",
              endsDialogue: true,
            },
          ],
        },
      ],
    },
  ],
  quests: [
    {
      id: "quest_guard_resolution",
      name: "Guard Resolution",
      description: "Speak with the guard and resolve the ruins threat.",
      xpReward: 100,
      startNodeIds: ["talk_to_guard"],
      nodes: [
        {
          id: "talk_to_guard",
          description: "Talk to the guard captain.",
          triggerType: "talk",
          targetId: "Guard",
          requiredCount: 1,
          nextNodeIds: ["defeat_ruin_guard"],
        },
        {
          id: "defeat_ruin_guard",
          description: "Defeat the rogue ruin guard.",
          triggerType: "kill",
          targetId: "RuinGuard",
          requiredCount: 1,
        },
      ],
    },
  ],
  items: [
    {
      id: "iron_sword",
      name: "Iron Sword",
      description: "Reliable steel for close quarters.",
      stackable: false,
      slot: "mainHand",
      tags: ["weapon", "melee"],
    },
    {
      id: "health_potion",
      name: "Health Potion",
      description: "Restores health.",
      stackable: true,
      maxStack: 25,
      tags: ["consumable"],
    },
  ],
  factions: [
    {
      id: "village_guard",
      name: "Village Guard",
      description: "Protectors of the frontier settlement.",
      defaultReputation: 0,
      hostileBelow: -25,
      friendlyAt: 25,
      alliedAt: 60,
    },
  ],
};
