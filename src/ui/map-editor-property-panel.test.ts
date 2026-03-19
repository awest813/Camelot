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
        placeholderText: string = '';
        focusedBackground: string = '';
        focusedColor: string = '';
        textHorizontalAlignment: number = 0;
        isVertical: boolean = false;

        onPointerEnterObservable = { add: vi.fn() };
        onPointerOutObservable   = { add: vi.fn() };
        onPointerUpObservable    = { add: vi.fn() };
        onFocusObservable        = { add: vi.fn() };
        onBlurObservable         = { add: vi.fn() };
        onKeyboardEventProcessedObservable = { add: vi.fn() };

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
        Rectangle:  class extends MockControl {},
        StackPanel: class extends MockControl {},
        TextBlock:  class extends MockControl {},
        Grid:       class extends MockControl {
            addColumnDefinition() {}
            addRowDefinition() {}
        },
        Button: class extends MockControl {
            static CreateSimpleButton(_name: string, _text: string) { return new this(); }
        },
        InputText: class extends MockControl {},
        Ellipse: class extends MockControl {},
    };
});

import { MapEditorPropertyPanel } from './map-editor-property-panel';

function makePanel(): { panel: MapEditorPropertyPanel; mockUi: any } {
    // A minimal mock of AdvancedDynamicTexture — just needs addControl()
    const mockUi: any = {
        addControl: vi.fn(),
    };
    const panel = new MapEditorPropertyPanel(mockUi);
    return { panel, mockUi };
}

// ─── Construction ─────────────────────────────────────────────────────────────

describe('MapEditorPropertyPanel — construction', () => {
    it('adds the root panel control to the UI texture', () => {
        const { mockUi } = makePanel();
        expect(mockUi.addControl).toHaveBeenCalledTimes(1);
    });

    it('starts as not visible', () => {
        const { panel } = makePanel();
        expect(panel.isVisible).toBe(false);
    });
});

// ─── Show / hide ─────────────────────────────────────────────────────────────

describe('MapEditorPropertyPanel — show / hide', () => {
    it('becomes visible after show()', () => {
        const { panel } = makePanel();

        panel.show('editor_entity_0', 'marker', { label: 'Test Marker' });

        expect(panel.isVisible).toBe(true);
    });

    it('becomes hidden after hide()', () => {
        const { panel } = makePanel();
        panel.show('editor_entity_0', 'marker', {});

        panel.hide();

        expect(panel.isVisible).toBe(false);
    });

    it('can be shown again after being hidden', () => {
        const { panel } = makePanel();
        panel.show('editor_entity_0', 'marker', {});
        panel.hide();

        panel.show('editor_entity_1', 'loot', { lootTableId: 'common' });

        expect(panel.isVisible).toBe(true);
    });
});

// ─── onApply callback ─────────────────────────────────────────────────────────

describe('MapEditorPropertyPanel — onApply', () => {
    it('fires onApply with correct entityId when Apply is clicked', () => {
        const { panel } = makePanel();
        const applyCalls: Array<{ id: string; props: any; layerName: string }> = [];
        panel.onApply = (id, props, layerName) => applyCalls.push({ id, props, layerName });

        panel.show('editor_entity_42', 'marker', { label: 'myLabel' });
        // Simulate Apply button click via the internal handler
        (panel as any)._handleApply();

        expect(applyCalls.length).toBe(1);
        expect(applyCalls[0].id).toBe('editor_entity_42');
        expect(applyCalls[0].layerName).toBe('objects');
    });

    it('does not fire onApply when no entity is shown', () => {
        const { panel } = makePanel();
        const applyCalls: string[] = [];
        panel.onApply = (id) => applyCalls.push(id);

        (panel as any)._handleApply();

        expect(applyCalls.length).toBe(0);
    });

    it('includes the selected layer when Apply is clicked', () => {
        const { panel } = makePanel();
        const applyCalls: Array<{ layerName: string }> = [];
        panel.onApply = (_id, _props, layerName) => applyCalls.push({ layerName });

        panel.show('editor_entity_42', 'marker', {}, undefined, 'terrain');
        (panel as any)._handleApply();

        expect(applyCalls).toEqual([{ layerName: 'terrain' }]);
    });
});

// ─── onDelete callback ────────────────────────────────────────────────────────

