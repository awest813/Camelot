import { describe, it, expect, afterEach } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MapEditorSystem } from './map-editor-system';

const disposables: Array<{ scene: Scene; engine: NullEngine }> = [];

function makeEditor(): { editor: MapEditorSystem; scene: Scene; engine: NullEngine } {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const editor = new MapEditorSystem(scene);
    disposables.push({ scene, engine });
    return { editor, scene, engine };
}

afterEach(() => {
    for (const { scene, engine } of disposables.splice(0)) {
        scene.dispose();
        engine.dispose();
    }
});

// ─── Phase 1: Core editor mode ────────────────────────────────────────────────

describe('MapEditorSystem — Phase 1 (core)', () => {
    it('toggles edit mode on and off', () => {
        const { editor } = makeEditor();

        expect(editor.isEnabled).toBe(false);
        expect(editor.toggle()).toBe(true);
        expect(editor.isEnabled).toBe(true);
        expect(editor.toggle()).toBe(false);
        expect(editor.isEnabled).toBe(false);
    });

    it('cycles gizmo mode in the expected order', () => {
        const { editor } = makeEditor();

        expect(editor.mode).toBe('position');
        expect(editor.cycleGizmoMode()).toBe('rotation');
        expect(editor.cycleGizmoMode()).toBe('scale');
        expect(editor.cycleGizmoMode()).toBe('position');
    });

    it('places marker meshes snapped to current grid size', () => {
        const { editor } = makeEditor();
        editor.snapSize = 2;

        const marker = editor.placeMarkerAt(new Vector3(1.4, 1.1, -2.6));

        expect(marker.metadata?.editable).toBe(true);
        expect(marker.metadata?.editorType).toBe('marker');
        expect(marker.position.x).toBe(2);
        expect(marker.position.y).toBe(2);
        expect(marker.position.z).toBe(-2);
    });
});



// ─── Phase 1: Terrain tools ───────────────────────────────────────────────────

describe('MapEditorSystem — Phase 1 (terrain tools)', () => {
    it('cycles terrain tool none -> sculpt -> paint -> none', () => {
        const { editor } = makeEditor();

        expect(editor.terrainTool).toBe('none');
        expect(editor.cycleTerrainTool()).toBe('sculpt');
        expect(editor.cycleTerrainTool()).toBe('paint');
        expect(editor.cycleTerrainTool()).toBe('none');
    });

    it('clamps terrain sculpt step between 0.1 and 4', () => {
        const { editor } = makeEditor();

        expect(editor.adjustTerrainSculptStep(-10)).toBe(0.1);
        expect(editor.adjustTerrainSculptStep(10)).toBe(4);
    });

    it('sculpt tool raises chunk mesh Y position by terrainSculptStep', () => {
        const { editor, scene } = makeEditor();
        const chunk = new Mesh('chunk_0,0', scene);
        editor.terrainTool = 'sculpt';
        editor.terrainSculptStep = 0.75;

        editor.applyTerrainToolToMesh(chunk);

        expect(chunk.position.y).toBe(0.75);
    });
});

// ─── Phase 2: Placement types ─────────────────────────────────────────────────

