/** A key's readable form: no trailing `_12` / `_3_-4` ids, underscores and joined words spaced. */
export function readableName(key: string): string {
  const name = key.replace(/(_-?\d+)+$/, "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return name || key;
}

/** An id as a title for the player: `village_guard` → "Village Guard". */
export function titleFromId(id: string): string {
  return readableName(id).replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
