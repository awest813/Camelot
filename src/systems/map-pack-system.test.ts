import { describe, it, expect } from 'vitest';
import { MapPackSystem } from './map-pack-system';
import type { MapExportData } from './map-editor-system';

// ── Helper ────────────────────────────────────────────────────────────────────

function emptyMap(overrides: Partial<MapExportData> = {}): MapExportData {
    return { version: 1, entries: [], patrolRoutes: [], ...overrides };
}

// ─── Construction ─────────────────────────────────────────────────────────────

describe('MapPackSystem — construction', () => {
    it('starts with zero maps', () => {
        const pack = new MapPackSystem();
        expect(pack.mapCount).toBe(0);
    });

    it('starts with empty metadata', () => {
        const pack = new MapPackSystem();
        expect(pack.title).toBe('');
        expect(pack.author).toBe('');
        expect(pack.description).toBe('');
    });

    it('callbacks are null by default', () => {
        const pack = new MapPackSystem();
        expect(pack.onMapAdded).toBeNull();
        expect(pack.onMapRemoved).toBeNull();
    });
});

// ─── addMap ───────────────────────────────────────────────────────────────────

describe('MapPackSystem — addMap', () => {
    it('returns true and increments mapCount', () => {
        const pack = new MapPackSystem();
        expect(pack.addMap('dungeon', 'Dungeon Level 1', emptyMap())).toBe(true);
        expect(pack.mapCount).toBe(1);
    });

    it('returns false for an empty id', () => {
        const pack = new MapPackSystem();
        expect(pack.addMap('', 'label', emptyMap())).toBe(false);
    });

    it('returns false when id already exists', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        expect(pack.addMap('dungeon', 'Dungeon 2', emptyMap())).toBe(false);
    });

    it('trims whitespace from id', () => {
        const pack = new MapPackSystem();
        pack.addMap('  dungeon  ', 'label', emptyMap());
        expect(pack.getMap('dungeon')).not.toBeNull();
        expect(pack.getMap('  dungeon  ')).toBeNull();
    });

    it('uses id as label when label is empty', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', '', emptyMap());
        expect(pack.getMap('dungeon')!.label).toBe('dungeon');
    });

    it('fires onMapAdded callback', () => {
        const pack = new MapPackSystem();
        const added: string[] = [];
        pack.onMapAdded = (e) => added.push(e.id);
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        expect(added).toContain('dungeon');
    });

    it('does not fire onMapAdded when add fails', () => {
        const pack = new MapPackSystem();
        const added: string[] = [];
        pack.onMapAdded = (e) => added.push(e.id);
        pack.addMap('', 'label', emptyMap());
        expect(added).toHaveLength(0);
    });
});

// ─── removeMap ────────────────────────────────────────────────────────────────

describe('MapPackSystem — removeMap', () => {
    it('returns true and decrements mapCount', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        expect(pack.removeMap('dungeon')).toBe(true);
        expect(pack.mapCount).toBe(0);
    });

    it('returns false when id does not exist', () => {
        const pack = new MapPackSystem();
        expect(pack.removeMap('nonexistent')).toBe(false);
    });

    it('fires onMapRemoved callback', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        const removed: string[] = [];
        pack.onMapRemoved = (id) => removed.push(id);
        pack.removeMap('dungeon');
        expect(removed).toContain('dungeon');
    });

    it('does not fire onMapRemoved when remove fails', () => {
        const pack = new MapPackSystem();
        const removed: string[] = [];
        pack.onMapRemoved = (id) => removed.push(id);
        pack.removeMap('nonexistent');
        expect(removed).toHaveLength(0);
    });

    it('getMap returns null after removal', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        pack.removeMap('dungeon');
        expect(pack.getMap('dungeon')).toBeNull();
    });
});

// ─── getMap / getAllMaps / getMapIds ──────────────────────────────────────────

describe('MapPackSystem — queries', () => {
    it('getMap returns null for unknown id', () => {
        const pack = new MapPackSystem();
        expect(pack.getMap('unknown')).toBeNull();
    });

    it('getMap returns a copy of the entry', () => {
        const pack = new MapPackSystem();
        const data = emptyMap({ notes: 'hello' });
        pack.addMap('dungeon', 'Dungeon', data);
        const entry = pack.getMap('dungeon')!;
        expect(entry.id).toBe('dungeon');
        expect(entry.label).toBe('Dungeon');
        expect(entry.data.notes).toBe('hello');
    });

    it('getAllMaps returns empty array initially', () => {
        const pack = new MapPackSystem();
        expect(pack.getAllMaps()).toHaveLength(0);
    });

    it('getAllMaps returns all registered maps', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        pack.addMap('overworld', 'Overworld', emptyMap());
        const ids = pack.getAllMaps().map((e) => e.id);
        expect(ids).toContain('dungeon');
        expect(ids).toContain('overworld');
    });

    it('getMapIds returns all ids in insertion order', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'D', emptyMap());
        pack.addMap('overworld', 'O', emptyMap());
        expect(pack.getMapIds()).toEqual(['dungeon', 'overworld']);
    });
});