describe('MapEditorSystem — Phase 2 (placement types)', () => {
    it('defaults to marker placement type', () => {
        const { editor } = makeEditor();
        expect(editor.currentPlacementType).toBe('marker');
    });

    it('cycles placement type through all values and wraps around', () => {
        const { editor } = makeEditor();

        const order: string[] = [];
        for (let i = 0; i < 6; i++) {
            order.push(editor.cyclePlacementType());
        }

        expect(order[0]).toBe('loot');
        expect(order[1]).toBe('npc-spawn');
        expect(order[2]).toBe('quest-marker');
        expect(order[3]).toBe('structure');
        expect(order[4]).toBe('marker');       // wrapped back
        expect(order[5]).toBe('loot');         // second cycle
    });

    it('placeEntity uses currentPlacementType by default', () => {
        const { editor } = makeEditor();
        editor.currentPlacementType = 'loot';

        const mesh = editor.placeEntity(new Vector3(0, 1, 0));

        expect(mesh.metadata?.editorType).toBe('loot');
        expect(mesh.metadata?.editable).toBe(true);
    });

    it('placeEntity accepts an explicit type override', () => {
        const { editor } = makeEditor();
        editor.currentPlacementType = 'marker';

        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'structure');

        expect(mesh.metadata?.editorType).toBe('structure');
    });

    it('snaps placed entities to the current snapSize', () => {
        const { editor } = makeEditor();
        editor.snapSize = 4;

        // 5.9/4 = 1.475 → rounds to 1 → 4; 1.1/4 = 0.275 → rounds to 0 → 0; -3.0/4 = -0.75 → rounds to -1 → -4
        const mesh = editor.placeEntity(new Vector3(5.9, 1.1, -3.0));

        expect(mesh.position.x).toBe(4);
        expect(mesh.position.y).toBe(0);
        expect(mesh.position.z).toBe(-4);
    });

    it('each placed entity receives a unique editorEntityId', () => {
        const { editor } = makeEditor();

        const m1 = editor.placeEntity(new Vector3(0, 1, 0), 'marker');
        const m2 = editor.placeEntity(new Vector3(1, 1, 0), 'loot');
        const m3 = editor.placeEntity(new Vector3(2, 1, 0), 'npc-spawn');

        const ids = [
            m1.metadata?.editorEntityId,
            m2.metadata?.editorEntityId,
            m3.metadata?.editorEntityId,
        ];
        expect(new Set(ids).size).toBe(3);
    });
});


describe('MapEditorSystem — Phase 2 (entity properties)', () => {
    it('stores and exposes per-entity properties', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'quest-marker');
        const entityId = mesh.metadata?.editorEntityId as string;

        const updated = editor.setEntityProperties(entityId, {
            objectiveId: 'quest.main.001',
            dialogueTriggerId: 'dialogue.intro_guard',
            label: 'Guard briefing marker',
        });

        expect(updated).toBe(true);
        expect(editor.getEntityProperties(entityId)).toMatchObject({
            objectiveId: 'quest.main.001',
            dialogueTriggerId: 'dialogue.intro_guard',
            label: 'Guard briefing marker',
        });
        expect(mesh.metadata?.editorProperties).toMatchObject({
            objectiveId: 'quest.main.001',
            dialogueTriggerId: 'dialogue.intro_guard',
            label: 'Guard briefing marker',
        });
    });

    it('returns false when setting properties on a missing entity id', () => {
        const { editor } = makeEditor();

        expect(editor.setEntityProperties('missing', { label: 'noop' })).toBe(false);
        expect(editor.getEntityProperties('missing')).toBeNull();
    });
});

// ─── Phase 2: Patrol route authoring ─────────────────────────────────────────

describe('MapEditorSystem — Phase 2 (patrol routes)', () => {
    it('startNewPatrolGroup returns a unique group id each call', () => {
        const { editor } = makeEditor();

        const id1 = editor.startNewPatrolGroup();
        const id2 = editor.startNewPatrolGroup();

        expect(id1).not.toBe(id2);
        expect(editor.getPatrolGroups().has(id1)).toBe(true);
        expect(editor.getPatrolGroups().has(id2)).toBe(true);
    });

    it('npc-spawn entities placed while a patrol group is active are assigned to that group', () => {
        const { editor } = makeEditor();
        const groupId = editor.startNewPatrolGroup();

        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'npc-spawn');

        expect(mesh.metadata?.patrolGroupId).toBe(groupId);
    });

    it('npc-spawn entities placed without an active patrol group have no patrolGroupId', () => {
        const { editor } = makeEditor();
        editor.clearActivePatrolGroup();

        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'npc-spawn');

        expect(mesh.metadata?.patrolGroupId).toBeUndefined();
    });

    it('waypoints accumulate in the patrol group as npc-spawn entities are placed', () => {
        const { editor } = makeEditor();
        const groupId = editor.startNewPatrolGroup();

        editor.placeEntity(new Vector3(0, 1, 0), 'npc-spawn');
        editor.placeEntity(new Vector3(10, 1, 0), 'npc-spawn');
        editor.placeEntity(new Vector3(10, 1, 10), 'npc-spawn');

        const group = editor.getPatrolGroups().get(groupId);
        expect(group?.waypoints.length).toBe(3);
    });

    it('non-npc-spawn entities do not add waypoints to the active patrol group', () => {
        const { editor } = makeEditor();
        const groupId = editor.startNewPatrolGroup();

        editor.placeEntity(new Vector3(0, 1, 0), 'loot');
        editor.placeEntity(new Vector3(0, 1, 5), 'quest-marker');

        const group = editor.getPatrolGroups().get(groupId);
        expect(group?.waypoints.length).toBe(0);
    });

    it('clearActivePatrolGroup stops new npc-spawn from joining the previous group', () => {
        const { editor } = makeEditor();
        const groupId = editor.startNewPatrolGroup();
        editor.placeEntity(new Vector3(0, 1, 0), 'npc-spawn');
        editor.clearActivePatrolGroup();

        editor.placeEntity(new Vector3(10, 1, 0), 'npc-spawn');

        const group = editor.getPatrolGroups().get(groupId);
        expect(group?.waypoints.length).toBe(1);
    });
});

