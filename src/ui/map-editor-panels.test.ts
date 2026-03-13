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
        bottom: string = '';
        left: string = '';
        adaptHeightToChildren: boolean = false;
        fontStyle: string = '';
        isVertical: boolean = false;
        isPointerBlocker: boolean = false;
        textWrapping: boolean = false;

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

import { MapEditorValidationPanel } from './map-editor-validation-panel';
import { MapEditorPalettePanel } from './map-editor-palette-panel';
import type { MapValidationReport } from '../systems/map-editor-system';

function makeMockUi(): any {
    return { addControl: vi.fn() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MapEditorValidationPanel
// ═══════════════════════════════════════════════════════════════════════════════

describe('MapEditorValidationPanel — construction', () => {
    it('adds the root panel control to the UI texture', () => {
        const mockUi = makeMockUi();
        new MapEditorValidationPanel(mockUi);
        expect(mockUi.addControl).toHaveBeenCalledTimes(1);
    });

    it('starts as not visible', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        expect(panel.isVisible).toBe(false);
    });
});

describe('MapEditorValidationPanel — show / hide', () => {
    it('becomes visible after show()', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        const report: MapValidationReport = { isValid: true, issues: [] };
        panel.show(report);
        expect(panel.isVisible).toBe(true);
    });

    it('becomes hidden after hide()', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        panel.show({ isValid: true, issues: [] });
        panel.hide();
        expect(panel.isVisible).toBe(false);
    });
});

describe('MapEditorValidationPanel — show() with valid report', () => {
    it('does not throw when shown with a valid (no-issues) report', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        expect(() => panel.show({ isValid: true, issues: [] })).not.toThrow();
    });
});

describe('MapEditorValidationPanel — show() with invalid report', () => {
    it('does not throw when shown with multiple issues', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        const report: MapValidationReport = {
            isValid: false,
            issues: [
                {
                    code: 'entity-overlap',
                    message: 'Entities overlap.',
                    entityIds: ['editor_entity_0', 'editor_entity_1'],
                },
                {
                    code: 'orphaned-quest-marker',
                    message: 'Quest marker has no objective.',
                    entityIds: ['editor_entity_2'],
                },
            ],
        };
        expect(() => panel.show(report)).not.toThrow();
    });

    it('does not throw for issues without entityIds', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        const report: MapValidationReport = {
            isValid: false,
            issues: [
                {
                    code: 'patrol-route-too-short',
                    message: 'Route has only 1 waypoint.',
                    patrolGroupId: 'patrol_group_0',
                },
            ],
        };
        expect(() => panel.show(report)).not.toThrow();
    });
});

describe('MapEditorValidationPanel — update()', () => {
    it('does not throw when update() is called while visible', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        panel.show({ isValid: true, issues: [] });
        const updated: MapValidationReport = {
            isValid: false,
            issues: [
                { code: 'entity-overlap', message: 'overlap', entityIds: ['e0', 'e1'] },
            ],
        };
        expect(() => panel.update(updated)).not.toThrow();
    });

    it('does not throw when update() is called while hidden', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        expect(() => panel.update({ isValid: true, issues: [] })).not.toThrow();
    });
});

describe('MapEditorValidationPanel — onRevalidate callback', () => {
    it('fires onRevalidate when set', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        const calls: number[] = [];
        panel.onRevalidate = () => calls.push(1);
        panel.onRevalidate?.();
        expect(calls).toHaveLength(1);
    });

    it('does not throw when onRevalidate is null', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        panel.onRevalidate = null;
        expect(() => panel.onRevalidate?.()).not.toThrow();
    });
});

describe('MapEditorValidationPanel — onEntityFocus callback', () => {
    it('fires onEntityFocus with the entity ID', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        const received: string[] = [];
        panel.onEntityFocus = (id) => received.push(id);
        panel.onEntityFocus?.('editor_entity_7');
        expect(received).toContain('editor_entity_7');
    });

    it('does not throw when onEntityFocus is null', () => {
        const panel = new MapEditorValidationPanel(makeMockUi());
        panel.onEntityFocus = null;
        expect(() => panel.onEntityFocus?.('editor_entity_0')).not.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MapEditorPalettePanel
// ═══════════════════════════════════════════════════════════════════════════════

describe('MapEditorPalettePanel — construction', () => {
    it('adds the root panel control to the UI texture', () => {
        const mockUi = makeMockUi();
        new MapEditorPalettePanel(mockUi);
        expect(mockUi.addControl).toHaveBeenCalledTimes(1);
    });

    it('starts as not visible', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        expect(panel.isVisible).toBe(false);
    });
});

describe('MapEditorPalettePanel — show / hide', () => {
    it('becomes visible after show()', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        panel.show();
        expect(panel.isVisible).toBe(true);
    });

    it('becomes hidden after hide()', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        panel.show();
        panel.hide();
        expect(panel.isVisible).toBe(false);
    });
});

describe('MapEditorPalettePanel — setActivePlacementType()', () => {
    it('does not throw for any placement type', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        const types = ['marker', 'loot', 'npc-spawn', 'quest-marker', 'structure'] as const;
        for (const t of types) {
            expect(() => panel.setActivePlacementType(t)).not.toThrow();
        }
    });

    it('has row entries for all placement types', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        const rowMap = (panel as any)._typeRows as Map<string, unknown>;
        expect(rowMap.has('marker')).toBe(true);
        expect(rowMap.has('loot')).toBe(true);
        expect(rowMap.has('npc-spawn')).toBe(true);
        expect(rowMap.has('quest-marker')).toBe(true);
        expect(rowMap.has('structure')).toBe(true);
    });
});

describe('MapEditorPalettePanel — onPlacementTypeChange callback', () => {
    it('fires onPlacementTypeChange when set', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        const received: string[] = [];
        panel.onPlacementTypeChange = (t) => received.push(t);
        panel.onPlacementTypeChange?.('loot');
        expect(received).toContain('loot');
    });

    it('does not throw when onPlacementTypeChange is null', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        panel.onPlacementTypeChange = null;
        expect(() => panel.onPlacementTypeChange?.('marker')).not.toThrow();
    });
});

describe('MapEditorPalettePanel — onPlace callback', () => {
    it('fires onPlace with the placement type', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        const received: string[] = [];
        panel.onPlace = (t) => received.push(t);
        panel.onPlace?.('structure');
        expect(received).toContain('structure');
    });

    it('does not throw when onPlace is null', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        panel.onPlace = null;
        expect(() => panel.onPlace?.('marker')).not.toThrow();
    });
});

describe('MapEditorPalettePanel — onDuplicate / onDelete callbacks', () => {
    it('fires onDuplicate when set', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        let called = false;
        panel.onDuplicate = () => { called = true; };
        panel.onDuplicate?.();
        expect(called).toBe(true);
    });

    it('fires onDelete when set', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        let called = false;
        panel.onDelete = () => { called = true; };
        panel.onDelete?.();
        expect(called).toBe(true);
    });

    it('does not throw when onDuplicate is null', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        panel.onDuplicate = null;
        expect(() => panel.onDuplicate?.()).not.toThrow();
    });

    it('does not throw when onDelete is null', () => {
        const panel = new MapEditorPalettePanel(makeMockUi());
        panel.onDelete = null;
        expect(() => panel.onDelete?.()).not.toThrow();
    });
});
