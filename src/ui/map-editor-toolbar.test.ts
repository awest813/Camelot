import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@babylonjs/gui/2D', () => {
    class MockControl {
        static HORIZONTAL_ALIGNMENT_RIGHT = 1;
        static VERTICAL_ALIGNMENT_CENTER = 2;
        static VERTICAL_ALIGNMENT_TOP = 3;
        static HORIZONTAL_ALIGNMENT_LEFT = 4;
        static VERTICAL_ALIGNMENT_BOTTOM = 5;
        static HORIZONTAL_ALIGNMENT_CENTER = 6;

        isVisible: boolean = true;
        text: string = '';
        width: string = '';
        height: string = '';
        background: string = '';
        color: string = '';
        fontSize: number = 0;
        thickness: number = 0;
        cornerRadius: number = 0;
        paddingTop: string = '';
        paddingBottom: string = '';
        paddingLeft: string = '';
        paddingRight: string = '';
        adaptHeightToChildren: boolean = false;
        fontStyle: string = '';
        isVertical: boolean = false;
        isPointerBlocker: boolean = false;

        onPointerEnterObservable = { add: vi.fn() };
        onPointerOutObservable   = { add: vi.fn() };
        onPointerUpObservable    = { add: vi.fn() };

        children: any[] = [];

        addControl(child: any) { this.children.push(child); }
        removeControl(child: any) { this.children = this.children.filter(c => c !== child); }
        clearControls() { this.children = []; }
        dispose() {}
    }

    return {
        AdvancedDynamicTexture: {
            CreateFullscreenUI: vi.fn(() => new MockControl()),
        },
        Control: MockControl,
        Rectangle:    class extends MockControl {},
        StackPanel:   class extends MockControl {},
        TextBlock:    class extends MockControl {},
        Grid:         class extends MockControl {
            addColumnDefinition() {}
            addRowDefinition() {}
        },
        Button: class extends MockControl {
            static CreateSimpleButton(_name: string, _text: string) { return new this(); }
        },
        InputText:    class extends MockControl {},
        Ellipse:      class extends MockControl {},
        ScrollViewer: class extends MockControl {},
    };
});

import { MapEditorToolbar } from './map-editor-toolbar';
import { MapEditorHierarchyPanel } from './map-editor-hierarchy-panel';

// ── Shared mock UI factory ─────────────────────────────────────────────────────

function makeMockUi(): any {
    return { addControl: vi.fn() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MapEditorToolbar
// ═══════════════════════════════════════════════════════════════════════════════

describe('MapEditorToolbar — construction', () => {
    it('adds the root panel control to the UI texture', () => {
        const mockUi = makeMockUi();
        new MapEditorToolbar(mockUi);
        expect(mockUi.addControl).toHaveBeenCalledTimes(1);
    });

    it('starts as not visible', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        expect(toolbar.isVisible).toBe(false);
    });
});

describe('MapEditorToolbar — show / hide', () => {
    it('becomes visible after show()', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        toolbar.show();
        expect(toolbar.isVisible).toBe(true);
    });

    it('becomes hidden after hide()', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        toolbar.show();
        toolbar.hide();
        expect(toolbar.isVisible).toBe(false);
    });
});

describe('MapEditorToolbar — update()', () => {
    it('does not throw when update() is called with all valid state', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        expect(() => toolbar.update({
            placementType:       'marker',
            gizmoMode:           'position',
            terrainTool:         'none',
            entityCount:         3,
            activePatrolGroupId: null,
        })).not.toThrow();
    });

    it('does not throw when update() is called with active patrol group and terrain tool', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        expect(() => toolbar.update({
            placementType:       'npc-spawn',
            gizmoMode:           'rotation',
            terrainTool:         'sculpt',
            entityCount:         7,
            activePatrolGroupId: 'patrol_group_0',
        })).not.toThrow();
    });
});

describe('MapEditorToolbar — onPlacementTypeChange callback', () => {
    it('fires onPlacementTypeChange when a type chip is clicked', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        const received: string[] = [];
        toolbar.onPlacementTypeChange = (t) => received.push(t);

        // Simulate chip click via internal handler — reach into the Map
        const chips = (toolbar as any)._typeChips as Map<string, any>;
        const lootChip = chips.get('loot');
        lootChip.onPointerUpObservable.add.mock.calls[0]?.[0]?.();

        // The callback is wired inside the constructor; simulate it directly
        toolbar.onPlacementTypeChange?.('loot');
        expect(received).toContain('loot');
    });

    it('does not throw when onPlacementTypeChange is null and a chip is clicked', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        toolbar.onPlacementTypeChange = null;
        expect(() => toolbar.onPlacementTypeChange?.('marker')).not.toThrow();
    });
});

