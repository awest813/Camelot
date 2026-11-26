/**
 * Radiant quests: quest templates the game instantiates at runtime (a job
 * from an inn's board, a bounty), each instance a real quest in the engine
 * with its own id, so it counts progress, shows in the log, saves and pays
 * out like any other quest.
 *
 * A template is either:
 *  - "kill": kill `required` of `targetId`, then report back (the game
 *    sends the custom event `report:<questId>` when the player does);
 *  - "deliver": bring `required` of item `targetId` (the game takes the
 *    items and sends `deliver:<questId>` with that amount);
 *  - "defend": beat `required` attackers the game tracks itself (a raid's
 *    raiders); it sends `defend:<questId>` for each one down;
 *  - "clear": clear a landmark (`targetId` names its event with a var, e.g.
 *    `cleared:{landmark}`; the game sends it when the place is cleared),
 *    then report back as for "kill".
 *
 * The var `required`, when set, overrides the template's count (a raid's
 * size depends on the player's level); with `perCount`, the rewards are per
 * count.
 *
 * Text fields take `{name}` placeholders, filled from the instance's vars
 * (e.g. `{place}`: the board's village).  The engine keeps each instance's
 * template and vars in its snapshot and rebuilds the quest on restore.
 */
import type { QuestDefinition } from "./quest-types";

export type RadiantKind = "kill" | "deliver" | "defend" | "clear";

export interface RadiantTemplate {
  id: string;
  kind: RadiantKind;
  /** Quest name, e.g. "Bandit Trouble ({place})". */
  name: string;
  description: string;
  /** What the first objective says, e.g. "Kill 3 bandits". */
  objective: string;
  /** Kill quests: the report-back step, e.g. "Return to {place} for your pay". */
  report?: string;
  /** Kill: the NPC target id; deliver: the item id; clear: the custom event (vars filled); defend: unused (""). */
  targetId: string;
  required: number;
  rewardGold?: number;
  xpReward?: number;
  /** Fame when it is done (the engine's default otherwise). */
  fameReward?: number;
  /** Gold and XP are per count (`required`), not for the whole quest. */
  perCount?: boolean;
}

export interface RadiantInstance {
  templateId: string;
  vars: Record<string, string>;
}

/** The custom event that completes a kill quest's report-back step. */
export const reportEvent = (questId: string): string => `report:${questId}`;
/** The custom event that completes a deliver quest. */
export const deliverEvent = (questId: string): string => `deliver:${questId}`;
/** The custom event a defend quest counts (one per attacker down). */
export const defendEvent = (questId: string): string => `defend:${questId}`;
/** The custom event a landmark's clearing sends (a "clear" quest waits for it). */
export const clearedEvent = (landmarkId: string): string => `cleared:${landmarkId}`;

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => vars[key] ?? all);
}

/** The quest an instance of `template` is. */
export function radiantDefinition(template: RadiantTemplate, questId: string, vars: Record<string, string>): QuestDefinition {
  const required = Math.max(1, Math.floor(Number(vars.required) || template.required));
  const scale = template.perCount ? required : 1;
  vars = { ...vars, required: String(required) };
  const base = {
    id: questId,
    name: fill(template.name, vars),
    description: fill(template.description, vars),
    xpReward: (template.xpReward ?? 0) * scale,
    rewardGold: (template.rewardGold ?? 0) * scale,
    fameReward: template.fameReward,
  };
  if (template.kind === "kill" || template.kind === "clear") {
    const hunt = template.kind === "kill"
      ? { triggerType: "kill" as const, targetId: template.targetId, requiredCount: required }
      : { triggerType: "custom" as const, targetId: fill(template.targetId, vars), requiredCount: 1 };
    return {
      ...base,
      nodes: [
        { id: "hunt", description: fill(template.objective, vars), ...hunt, nextNodeIds: ["report"] },
        { id: "report", description: fill(template.report ?? "Report back for your reward", vars), triggerType: "custom", targetId: reportEvent(questId), requiredCount: 1, prerequisites: ["hunt"] },
      ],
      startNodeIds: ["hunt"],
      completionNodeIds: ["report"],
    };
  }
  if (template.kind === "defend") {
    return {
      ...base,
      nodes: [{ id: "defend", description: fill(template.objective, vars), triggerType: "custom", targetId: defendEvent(questId), requiredCount: required }],
      startNodeIds: ["defend"],
      completionNodeIds: ["defend"],
    };
  }
  return {
    ...base,
    nodes: [
      // Counted in items: the game sends the event with `required` as the amount when it takes them.
      { id: "deliver", description: fill(template.objective, vars), triggerType: "custom", targetId: deliverEvent(questId), requiredCount: required },
    ],
    startNodeIds: ["deliver"],
    completionNodeIds: ["deliver"],
  };
}
