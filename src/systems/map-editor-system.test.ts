import { describe, it, expect, afterEach } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
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

describe('MapEditorSystem', () => {
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
        expect(marker.metadata?.editorMarker).toBe(true);
        expect(marker.position.x).toBe(2);
        expect(marker.position.y).toBe(2);
        expect(marker.position.z).toBe(-2);
    });
});
