import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UIManager } from './ui-manager';
import { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';

vi.mock('@babylonjs/gui/2D', () => {
    class MockControl {
        static HORIZONTAL_ALIGNMENT_RIGHT = 0;
        static VERTICAL_ALIGNMENT_CENTER = 1;
        static HORIZONTAL_ALIGNMENT_LEFT = 2;
        static VERTICAL_ALIGNMENT_TOP = 3;
        static VERTICAL_ALIGNMENT_BOTTOM = 4;
        static HORIZONTAL_ALIGNMENT_CENTER = 5;

        onPointerEnterObservable = { add: vi.fn() };
        onPointerOutObservable = { add: vi.fn() };
        onFocusObservable = { add: vi.fn() };
        onBlurObservable = { add: vi.fn() };
        onPointerUpObservable = { add: vi.fn() };
        onKeyboardEventProcessedObservable = { add: vi.fn() };

        dispose = vi.fn();
    }

    class MockRectangle extends MockControl {
        width: string = '';
        height: string = '';
        cornerRadius: number = 0;
        color: string = '';
        thickness: number = 0;
        background: string = '';
        horizontalAlignment: number = 0;
        verticalAlignment: number = 0;
        left: string = '';
        top: string = '';
        isVisible: boolean = true;
        isPointerBlocker: boolean = false;
        hoverCursor: string = '';
        isFocusInvisible: boolean = true;
        tabIndex: number = -1;
        accessibilityTag: any = null;
        zIndex: number = 0;
        alpha: number = 1;

        children: any[] = [];
        addControl = vi.fn((control) => this.children.push(control));
        removeControl = vi.fn((control) => {
            const index = this.children.indexOf(control);
            if (index > -1) {
                this.children.splice(index, 1);
            }
        });
    }

    class MockTextBlock extends MockControl {
        text: string = '';
        color: string = '';
        fontSize: number = 12;
        height: string = '';
        verticalAlignment: number = 0;
        top: string = '';
        textWrapping: boolean = false;
        paddingLeft: string = '';
        textHorizontalAlignment: number = 0;
        textVerticalAlignment: number = 0;
        paddingTop: string = '';
        shadowBlur: number = 0;
        shadowColor: string = '';
        fontWeight: string = '';
        width: string = '';
        left: string = '';
        zIndex: number = 0;
        alpha: number = 1;
    }

    class MockGrid extends MockControl {
        width: string = '';
        height: string = '';
        top: string = '';
        children: any[] = [];

        addColumnDefinition = vi.fn();
        addRowDefinition = vi.fn();
        addControl = vi.fn((control) => this.children.push(control));
    }

    class MockStackPanel extends MockControl {
        width: string = '';
        height: string = '';
        verticalAlignment: number = 0;
        horizontalAlignment: number = 0;
        top: string = '';
        left: string = '';
        isVertical: boolean = true;
        children: any[] = [];
        addControl = vi.fn((control) => this.children.push(control));
        removeControl = vi.fn((control) => {
            const index = this.children.indexOf(control);
            if (index > -1) {
                this.children.splice(index, 1);
            }
        });
    }

    class MockButton extends MockControl {
        width: string = '';
        height: string = '';
        color: string = '';
        cornerRadius: number = 0;
        background: string = '';
        paddingBottom: string = '';
        hoverCursor: string = '';
        thickness: number = 0;
        isFocusInvisible: boolean = true;
        tabIndex: number = -1;
        accessibilityTag: any = null;

        static CreateSimpleButton = vi.fn((_name, _text) => new MockButton());
    }

    class MockEllipse extends MockControl {
        width: string = '';
        height: string = '';
        color: string = '';
        thickness: number = 0;
        background: string = '';
        scaleX: number = 1;
        scaleY: number = 1;
        isVisible: boolean = true;
    }

    class MockAdvancedDynamicTexture {
        static CreateFullscreenUI = vi.fn(() => new MockAdvancedDynamicTexture());

        children: any[] = [];
        addControl = vi.fn((control) => this.children.push(control));
        removeControl = vi.fn((control) => {
            const index = this.children.indexOf(control);
            if (index > -1) {
                this.children.splice(index, 1);
            }
        });
    }

    return {
        Control: MockControl,
        Rectangle: MockRectangle,
        TextBlock: MockTextBlock,
        Grid: MockGrid,
        StackPanel: MockStackPanel,
        Button: MockButton,
        Ellipse: MockEllipse,
        AdvancedDynamicTexture: MockAdvancedDynamicTexture
    };
});

describe('UIManager', () => {
    let uiManager: UIManager;
    let mockScene: any;

    beforeEach(() => {
        mockScene = {} as Scene;
        uiManager = new UIManager(mockScene);
    });

    describe('updateMagicka', () => {
        it('should calculate magicka bar width correctly for normal values', () => {
            uiManager.updateMagicka(50, 100);
            expect(uiManager.magickaBar.width).toBe('50%');
        });

        it('should calculate magicka bar width correctly for zero current', () => {
            uiManager.updateMagicka(0, 100);
            expect(uiManager.magickaBar.width).toBe('0%');
        });

        it('should calculate magicka bar width correctly for full magicka', () => {
            uiManager.updateMagicka(100, 100);
            expect(uiManager.magickaBar.width).toBe('100%');
        });

        it('should handle negative current magicka by clamping to 0%', () => {
            uiManager.updateMagicka(-10, 100);
            expect(uiManager.magickaBar.width).toBe('0%');
        });

        it('should allow magicka bar width to exceed 100% if current is greater than max', () => {
            uiManager.updateMagicka(150, 100);
            expect(uiManager.magickaBar.width).toBe('150%');
        });
    });

    describe('updateHealth', () => {
        it('should calculate health bar width correctly for normal values', () => {
            uiManager.updateHealth(50, 100);
            expect(uiManager.healthBar.width).toBe('50%');
        });

        it('should calculate health bar width correctly for zero current', () => {
            uiManager.updateHealth(0, 100);
            expect(uiManager.healthBar.width).toBe('0%');
        });

        it('should calculate health bar width correctly for full health', () => {
            uiManager.updateHealth(100, 100);
            expect(uiManager.healthBar.width).toBe('100%');
        });

        it('should handle negative current health by clamping to 0%', () => {
            uiManager.updateHealth(-10, 100);
            expect(uiManager.healthBar.width).toBe('0%');
        });

        it('should allow health bar width to exceed 100% if current is greater than max', () => {
            uiManager.updateHealth(150, 100);
            expect(uiManager.healthBar.width).toBe('150%');
        });
    });

    describe('updateStamina', () => {
        it('should calculate stamina bar width correctly for normal values', () => {
            uiManager.updateStamina(50, 100);
            expect(uiManager.staminaBar.width).toBe('50%');
        });

        it('should calculate stamina bar width correctly for zero current', () => {
            uiManager.updateStamina(0, 100);
            expect(uiManager.staminaBar.width).toBe('0%');
        });

        it('should calculate stamina bar width correctly for full stamina', () => {
            uiManager.updateStamina(100, 100);
            expect(uiManager.staminaBar.width).toBe('100%');
        });

        it('should handle negative current stamina by clamping to 0%', () => {
            uiManager.updateStamina(-10, 100);
            expect(uiManager.staminaBar.width).toBe('0%');
        });

        it('should allow stamina bar width to exceed 100% if current is greater than max', () => {
            uiManager.updateStamina(150, 100);
            expect(uiManager.staminaBar.width).toBe('150%');
        });
    });
});
