import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@babylonjs/core/scene', () => {
    return {
        Scene: class {}
    };
});

vi.mock('@babylonjs/core/Maths/math.vector', () => {
    return {
        Vector3: class {
            static Project() { return { x: 0, y: 0, z: 0.5 }; }
        },
        Matrix: class {
            static Identity() { return {}; }
        }
    };
});

vi.mock('@babylonjs/gui/2D', () => {
    class MockControl {
        static HORIZONTAL_ALIGNMENT_RIGHT = 1;
        static VERTICAL_ALIGNMENT_CENTER = 2;
        static VERTICAL_ALIGNMENT_TOP = 3;
        static HORIZONTAL_ALIGNMENT_LEFT = 4;
        static VERTICAL_ALIGNMENT_BOTTOM = 5;
        static HORIZONTAL_ALIGNMENT_CENTER = 6;

        onPointerEnterObservable = { add: vi.fn() };
        onPointerOutObservable = { add: vi.fn() };
        onFocusObservable = { add: vi.fn() };
        onBlurObservable = { add: vi.fn() };
        onPointerUpObservable = { add: vi.fn() };
        onKeyboardEventProcessedObservable = { add: vi.fn() };

        children: any[] = [];

        addControl(child: any) {
            this.children.push(child);
        }
        removeControl(child: any) {
            this.children = this.children.filter(c => c !== child);
        }
        dispose() {}
    }

    return {
        AdvancedDynamicTexture: {
            CreateFullscreenUI: vi.fn(() => new MockControl())
        },
        Control: MockControl,
        Rectangle: class extends MockControl { width: string = ''; height: string = ''; },
        StackPanel: class extends MockControl { isVertical: boolean = false; },
        TextBlock: class extends MockControl { text: string = ''; },
        Grid: class extends MockControl {
            addColumnDefinition() {}
            addRowDefinition() {}
        },
        Button: class extends MockControl {
            static CreateSimpleButton() { return new this(); }
        },
        Ellipse: class extends MockControl {}
    };
});

import { UIManager } from './ui-manager';
import { Scene } from '@babylonjs/core/scene';

describe('UIManager', () => {
    let uiManager: UIManager;

    beforeEach(() => {
        uiManager = new UIManager({} as Scene);
    });

    describe('updateHealth', () => {
        it('should update healthBar width based on normal health', () => {
            uiManager.updateHealth(50, 100);
            expect(uiManager.healthBar.width).toBe('50%');
        });

        it('should update healthBar width to 100% when at max health', () => {
            uiManager.updateHealth(100, 100);
            expect(uiManager.healthBar.width).toBe('100%');
        });

        it('should update healthBar width to 0% when health is 0', () => {
            uiManager.updateHealth(0, 100);
            expect(uiManager.healthBar.width).toBe('0%');
        });

        it('should cap healthBar width at 0% when health is negative', () => {
            uiManager.updateHealth(-10, 100);
            expect(uiManager.healthBar.width).toBe('0%');
        });

        it('should update healthBar width correctly for overheal (current > max)', () => {
            uiManager.updateHealth(120, 100);
            expect(uiManager.healthBar.width).toBe('100%');
        });

        it('should handle decimal values properly', () => {
            uiManager.updateHealth(33.33, 100);
            expect(uiManager.healthBar.width).toBe('33.33%');
        });

        it('should handle zero max health safely', () => {
            uiManager.updateHealth(0, 0);
            expect(uiManager.healthBar.width).toBe('0%');
        });
    });

    describe('resource bar clamping', () => {
        it('should clamp magicka bar between 0% and 100%', () => {
            uiManager.updateMagicka(150, 100);
            expect(uiManager.magickaBar.width).toBe('100%');

            uiManager.updateMagicka(-20, 100);
            expect(uiManager.magickaBar.width).toBe('0%');
        });

        it('should clamp stamina bar between 0% and 100%', () => {
            uiManager.updateStamina(300, 100);
            expect(uiManager.staminaBar.width).toBe('100%');

            uiManager.updateStamina(-10, 100);
            expect(uiManager.staminaBar.width).toBe('0%');
        });

        it('should clamp xp bar and keep level label in sync', () => {
            uiManager.updateXP(999, 100, 8);
            expect(uiManager.xpBar.width).toBe('100%');

            uiManager.updateXP(-5, 100, 9);
            expect(uiManager.xpBar.width).toBe('0%');
        });
    });

    describe('crosshair visibility with overlapping panels', () => {
        it('keeps crosshair hidden until all blocking panels are closed', () => {
            uiManager.toggleInventory(true);
            expect(uiManager.crosshair.isVisible).toBe(false);

            uiManager.toggleQuestLog(true);
            expect(uiManager.crosshair.isVisible).toBe(false);

            uiManager.toggleInventory(false);
            expect(uiManager.crosshair.isVisible).toBe(false);

            uiManager.toggleQuestLog(false);
            expect(uiManager.crosshair.isVisible).toBe(true);
        });

        it('hides crosshair while attribute panel is open', () => {
            uiManager.toggleAttributePanel(true);
            expect(uiManager.crosshair.isVisible).toBe(false);

            uiManager.toggleAttributePanel(false);
            expect(uiManager.crosshair.isVisible).toBe(true);
        });
    });
});
