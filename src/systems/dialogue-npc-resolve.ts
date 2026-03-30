import type { NpcArchetypeDefinition } from "../framework/content/content-types";

/**
 * Pick a framework dialogue id for an in-world NPC from mesh name and registered archetypes.
 *
 * Matches when the mesh name equals an archetype display name, or starts with that name plus "_"
 * (spawn suffix), preferring the longest matching prefix. Falls back to `guard_intro` when the
 * mesh name clearly denotes a guard (e.g. "Guard", "RuinGuard_0_1") so structure-spawned NPCs
 * keep working without per-spawn metadata.
 */
export function resolveDialogueIdForNpcMeshName(
  meshName: string,
  archetypes: Iterable<NpcArchetypeDefinition>,
): string | null {
  const bindings: { prefix: string; dialogueId: string }[] = [];
  for (const a of archetypes) {
    const id = a.dialogueId?.trim();
    if (id) bindings.push({ prefix: a.name, dialogueId: id });
  }
  bindings.sort((x, y) => y.prefix.length - x.prefix.length);

  for (const b of bindings) {
    if (meshName === b.prefix || meshName.startsWith(`${b.prefix}_`)) {
      return b.dialogueId;
    }
  }

  if (/guard/i.test(meshName)) return "guard_intro";

  return null;
}