// ─── updateMapData / updateMapLabel ──────────────────────────────────────────

describe('MapPackSystem — update methods', () => {
    it('updateMapData returns false for unknown id', () => {
        const pack = new MapPackSystem();
        expect(pack.updateMapData('nonexistent', emptyMap())).toBe(false);
    });

    it('updateMapData replaces the data for a known id', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        const updated = emptyMap({ notes: 'updated' });
        expect(pack.updateMapData('dungeon', updated)).toBe(true);
        expect(pack.getMap('dungeon')!.data.notes).toBe('updated');
    });

    it('updateMapLabel returns false for unknown id', () => {
        const pack = new MapPackSystem();
        expect(pack.updateMapLabel('nonexistent', 'New Label')).toBe(false);
    });

    it('updateMapLabel updates the label', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Old Label', emptyMap());
        expect(pack.updateMapLabel('dungeon', 'New Label')).toBe(true);
        expect(pack.getMap('dungeon')!.label).toBe('New Label');
    });

    it('updateMapLabel uses id when label is empty', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Old Label', emptyMap());
        pack.updateMapLabel('dungeon', '');
        expect(pack.getMap('dungeon')!.label).toBe('dungeon');
    });
});

// ─── validateMap / validateAll / isAllValid ───────────────────────────────────

describe('MapPackSystem — validateMap', () => {
    it('returns null for unknown id', () => {
        const pack = new MapPackSystem();
        expect(pack.validateMap('nonexistent')).toBeNull();
    });

    it('returns a valid report for an empty map', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        const report = pack.validateMap('dungeon')!;
        expect(report.isValid).toBe(true);
        expect(report.issues).toHaveLength(0);
    });

    it('returns an invalid report for a map with orphaned quest marker', () => {
        const pack = new MapPackSystem();
        const data: MapExportData = {
            version: 1,
            entries: [{ id: 'qm1', type: 'quest-marker', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }],
            patrolRoutes: [],
        };
        pack.addMap('bad', 'Bad Map', data);
        const report = pack.validateMap('bad')!;
        expect(report.isValid).toBe(false);
        expect(report.issues.some((i) => i.code === 'orphaned-quest-marker')).toBe(true);
    });

    it('passes MapValidationContext through to the report', () => {
        const pack = new MapPackSystem();
        const data: MapExportData = {
            version: 1,
            entries: [{ id: 'lt1', type: 'loot', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, properties: { lootTableId: 'unknown' } }],
            patrolRoutes: [],
        };
        pack.addMap('dungeon', 'Dungeon', data);
        const report = pack.validateMap('dungeon', 0.5, { knownLootTableIds: new Set(['valid_table']) })!;
        expect(report.isValid).toBe(false);
        expect(report.issues.some((i) => i.code === 'missing-loot-table')).toBe(true);
    });
});

describe('MapPackSystem — validateAll', () => {
    it('returns an empty map for an empty pack', () => {
        const pack = new MapPackSystem();
        const reports = pack.validateAll();
        expect(reports.size).toBe(0);
    });

    it('returns a report for each map', () => {
        const pack = new MapPackSystem();
        pack.addMap('a', 'A', emptyMap());
        pack.addMap('b', 'B', emptyMap());
        const reports = pack.validateAll();
        expect(reports.has('a')).toBe(true);
        expect(reports.has('b')).toBe(true);
    });

    it('reports per-map issues independently', () => {
        const pack = new MapPackSystem();
        pack.addMap('good', 'Good', emptyMap());
        const badData: MapExportData = {
            version: 1,
            entries: [{ id: 'qm1', type: 'quest-marker', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }],
            patrolRoutes: [],
        };
        pack.addMap('bad', 'Bad', badData);
        const reports = pack.validateAll();
        expect(reports.get('good')!.isValid).toBe(true);
        expect(reports.get('bad')!.isValid).toBe(false);
    });
});

describe('MapPackSystem — isAllValid', () => {
    it('returns true for an empty pack', () => {
        const pack = new MapPackSystem();
        expect(pack.isAllValid()).toBe(true);
    });

    it('returns true when all maps are valid', () => {
        const pack = new MapPackSystem();
        pack.addMap('a', 'A', emptyMap());
        pack.addMap('b', 'B', emptyMap());
        expect(pack.isAllValid()).toBe(true);
    });

    it('returns false when any map is invalid', () => {
        const pack = new MapPackSystem();
        pack.addMap('a', 'A', emptyMap());
        const bad: MapExportData = {
            version: 1,
            entries: [{ id: 'qm1', type: 'quest-marker', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }],
            patrolRoutes: [],
        };
        pack.addMap('b', 'B', bad);
        expect(pack.isAllValid()).toBe(false);
    });
});

// ─── buildPack / exportToJson ─────────────────────────────────────────────────

