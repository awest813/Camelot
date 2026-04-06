import type { MapValidationReport } from "../systems/map-editor-system";

const BASE_CONTROLS: readonly string[] = [
  "WASD: Move · Mouse: Look",
  "Left Click: Attack · Right Click (hold): Block · E: Power Attack",
  "I: Inventory · J: Quest Log · K: Skills · U: Attributes",
  "Q: Cast Spell · Z: Cycle Spells · X: Spellmaking · L: Alchemy · B: Enchanting · T: Wait",
  "V: Racial Power · H: Fame / Status · Y: Fast Travel Menu",
  "O: Mount / Dismount · Shift+O: Stable (buy horse) or Saddlebag (if mounted)",
  "7/8/9/0: Quick Slots · F5/F9: Save/Load · F3: Debug Overlay",
  "PrintScreen: Screenshot",
];

const EDITOR_CONTROLS: readonly string[] = [
  "F2: Toggle Map Editor",
  "N: Place Entity · T: Cycle Placement Type · D: Duplicate Selected",
  "G: Cycle Gizmo (Position/Rotation/Scale)",
  "P: New Patrol Group",
  "H: Cycle Terrain Tool · [ / ]: Sculpt Step",
  "F: Frame Selected · Shift+F: Frame All",
  "L: Toggle Layers Panel · Ctrl+M: Scene Notes",
  "Ctrl+Z: Undo · Ctrl+Y: Redo",
  "F4: Export Map · F6: Import Map · F7: Toggle Validation Panel",
  "F8: Validate Framework Quest Graphs",
  "F10: Open Quest Creator",
  "Shift+F10: Open NPC Creator",
  "F12: Open Dialogue Creator",
  "Shift+F12: Open Item Creator",
  "Shift+F9: Open Faction Creator",
  "Shift+F8: Open Loot Table Creator",
  "Shift+F11: Open Loot + Spawn Creator",
  "Shift+F7: Open Content Bundle Dashboard",
  "Shift+F6: Open Asset Browser",
  "Shift+F5: Open Bundle Merge Assistant",
  "Ctrl+Shift+M: Open Mod Manifest Editor",
  "Esc: Exit Editor",
];

export const buildHelpOverlayLines = (isEditorEnabled: boolean): string[] => {
  if (!isEditorEnabled) {
    return ["Gameplay Controls", ...BASE_CONTROLS, "", "F1: Toggle this help overlay"];
  }

  return [
    "Editor Controls",
    ...EDITOR_CONTROLS,
    "",
    "Gameplay controls still work outside editor-only bindings.",
    "F1: Toggle this help overlay",
  ];
};

export const summarizeValidationReport = (report: MapValidationReport): string => {
  if (report.isValid) return "Map validation passed: no issues found.";

  const topCodes = new Map<string, number>();
  for (const issue of report.issues) {
    topCodes.set(issue.code, (topCodes.get(issue.code) ?? 0) + 1);
  }

  const summary = Array.from(topCodes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code, count]) => `${code} (${count})`)
    .join(", ");

  return `Map validation found ${report.issues.length} issue(s): ${summary}.`;
};