// ─── Phase 2: Export / import ─────────────────────────────────────────────────

describe('MapEditorSystem — Phase 2 (export / import)', () => {
    it('exportMap returns version 1 with entries and patrolRoutes', () => {
        const { editor } = makeEditor();

        const data = editor.exportMap();

        expect(data.version).toBe(1);
        expect(Array.isArray(data.entries)).toBe(true);
        expect(Array.isArray(data.patrolRoutes)).toBe(true);
    });

    it('exportMap captures all placed entities with correct type and position', () => {
        const { editor } = makeEditor();

        editor.placeEntity(new Vector3(2, 1, 3), 'loot');
        editor.placeEntity(new Vector3(5, 1, 0), 'quest-marker');

        const data = editor.exportMap();

        expect(data.entries.length).toBe(2);
        const lootEntry = data.entries.find(e => e.type === 'loot');
        expect(lootEntry).toBeDefined();
        expect(lootEntry?.position.x).toBe(2);
        expect(lootEntry?.position.z).toBe(3);
    });

    it('exportMap captures patrol route waypoints', () => {
        const { editor } = makeEditor();
        const groupId = editor.startNewPatrolGroup();
        editor.placeEntity(new Vector3(0, 1, 0), 'npc-spawn');
        editor.placeEntity(new Vector3(8, 1, 0), 'npc-spawn');

        const data = editor.exportMap();

        const route = data.patrolRoutes.find(r => r.id === groupId);
        expect(route).toBeDefined();
        expect(route?.waypoints.length).toBe(2);
        expect(route?.waypoints[0]).toMatchObject({ x: 0, y: 1, z: 0 });
        expect(route?.waypoints[1]).toMatchObject({ x: 8, y: 1, z: 0 });
    });

    it('importMap re-creates entities from exported data', () => {
        const { editor: src, scene: srcScene, engine: srcEngine } = makeEditor();
        src.placeEntity(new Vector3(3, 1, 7), 'structure');
        const exported = src.exportMap();
        srcScene.dispose();
        srcEngine.dispose();
        disposables.pop(); // already disposed above

        const { editor: dst } = makeEditor();
        dst.importMap(exported);

        const dstData = dst.exportMap();
        expect(dstData.entries.length).toBe(1);
        expect(dstData.entries[0].type).toBe('structure');
        expect(dstData.entries[0].position).toMatchObject({ x: 3, y: 1, z: 7 });
    });

    it('importMap skips entities whose id already exists', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'marker');
        const firstExport = editor.exportMap();

        // Import the same data again — should not duplicate
        editor.importMap(firstExport);

        const data = editor.exportMap();
        expect(data.entries.length).toBe(1);
        expect(mesh.metadata?.editorEntityId).toBe(firstExport.entries[0].id);
    });



    it('exportMap and importMap preserve entity properties', () => {
        const { editor: src } = makeEditor();
        const mesh = src.placeEntity(new Vector3(1, 1, 2), 'quest-marker');
        const entityId = mesh.metadata?.editorEntityId as string;
        src.setEntityProperties(entityId, {
            objectiveId: 'quest.alpha.find-relic',
            dialogueTriggerId: 'dialogue.relic_hint',
            label: 'Relic hint marker',
        });

        const exported = src.exportMap();
        const { editor: dst } = makeEditor();
        dst.importMap(exported);

        const imported = dst.exportMap();
        expect(imported.entries[0].properties).toMatchObject({
            objectiveId: 'quest.alpha.find-relic',
            dialogueTriggerId: 'dialogue.relic_hint',
            label: 'Relic hint marker',
        });
    });
    it('importMap recreates patrol groups and does not duplicate them on a second import', () => {
        const { editor: src } = makeEditor();
        src.startNewPatrolGroup();
        src.placeEntity(new Vector3(0, 1, 0), 'npc-spawn');
        src.placeEntity(new Vector3(5, 1, 0), 'npc-spawn');
        const exported = src.exportMap();

        const { editor: dst } = makeEditor();
        dst.importMap(exported);
        dst.importMap(exported); // second import — no duplicates

        const groups = Array.from(dst.getPatrolGroups().values());
        expect(groups.length).toBe(1);
        expect(groups[0].waypoints.length).toBe(2);
    });
});