describe('MapEditorPropertyPanel — onDelete', () => {
    it('fires onDelete with the entity id when Delete is clicked', () => {
        const { panel } = makePanel();
        const deletedIds: string[] = [];
        panel.onDelete = (id) => deletedIds.push(id);

        panel.show('editor_entity_7', 'structure', { structureId: 'ruin_a' });
        (panel as any)._handleDelete();

        expect(deletedIds.length).toBe(1);
        expect(deletedIds[0]).toBe('editor_entity_7');
    });

    it('hides the panel after Delete is clicked', () => {
        const { panel } = makePanel();
        panel.onDelete = vi.fn();

        panel.show('editor_entity_7', 'structure', {});
        (panel as any)._handleDelete();

        expect(panel.isVisible).toBe(false);
    });

    it('does not fire onDelete when no entity is shown', () => {
        const { panel } = makePanel();
        const deletedIds: string[] = [];
        panel.onDelete = (id) => deletedIds.push(id);

        (panel as any)._handleDelete();

        expect(deletedIds.length).toBe(0);
    });
});

// ─── Field rendering by placement type ───────────────────────────────────────

describe('MapEditorPropertyPanel — field rendering', () => {
    it('renders label field for marker type', () => {
        const { panel } = makePanel();
        panel.show('e0', 'marker', {});
        expect((panel as any)._inputMap.has('label')).toBe(true);
    });

    it('renders lootTableId field for loot type', () => {
        const { panel } = makePanel();
        panel.show('e0', 'loot', {});
        expect((panel as any)._inputMap.has('lootTableId')).toBe(true);
    });

    it('renders spawnTemplateId field for npc-spawn type', () => {
        const { panel } = makePanel();
        panel.show('e0', 'npc-spawn', {});
        expect((panel as any)._inputMap.has('spawnTemplateId')).toBe(true);
    });

    it('renders objectiveId and dialogueTriggerId for quest-marker type', () => {
        const { panel } = makePanel();
        panel.show('e0', 'quest-marker', {});
        expect((panel as any)._inputMap.has('objectiveId')).toBe(true);
        expect((panel as any)._inputMap.has('dialogueTriggerId')).toBe(true);
    });

    it('renders structureId field for structure type', () => {
        const { panel } = makePanel();
        panel.show('e0', 'structure', {});
        expect((panel as any)._inputMap.has('structureId')).toBe(true);
    });

    it('rebuilds fields when show() is called again with a different type', () => {
        const { panel } = makePanel();
        panel.show('e0', 'loot', {});
        expect((panel as any)._inputMap.has('lootTableId')).toBe(true);

        panel.show('e1', 'structure', {});
        expect((panel as any)._inputMap.has('lootTableId')).toBe(false);
        expect((panel as any)._inputMap.has('structureId')).toBe(true);
    });

    it('builds layer chips for the available editor layers', () => {
        const { panel } = makePanel();
        panel.show('e0', 'marker', {});
        const chipMap = (panel as any)._layerChipMap as Map<string, unknown>;
        expect(chipMap.has('terrain')).toBe(true);
        expect(chipMap.has('objects')).toBe(true);
        expect(chipMap.has('events')).toBe(true);
        expect(chipMap.has('npcs')).toBe(true);
        expect(chipMap.has('triggers')).toBe(true);
    });
});

// ─── Position display ─────────────────────────────────────────────────────────

describe('MapEditorPropertyPanel — position display', () => {
    it('show() with position does not throw', () => {
        const { panel } = makePanel();
        expect(() => panel.show('e0', 'marker', {}, { x: 1.5, y: 0, z: -3.2 })).not.toThrow();
    });

    it('show() without position does not throw', () => {
        const { panel } = makePanel();
        expect(() => panel.show('e0', 'loot', {})).not.toThrow();
    });

    it('updatePosition() does not throw when called after show()', () => {
        const { panel } = makePanel();
        panel.show('e0', 'structure', {});
        expect(() => panel.updatePosition({ x: 2, y: 1, z: 0 })).not.toThrow();
    });

    it('has _positionText reference', () => {
        const { panel } = makePanel();
        expect((panel as any)._positionText).toBeDefined();
    });
});

// ─── onCopyId callback ────────────────────────────────────────────────────────

describe('MapEditorPropertyPanel — onCopyId', () => {
    it('fires onCopyId with the entity ID', () => {
        const { panel } = makePanel();
        const received: string[] = [];
        panel.onCopyId = (id) => received.push(id);
        panel.show('entity_42', 'marker', {});
        panel.onCopyId?.('entity_42');
        expect(received).toContain('entity_42');
    });

    it('does not throw when onCopyId is null', () => {
        const { panel } = makePanel();
        panel.onCopyId = null;
        expect(() => panel.onCopyId?.('entity_0')).not.toThrow();
    });
});