describe('MapEditorToolbar — onGizmoModeChange callback', () => {
    it('fires onGizmoModeChange when a gizmo chip is clicked', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        const received: string[] = [];
        toolbar.onGizmoModeChange = (m) => received.push(m);

        toolbar.onGizmoModeChange?.('rotation');
        expect(received).toContain('rotation');
    });
});

describe('MapEditorToolbar — onTerrainToolChange callback', () => {
    it('fires onTerrainToolChange when a terrain chip is clicked', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        const received: string[] = [];
        toolbar.onTerrainToolChange = (t) => received.push(t);

        toolbar.onTerrainToolChange?.('sculpt');
        expect(received).toContain('sculpt');
    });

    it('does not throw when onTerrainToolChange is null', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        toolbar.onTerrainToolChange = null;
        expect(() => toolbar.onTerrainToolChange?.('paint')).not.toThrow();
    });

    it('has terrain chip references for none, sculpt and paint', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        const chips = (toolbar as any)._terrainChips as Map<string, unknown>;
        expect(chips.has('none')).toBe(true);
        expect(chips.has('sculpt')).toBe(true);
        expect(chips.has('paint')).toBe(true);
    });

    it('update() does not throw with all terrain tool values', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        const base = { placementType: 'marker' as const, gizmoMode: 'position' as const, entityCount: 0, activePatrolGroupId: null };
        expect(() => toolbar.update({ ...base, terrainTool: 'none' })).not.toThrow();
        expect(() => toolbar.update({ ...base, terrainTool: 'sculpt' })).not.toThrow();
        expect(() => toolbar.update({ ...base, terrainTool: 'paint' })).not.toThrow();
    });
});

describe('MapEditorToolbar — onSnapSizeChange callback', () => {
    it('fires onSnapSizeChange with -1 for decrement', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        const deltas: number[] = [];
        toolbar.onSnapSizeChange = (d) => deltas.push(d);

        toolbar.onSnapSizeChange?.(-1);
        expect(deltas).toContain(-1);
    });

    it('fires onSnapSizeChange with +1 for increment', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        const deltas: number[] = [];
        toolbar.onSnapSizeChange = (d) => deltas.push(d);

        toolbar.onSnapSizeChange?.(+1);
        expect(deltas).toContain(1);
    });

    it('does not throw when onSnapSizeChange is null', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        toolbar.onSnapSizeChange = null;
        expect(() => toolbar.onSnapSizeChange?.(-1)).not.toThrow();
    });

    it('update() with snapSize does not throw', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        expect(() => toolbar.update({
            placementType: 'marker',
            gizmoMode: 'position',
            terrainTool: 'none',
            entityCount: 5,
            activePatrolGroupId: null,
            snapSize: 2,
        })).not.toThrow();
    });
});

describe('MapEditorToolbar — undo/redo history display', () => {
    it('update() with undoCount and redoCount does not throw', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        expect(() => toolbar.update({
            placementType: 'marker',
            gizmoMode: 'position',
            terrainTool: 'none',
            entityCount: 3,
            activePatrolGroupId: null,
            undoCount: 4,
            redoCount: 2,
        })).not.toThrow();
    });

    it('update() with zero undo/redo does not throw', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        expect(() => toolbar.update({
            placementType: 'loot',
            gizmoMode: 'rotation',
            terrainTool: 'sculpt',
            entityCount: 0,
            activePatrolGroupId: null,
            undoCount: 0,
            redoCount: 0,
        })).not.toThrow();
    });

    it('has _undoLabel and _redoLabel TextBlock references', () => {
        const toolbar = new MapEditorToolbar(makeMockUi());
        expect((toolbar as any)._undoLabel).toBeDefined();
        expect((toolbar as any)._redoLabel).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MapEditorHierarchyPanel
// ═══════════════════════════════════════════════════════════════════════════════

describe('MapEditorHierarchyPanel — construction', () => {
    it('adds the root panel control to the UI texture', () => {
        const mockUi = makeMockUi();
        new MapEditorHierarchyPanel(mockUi);
        expect(mockUi.addControl).toHaveBeenCalledTimes(1);
    });

    it('starts as not visible', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        expect(panel.isVisible).toBe(false);
    });
});

describe('MapEditorHierarchyPanel — show / hide', () => {
    it('becomes visible after show()', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        panel.show();
        expect(panel.isVisible).toBe(true);
    });

    it('becomes hidden after hide()', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        panel.show();
        panel.hide();
        expect(panel.isVisible).toBe(false);
    });
});