// ─── Phase 2: clearAll ────────────────────────────────────────────────────────

describe('MapEditorSystem — Phase 2 (clearAll)', () => {
    it('clearAll removes all entities and patrol groups', () => {
        const { editor } = makeEditor();
        editor.startNewPatrolGroup();
        editor.placeEntity(new Vector3(0, 1, 0), 'npc-spawn');
        editor.placeEntity(new Vector3(5, 1, 0), 'npc-spawn');
        editor.placeEntity(new Vector3(0, 1, 5), 'loot');

        editor.clearAll();

        const data = editor.exportMap();
        expect(data.entries.length).toBe(0);
        expect(data.patrolRoutes.length).toBe(0);
        expect(editor.activePatrolGroupId).toBeNull();
    });
});

// ─── Phase 3: validation tooling ─────────────────────────────────────────────

describe('MapEditorSystem — Phase 3 (validation)', () => {
    it('returns a valid report when no issues are found', () => {
        const { editor } = makeEditor();
        editor.placeEntity(new Vector3(0, 1, 0), 'marker');
        editor.placeEntity(new Vector3(5, 1, 0), 'loot');

        const report = editor.validateMap();

        expect(report.isValid).toBe(true);
        expect(report.issues.length).toBe(0);
    });

    it('detects npc-spawn entries that reference a missing patrol group', () => {
        const { editor } = makeEditor();
        const exported = editor.exportMap();
        exported.entries.push({
            id: 'editor_entity_external',
            type: 'npc-spawn',
            position: { x: 0, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            patrolGroupId: 'missing_group',
        });
        editor.importMap(exported);

        const report = editor.validateMap();

        expect(report.isValid).toBe(false);
        expect(report.issues.some(issue => issue.code === 'missing-patrol-group')).toBe(true);
    });

    it('detects patrol routes with too few waypoints', () => {
        const { editor } = makeEditor();
        editor.startNewPatrolGroup();

        const report = editor.validateMap();

        expect(report.isValid).toBe(false);
        expect(report.issues.some(issue => issue.code === 'patrol-route-too-short')).toBe(true);
    });

    it('detects overlapping entities', () => {
        const { editor } = makeEditor();
        editor.placeEntity(new Vector3(0, 1, 0), 'marker');
        editor.placeEntity(new Vector3(0.1, 1, 0), 'loot');

        const report = editor.validateMap(0.5);

        expect(report.isValid).toBe(false);
        expect(report.issues.some(issue => issue.code === 'entity-overlap')).toBe(true);
    });
});

// ─── Phase 2: removeEntity ────────────────────────────────────────────────────

describe('MapEditorSystem — Phase 2 (removeEntity)', () => {
    it('removes an entity by id and returns true', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'loot');
        const entityId = mesh.metadata?.editorEntityId as string;

        const removed = editor.removeEntity(entityId);

        expect(removed).toBe(true);
        const data = editor.exportMap();
        expect(data.entries.length).toBe(0);
    });

    it('returns false when entity id does not exist', () => {
        const { editor } = makeEditor();

        expect(editor.removeEntity('nonexistent')).toBe(false);
    });

    it('only removes the targeted entity, leaving others intact', () => {
        const { editor } = makeEditor();
        const m1 = editor.placeEntity(new Vector3(0, 1, 0), 'marker');
        editor.placeEntity(new Vector3(5, 1, 0), 'loot');
        const idToRemove = m1.metadata?.editorEntityId as string;

        editor.removeEntity(idToRemove);

        const data = editor.exportMap();
        expect(data.entries.length).toBe(1);
        expect(data.entries[0].type).toBe('loot');
    });

    it('clears selection when the selected entity is removed', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'marker');
        const entityId = mesh.metadata?.editorEntityId as string;

        expect(editor.selectedEntityId).toBe(entityId);

        editor.removeEntity(entityId);

        expect(editor.selectedEntityId).toBeNull();
    });
});