describe('MapPackSystem — buildPack', () => {
    it('returns version 1 with maps array', () => {
        const pack = new MapPackSystem();
        const built = pack.buildPack();
        expect(built.version).toBe(1);
        expect(Array.isArray(built.maps)).toBe(true);
    });

    it('includes all registered maps', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        pack.addMap('overworld', 'Overworld', emptyMap());
        const built = pack.buildPack();
        const ids = built.maps.map((m) => m.id);
        expect(ids).toContain('dungeon');
        expect(ids).toContain('overworld');
    });

    it('omits title/author/description when empty', () => {
        const pack = new MapPackSystem();
        const built = pack.buildPack();
        expect(built.title).toBeUndefined();
        expect(built.author).toBeUndefined();
        expect(built.description).toBeUndefined();
    });

    it('includes title/author/description when set', () => {
        const pack = new MapPackSystem();
        pack.title = 'Epic Campaign';
        pack.author = 'Dev Team';
        pack.description = 'A great adventure.';
        const built = pack.buildPack();
        expect(built.title).toBe('Epic Campaign');
        expect(built.author).toBe('Dev Team');
        expect(built.description).toBe('A great adventure.');
    });
});

describe('MapPackSystem — exportToJson', () => {
    it('returns valid JSON', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        const json = pack.exportToJson();
        expect(() => JSON.parse(json)).not.toThrow();
    });

    it('exported JSON contains expected structure', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        const parsed = JSON.parse(pack.exportToJson());
        expect(parsed.version).toBe(1);
        expect(parsed.maps[0].id).toBe('dungeon');
    });
});

// ─── importFromJson ───────────────────────────────────────────────────────────

describe('MapPackSystem — importFromJson', () => {
    it('returns true and imports maps from valid JSON', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        const json = pack.exportToJson();

        const pack2 = new MapPackSystem();
        expect(pack2.importFromJson(json)).toBe(true);
        expect(pack2.mapCount).toBe(1);
        expect(pack2.getMap('dungeon')).not.toBeNull();
    });

    it('returns false for invalid JSON string', () => {
        const pack = new MapPackSystem();
        expect(pack.importFromJson('not json')).toBe(false);
    });

    it('returns false for valid JSON with wrong structure', () => {
        const pack = new MapPackSystem();
        expect(pack.importFromJson(JSON.stringify({ version: 2, maps: [] }))).toBe(false);
    });

    it('returns false when maps array is missing', () => {
        const pack = new MapPackSystem();
        expect(pack.importFromJson(JSON.stringify({ version: 1 }))).toBe(false);
    });

    it('skips maps whose ids already exist', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap({ notes: 'original' }));
        const json = JSON.stringify({
            version: 1,
            maps: [{ id: 'dungeon', label: 'New Dungeon', data: emptyMap({ notes: 'new' }) }],
        });
        pack.importFromJson(json);
        expect(pack.getMap('dungeon')!.data.notes).toBe('original');
    });

    it('imports pack metadata when present', () => {
        const pack = new MapPackSystem();
        const json = JSON.stringify({ version: 1, title: 'Epic', author: 'Author', description: 'Desc', maps: [] });
        pack.importFromJson(json);
        expect(pack.title).toBe('Epic');
        expect(pack.author).toBe('Author');
        expect(pack.description).toBe('Desc');
    });

    it('fires onMapAdded for each imported map', () => {
        const pack = new MapPackSystem();
        const added: string[] = [];
        pack.onMapAdded = (e) => added.push(e.id);
        const json = JSON.stringify({
            version: 1,
            maps: [
                { id: 'a', label: 'A', data: emptyMap() },
                { id: 'b', label: 'B', data: emptyMap() },
            ],
        });
        pack.importFromJson(json);
        expect(added).toContain('a');
        expect(added).toContain('b');
    });

    it('full round-trip: export then import recovers all maps', () => {
        const pack = new MapPackSystem();
        pack.title = 'Campaign';
        pack.author = 'Studio';
        pack.addMap('dungeon', 'Dungeon', emptyMap({ notes: 'basement' }));
        pack.addMap('overworld', 'Overworld', emptyMap());

        const json = pack.exportToJson();

        const pack2 = new MapPackSystem();
        pack2.importFromJson(json);

        expect(pack2.mapCount).toBe(2);
        expect(pack2.title).toBe('Campaign');
        expect(pack2.author).toBe('Studio');
        expect(pack2.getMap('dungeon')!.data.notes).toBe('basement');
        expect(pack2.getMap('overworld')).not.toBeNull();
    });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('MapPackSystem — reset', () => {
    it('clears all maps', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        pack.reset();
        expect(pack.mapCount).toBe(0);
    });

    it('resets metadata', () => {
        const pack = new MapPackSystem();
        pack.title = 'Campaign';
        pack.author = 'Studio';
        pack.description = 'Desc';
        pack.reset();
        expect(pack.title).toBe('');
        expect(pack.author).toBe('');
        expect(pack.description).toBe('');
    });

    it('does not fire onMapRemoved', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        const removed: string[] = [];
        pack.onMapRemoved = (id) => removed.push(id);
        pack.reset();
        expect(removed).toHaveLength(0);
    });

    it('getMapIds returns empty array after reset', () => {
        const pack = new MapPackSystem();
        pack.addMap('dungeon', 'Dungeon', emptyMap());
        pack.reset();
        expect(pack.getMapIds()).toHaveLength(0);
    });
});
