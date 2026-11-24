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

import { UIManager } from './ui-manager';
import { Scene } from '@babylonjs/core/scene';

describe('UIManager', () => {
    let uiManager: UIManager;

    beforeEach(() => {
        uiManager?.hud.destroy();
        uiManager = new UIManager({} as Scene);
    });

    describe('updateHealth', () => {
        it('should update healthBar width based on normal health', () => {
            uiManager.updateHealth(50, 100);
            expect(uiManager.hud.health.style.width).toBe('50%');
        });

        it('should update healthBar width to 100% when at max health', () => {
            uiManager.updateHealth(100, 100);
            expect(uiManager.hud.health.style.width).toBe('100%');
        });

        it('should update healthBar width to 0% when health is 0', () => {
            uiManager.updateHealth(0, 100);
            expect(uiManager.hud.health.style.width).toBe('0%');
        });

        it('should cap healthBar width at 0% when health is negative', () => {
            uiManager.updateHealth(-10, 100);
            expect(uiManager.hud.health.style.width).toBe('0%');
        });

        it('should update healthBar width correctly for overheal (current > max)', () => {
            uiManager.updateHealth(120, 100);
            expect(uiManager.hud.health.style.width).toBe('100%');
        });

        it('should handle decimal values properly', () => {
            uiManager.updateHealth(33.33, 100);
            expect(uiManager.hud.health.style.width).toBe('33.33%');
        });

        it('should handle zero max health safely', () => {
            uiManager.updateHealth(0, 0);
            expect(uiManager.hud.health.style.width).toBe('0%');
        });
    });

    describe('resource bar clamping', () => {
        it('should clamp magicka bar between 0% and 100%', () => {
            uiManager.updateMagicka(150, 100);
            expect(uiManager.hud.magicka.style.width).toBe('100%');

            uiManager.updateMagicka(-20, 100);
            expect(uiManager.hud.magicka.style.width).toBe('0%');
        });

        it('should clamp stamina bar between 0% and 100%', () => {
            uiManager.updateStamina(300, 100);
            expect(uiManager.hud.stamina.style.width).toBe('100%');

            uiManager.updateStamina(-10, 100);
            expect(uiManager.hud.stamina.style.width).toBe('0%');
        });

        it('should clamp xp bar and keep level label in sync', () => {
            uiManager.updateXP(999, 100, 8, 3);
            expect(uiManager.hud.xp.style.width).toBe('100%');

            uiManager.updateXP(-5, 100, 9, 4);
            expect(uiManager.hud.xp.style.width).toBe('0%');
        });
    });

    describe('crosshair visibility with overlapping panels', () => {
        it('keeps crosshair hidden until all blocking panels are closed', () => {
            uiManager.toggleInventory(true);
            expect(uiManager.isCrosshairVisible).toBe(false);

            uiManager.toggleQuestLog(true);
            expect(uiManager.isCrosshairVisible).toBe(false);

            uiManager.toggleInventory(false);
            expect(uiManager.isCrosshairVisible).toBe(false);

            uiManager.toggleQuestLog(false);
            expect(uiManager.isCrosshairVisible).toBe(true);
        });

        it('hides crosshair while attribute panel is open', () => {
            uiManager.toggleAttributePanel(true);
            expect(uiManager.isCrosshairVisible).toBe(false);

            uiManager.toggleAttributePanel(false);
            expect(uiManager.isCrosshairVisible).toBe(true);
        });
    });

    describe('HUD on the page', () => {
        it('marks low health, labels the bars, and shows the level', () => {
            uiManager.updateHealth(20, 100);
            const hp = uiManager.hud.health.parentElement!;
            expect(hp.classList.contains('hud-bar--low')).toBe(true);
            expect(hp.getAttribute('aria-label')).toBe('Health');
            expect(hp.getAttribute('aria-valuenow')).toBe('20');
            uiManager.updateHealth(80, 100);
            expect(hp.classList.contains('hud-bar--low')).toBe(false);
            uiManager.updateXP(5, 10, 3, 7);
            expect(uiManager.hud.level.textContent).toBe('CL 7\nLv.3');
        });

        it('stacks notifications (at most six) and drops each after its time', () => {
            vi.useFakeTimers();
            try {
                for (let i = 0; i < 8; i++) uiManager.showNotification(`n${i}`, 1000 + i);
                const rows = () => Array.from(uiManager.hud.notifications.children).map((r) => r.textContent);
                expect(rows()).toEqual(['n2', 'n3', 'n4', 'n5', 'n6', 'n7']);
                vi.advanceTimersByTime(1004);
                expect(rows()).toEqual(['n5', 'n6', 'n7']);
                vi.advanceTimersByTime(10);
                expect(rows()).toEqual([]);
            } finally {
                vi.useRealTimers();
            }
        });

        it('shows the compass heading, clock, stealth state and combat line', () => {
            uiManager.updateCompass(Math.PI / 2);
            expect(uiManager.hud.compass.textContent).toBe('NE  ‹ E ›  SE');
            uiManager.updateClock('21:30');
            expect(uiManager.hud.clock.textContent).toBe('21:30');
            uiManager.updateStealthHUD('Detected');
            expect(uiManager.hud.stealth.hidden).toBe(false);
            expect(uiManager.hud.stealth.dataset.state).toBe('detected');
            uiManager.updateStealthHUD(null);
            expect(uiManager.hud.stealth.hidden).toBe(true);
            uiManager.updateCombatState('Combo ×2');
            expect(uiManager.hud.combatState.hidden).toBe(false);
            uiManager.updateCombatState(null);
            expect(uiManager.hud.combatState.hidden).toBe(true);
        });
    });

    describe('pause menu', () => {
        it('opens with the actions the game set and hides the crosshair', () => {
            const resume = vi.fn();
            uiManager.setPauseActions({ resume, save: vi.fn(), load: vi.fn(), exportSave: vi.fn(), importSave: vi.fn(), settings: vi.fn(), credits: vi.fn(), quit: vi.fn() });
            uiManager.togglePauseMenu(true);
            expect(uiManager.isPauseMenuOpen).toBe(true);
            expect(uiManager.isCrosshairVisible).toBe(false);
            const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.pause-menu__item')).map((b) => b.textContent);
            expect(buttons).toEqual(['Resume', 'Save Game', 'Load Game', 'Export Save', 'Import Save…', 'Settings', 'Credits', 'Quit to Menu']);
            document.querySelector<HTMLButtonElement>('.pause-menu__item')!.click();
            expect(resume).toHaveBeenCalledOnce();
            uiManager.togglePauseMenu(false);
            expect(document.querySelector('.pause-menu__item')).toBeNull();
            expect(uiManager.isCrosshairVisible).toBe(true);
        });
    });
});