// ─── Phase 2: selection tracking ─────────────────────────────────────────────

describe('MapEditorSystem — Phase 2 (selection tracking)', () => {
    it('selectedEntityId is set when an entity is placed', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'marker');
        const entityId = mesh.metadata?.editorEntityId as string;

        expect(editor.selectedEntityId).toBe(entityId);
    });

    it('selectedEntityId is null initially', () => {
        const { editor } = makeEditor();

        expect(editor.selectedEntityId).toBeNull();
    });

    it('selectedEntityId is null after clearAll', () => {
        const { editor } = makeEditor();
        editor.placeEntity(new Vector3(0, 1, 0), 'marker');

        editor.clearAll();

        expect(editor.selectedEntityId).toBeNull();
    });

    it('selectedEntityId is null after toggle off', () => {
        const { editor } = makeEditor();
        editor.toggle();
        editor.placeEntity(new Vector3(0, 1, 0), 'marker');

        editor.toggle(); // off

        expect(editor.selectedEntityId).toBeNull();
    });

    it('onEntitySelectionChanged fires with entity id when entity is placed', () => {
        const { editor } = makeEditor();
        const calls: Array<string | null> = [];
        editor.onEntitySelectionChanged = (id) => calls.push(id);

        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'marker');
        const entityId = mesh.metadata?.editorEntityId as string;

        expect(calls).toContain(entityId);
    });

    it('onEntitySelectionChanged fires with null after clearAll', () => {
        const { editor } = makeEditor();
        const calls: Array<string | null> = [];
        editor.placeEntity(new Vector3(0, 1, 0), 'marker');

        editor.onEntitySelectionChanged = (id) => calls.push(id);
        editor.clearAll();

        expect(calls[calls.length - 1]).toBeNull();
    });

    it('onEntitySelectionChanged fires with null when editor is toggled off', () => {
        const { editor } = makeEditor();
        editor.toggle();
        editor.placeEntity(new Vector3(0, 1, 0), 'marker');
        const fired: Array<string | null> = [];
        editor.onEntitySelectionChanged = (id) => fired.push(id);

        editor.toggle();

        expect(fired).toContain(null);
    });
});

// ─── Phase 3: expanded validation ────────────────────────────────────────────

