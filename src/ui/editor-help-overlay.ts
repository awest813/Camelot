import type { MapValidationReport } from "../systems/map-editor-system";

const BASE_CONTROLS: readonly string[] = [
  "WASD: Move · Mouse: Look",
  "Left/Right Click: Attack / Magic",
  "I: Inventory · J: Quest Log · K: Skills · U: Attributes",
  "L: Alchemy · B: Enchanting · T: Wait",
  "F5/F9: Save/Load · F3: Debug Overlay",
];

const EDITOR_CONTROLS: readonly string[] = [
  "F2: Toggle Map Editor",
  "N: Place Entity · T: Cycle Placement Type",
  "G: Cycle Gizmo (Position/Rotation/Scale)",
  "P: New Patrol Group",
  "H: Cycle Terrain Tool · [ / ]: Sculpt Step",
  "F4: Export Map · F6: Import Map · F7: Validate Map",
  "F8: Validate Framework Quest Graphs",
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