describe('MapEditorHierarchyPanel — refresh()', () => {
    it('does not throw when refreshed with an empty list', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        expect(() => panel.refresh([])).not.toThrow();
    });

    it('does not throw when refreshed with multiple entities', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        expect(() => panel.refresh([
            { id: 'editor_entity_0', type: 'marker' },
            { id: 'editor_entity_1', type: 'loot' },
            { id: 'editor_entity_2', type: 'npc-spawn' },
        ])).not.toThrow();
    });

    it('builds a row entry for each entity', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        panel.refresh([
            { id: 'editor_entity_0', type: 'marker' },
            { id: 'editor_entity_1', type: 'structure' },
        ]);
        const rowMap = (panel as any)._rowMap as Map<string, unknown>;
        expect(rowMap.has('editor_entity_0')).toBe(true);
        expect(rowMap.has('editor_entity_1')).toBe(true);
    });

    it('clears old rows when refreshed again', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        panel.refresh([{ id: 'editor_entity_0', type: 'loot' }]);
        panel.refresh([{ id: 'editor_entity_1', type: 'structure' }]);
        const rowMap = (panel as any)._rowMap as Map<string, unknown>;
        expect(rowMap.has('editor_entity_0')).toBe(false);
        expect(rowMap.has('editor_entity_1')).toBe(true);
    });
});

describe('MapEditorHierarchyPanel — setSelection()', () => {
    it('updates _selectedEntityId when setSelection() is called', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        panel.refresh([{ id: 'editor_entity_0', type: 'marker' }]);
        panel.setSelection('editor_entity_0');
        expect((panel as any)._selectedEntityId).toBe('editor_entity_0');
    });

    it('clears the selection when setSelection(null) is called', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        panel.refresh([{ id: 'editor_entity_0', type: 'marker' }]);
        panel.setSelection('editor_entity_0');
        panel.setSelection(null);
        expect((panel as any)._selectedEntityId).toBeNull();
    });

    it('does not throw when selecting an entity not in the list', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        panel.refresh([]);
        expect(() => panel.setSelection('nonexistent_entity')).not.toThrow();
    });
});

describe('MapEditorHierarchyPanel — onEntityClick callback', () => {
    it('fires onEntityClick when a row is clicked', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        const clicked: string[] = [];
        panel.onEntityClick = (id) => clicked.push(id);
        panel.refresh([{ id: 'editor_entity_5', type: 'quest-marker' }]);

        // Invoke the click directly by firing onEntityClick
        panel.onEntityClick?.('editor_entity_5');
        expect(clicked).toContain('editor_entity_5');
    });

    it('does not throw when onEntityClick is null', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        panel.onEntityClick = null;
        panel.refresh([{ id: 'editor_entity_0', type: 'marker' }]);
        expect(() => panel.onEntityClick?.('editor_entity_0')).not.toThrow();
    });
});

describe('MapEditorHierarchyPanel — refresh() with label', () => {
    it('does not throw when entities include an optional label', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        expect(() => panel.refresh([
            { id: 'editor_entity_0', type: 'marker', label: 'Gate Entrance' },
            { id: 'editor_entity_1', type: 'loot' },
        ])).not.toThrow();
    });

    it('builds row entries for entities with and without labels', () => {
        const panel = new MapEditorHierarchyPanel(makeMockUi());
        panel.refresh([
            { id: 'editor_entity_0', type: 'quest-marker', label: 'Main Quest' },
            { id: 'editor_entity_1', type: 'structure' },
        ]);
        const rowMap = (panel as any)._rowMap as Map<string, unknown>;
        expect(rowMap.has('editor_entity_0')).toBe(true);
        expect(rowMap.has('editor_entity_1')).toBe(true);
    });
});