describe('MapEditorSystem — Phase 3 (expanded validation)', () => {
    it('detects orphaned quest markers with no objectiveId', () => {
        const { editor } = makeEditor();
        editor.placeEntity(new Vector3(0, 1, 0), 'quest-marker'); // no objectiveId

        const report = editor.validateMap();

        expect(report.isValid).toBe(false);
        expect(report.issues.some(i => i.code === 'orphaned-quest-marker')).toBe(true);
    });

    it('does not flag quest markers that have an objectiveId', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'quest-marker');
        const id = mesh.metadata?.editorEntityId as string;
        editor.setEntityProperties(id, { objectiveId: 'obj.main.001' });

        const report = editor.validateMap();

        expect(report.issues.filter(i => i.code === 'orphaned-quest-marker')).toHaveLength(0);
    });

    it('detects duplicate objectiveIds across multiple quest markers', () => {
        const { editor } = makeEditor();
        const m1 = editor.placeEntity(new Vector3(0, 1, 0), 'quest-marker');
        const m2 = editor.placeEntity(new Vector3(5, 1, 0), 'quest-marker');
        editor.setEntityProperties(m1.metadata?.editorEntityId as string, { objectiveId: 'obj.shared' });
        editor.setEntityProperties(m2.metadata?.editorEntityId as string, { objectiveId: 'obj.shared' });

        const report = editor.validateMap();

        expect(report.isValid).toBe(false);
        expect(report.issues.some(i => i.code === 'duplicate-objective-id')).toBe(true);
        const dupIssue = report.issues.find(i => i.code === 'duplicate-objective-id')!;
        expect(dupIssue.entityIds).toHaveLength(2);
    });

    it('does not flag quest markers with distinct objectiveIds as duplicates', () => {
        const { editor } = makeEditor();
        const m1 = editor.placeEntity(new Vector3(0, 1, 0), 'quest-marker');
        const m2 = editor.placeEntity(new Vector3(5, 1, 0), 'quest-marker');
        editor.setEntityProperties(m1.metadata?.editorEntityId as string, { objectiveId: 'obj.alpha' });
        editor.setEntityProperties(m2.metadata?.editorEntityId as string, { objectiveId: 'obj.beta' });

        const report = editor.validateMap();

        expect(report.issues.some(i => i.code === 'duplicate-objective-id')).toBe(false);
    });

    it('detects missing loot table reference when context is provided', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'loot');
        editor.setEntityProperties(mesh.metadata?.editorEntityId as string, { lootTableId: 'unknown_table' });

        const report = editor.validateMap(0.5, { knownLootTableIds: ['common', 'dungeon'] });

        expect(report.isValid).toBe(false);
        expect(report.issues.some(i => i.code === 'missing-loot-table')).toBe(true);
    });

    it('does not flag a loot entity whose lootTableId is in the context', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'loot');
        editor.setEntityProperties(mesh.metadata?.editorEntityId as string, { lootTableId: 'common' });

        const report = editor.validateMap(0.5, { knownLootTableIds: ['common', 'dungeon'] });

        expect(report.issues.some(i => i.code === 'missing-loot-table')).toBe(false);
    });

    it('detects missing spawn template reference when context is provided', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'npc-spawn');
        editor.setEntityProperties(mesh.metadata?.editorEntityId as string, { spawnTemplateId: 'ghost_archetype' });

        const report = editor.validateMap(0.5, { knownSpawnTemplateIds: ['guard', 'bandit', 'merchant'] });

        expect(report.isValid).toBe(false);
        expect(report.issues.some(i => i.code === 'missing-spawn-template')).toBe(true);
    });

    it('does not flag npc-spawn when spawnTemplateId is in the context', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'npc-spawn');
        editor.setEntityProperties(mesh.metadata?.editorEntityId as string, { spawnTemplateId: 'guard' });

        const report = editor.validateMap(0.5, { knownSpawnTemplateIds: ['guard', 'bandit'] });

        expect(report.issues.some(i => i.code === 'missing-spawn-template')).toBe(false);
    });

    it('skips cross-system checks when no context is provided', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'loot');
        editor.setEntityProperties(mesh.metadata?.editorEntityId as string, { lootTableId: 'nonexistent' });

        // Without context no missing-loot-table or missing-spawn-template issues
        const report = editor.validateMap();

        expect(report.issues.some(i => i.code === 'missing-loot-table')).toBe(false);
        expect(report.issues.some(i => i.code === 'missing-spawn-template')).toBe(false);
    });

    it('detects unknown objectiveId cross-reference when context is provided', () => {
        const { editor } = makeEditor();
        const mesh = editor.placeEntity(new Vector3(0, 1, 0), 'quest-marker');
        editor.setEntityProperties(mesh.metadata?.editorEntityId as string, { objectiveId: 'obj.unknown' });

        const report = editor.validateMap(0.5, { knownObjectiveIds: ['obj.main.001', 'obj.main.002'] });

        expect(report.isValid).toBe(false);
        expect(report.issues.some(i => i.code === 'unknown-objective-id')).toBe(true);
    });
});

// ─── Phase 3: importFromJson ──────────────────────────────────────────────────

describe('MapEditorSystem — Phase 3 (importFromJson)', () => {
    it('returns true and imports valid JSON map data', () => {
        const { editor: src } = makeEditor();
        src.placeEntity(new Vector3(2, 1, 5), 'structure');
        const json = JSON.stringify(src.exportMap());

        const { editor: dst } = makeEditor();
        const ok = dst.importFromJson(json);

        expect(ok).toBe(true);
        const data = dst.exportMap();
        expect(data.entries.length).toBe(1);
        expect(data.entries[0].type).toBe('structure');
    });

    it('returns false for invalid JSON', () => {
        const { editor } = makeEditor();

        expect(editor.importFromJson('not-json')).toBe(false);
    });

    it('returns false for valid JSON that is not a map export', () => {
        const { editor } = makeEditor();

        expect(editor.importFromJson('{"foo":"bar"}')).toBe(false);
    });

    it('returns false for a map with wrong version', () => {
        const { editor } = makeEditor();

        expect(editor.importFromJson('{"version":2,"entries":[],"patrolRoutes":[]}')).toBe(false);
    });
});
