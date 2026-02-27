import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestSystem, Quest } from './quest-system';

const makeQuest = (overrides: Partial<Quest> = {}): Quest => ({
    id: 'q1',
    name: 'Test Quest',
    description: 'A test.',
    isCompleted: false,
    isActive: true,
    objectives: [],
    ...overrides,
});

describe('QuestSystem', () => {
    let qs: QuestSystem;
    let mockUI: any;

    beforeEach(() => {
        mockUI = {
            showNotification: vi.fn(),
            toggleQuestLog: vi.fn(),
            updateQuestLog: vi.fn(),
        };
        qs = new QuestSystem(mockUI);
    });

    // ── addQuest ─────────────────────────────────────────────────────────────

    it('addQuest stores the quest and shows a notification', () => {
        qs.addQuest(makeQuest());
        expect(qs.getQuests()).toHaveLength(1);
        expect(mockUI.showNotification).toHaveBeenCalledWith('New Quest: Test Quest', 3000);
    });

    // ── getActiveQuests / getCompletedQuests ──────────────────────────────────

    it('getActiveQuests returns only active, incomplete quests', () => {
        qs.addQuest(makeQuest({ id: 'q1', isActive: true, isCompleted: false }));
        qs.addQuest(makeQuest({ id: 'q2', isActive: false, isCompleted: false }));
        qs.addQuest(makeQuest({ id: 'q3', isActive: true, isCompleted: true }));
        expect(qs.getActiveQuests()).toHaveLength(1);
        expect(qs.getActiveQuests()[0].id).toBe('q1');
    });

    it('getCompletedQuests returns only completed quests', () => {
        qs.addQuest(makeQuest({ id: 'q1', isCompleted: false }));
        qs.addQuest(makeQuest({ id: 'q2', isCompleted: true }));
        expect(qs.getCompletedQuests()).toHaveLength(1);
        expect(qs.getCompletedQuests()[0].id).toBe('q2');
    });

    // ── kill objective ────────────────────────────────────────────────────────

    it('onKill increments a kill objective', () => {
        qs.addQuest(makeQuest({
            objectives: [{ id: 'o1', type: 'kill', description: '', targetId: 'Guard', required: 2, current: 0, completed: false }],
        }));
        qs.onKill('Guard');
        expect(qs.getQuests()[0].objectives[0].current).toBe(1);
        expect(qs.getQuests()[0].objectives[0].completed).toBe(false);
        qs.onKill('Guard');
        expect(qs.getQuests()[0].objectives[0].current).toBe(2);
        expect(qs.getQuests()[0].objectives[0].completed).toBe(true);
    });

    it('onKill with wrong name does not advance the objective', () => {
        qs.addQuest(makeQuest({
            objectives: [{ id: 'o1', type: 'kill', description: '', targetId: 'Guard', required: 1, current: 0, completed: false }],
        }));
        qs.onKill('Bandit');
        expect(qs.getQuests()[0].objectives[0].current).toBe(0);
    });

    // ── fetch objective ───────────────────────────────────────────────────────

    it('onPickup increments a fetch objective by item id', () => {
        qs.addQuest(makeQuest({
            objectives: [{ id: 'o1', type: 'fetch', description: '', targetId: 'potion_01', required: 1, current: 0, completed: false }],
        }));
        qs.onPickup('potion_01');
        expect(qs.getQuests()[0].objectives[0].completed).toBe(true);
    });

    it('onPickup with wrong item id does not advance the objective', () => {
        qs.addQuest(makeQuest({
            objectives: [{ id: 'o1', type: 'fetch', description: '', targetId: 'potion_01', required: 1, current: 0, completed: false }],
        }));
        qs.onPickup('sword_01');
        expect(qs.getQuests()[0].objectives[0].current).toBe(0);
    });

    // ── talk objective ────────────────────────────────────────────────────────

    it('onTalk increments a talk objective', () => {
        qs.addQuest(makeQuest({
            objectives: [{ id: 'o1', type: 'talk', description: '', targetId: 'Elder', required: 1, current: 0, completed: false }],
        }));
        qs.onTalk('Elder');
        expect(qs.getQuests()[0].objectives[0].completed).toBe(true);
    });

    // ── quest completion ──────────────────────────────────────────────────────

    it('completes quest when all objectives are met', () => {
        qs.addQuest(makeQuest({
            objectives: [{ id: 'o1', type: 'kill', description: '', targetId: 'Guard', required: 1, current: 0, completed: false }],
        }));
        qs.onKill('Guard');
        expect(qs.getQuests()[0].isCompleted).toBe(true);
        expect(qs.getQuests()[0].isActive).toBe(false);
        expect(mockUI.showNotification).toHaveBeenCalledWith('Quest Complete: Test Quest!', 4000);
    });

    it('does not complete quest if only some objectives are met', () => {
        qs.addQuest(makeQuest({
            objectives: [
                { id: 'o1', type: 'kill', description: '', targetId: 'Guard', required: 1, current: 0, completed: false },
                { id: 'o2', type: 'fetch', description: '', targetId: 'potion', required: 1, current: 0, completed: false },
            ],
        }));
        qs.onKill('Guard');
        expect(qs.getQuests()[0].isCompleted).toBe(false);
    });

    it('does not advance objectives on a completed quest', () => {
        qs.addQuest(makeQuest({
            isCompleted: true,
            objectives: [{ id: 'o1', type: 'kill', description: '', targetId: 'Guard', required: 1, current: 0, completed: false }],
        }));
        qs.onKill('Guard');
        expect(qs.getQuests()[0].objectives[0].current).toBe(0);
    });

    // ── toggleQuestLog ────────────────────────────────────────────────────────

    it('toggleQuestLog opens and shows quests, closes on second press', () => {
        expect(qs.isLogOpen).toBe(false);
        qs.toggleQuestLog();
        expect(qs.isLogOpen).toBe(true);
        expect(mockUI.toggleQuestLog).toHaveBeenCalledWith(true);
        expect(mockUI.updateQuestLog).toHaveBeenCalled();
        qs.toggleQuestLog();
        expect(qs.isLogOpen).toBe(false);
        expect(mockUI.toggleQuestLog).toHaveBeenCalledWith(false);
    });

    // ── restoreState ──────────────────────────────────────────────────────────

    it('restoreState applies saved objective progress', () => {
        qs.addQuest(makeQuest({
            id: 'q1',
            objectives: [{ id: 'o1', type: 'kill', description: '', targetId: 'Guard', required: 2, current: 0, completed: false }],
        }));
        qs.restoreState([{
            id: 'q1',
            isCompleted: false,
            isActive: true,
            objectives: [{ id: 'o1', current: 1, completed: false }],
        }]);
        expect(qs.getQuests()[0].objectives[0].current).toBe(1);
    });

    it('restoreState marks quest as completed when loaded from a completed save', () => {
        qs.addQuest(makeQuest({
            id: 'q1',
            objectives: [{ id: 'o1', type: 'kill', description: '', targetId: 'Guard', required: 1, current: 0, completed: false }],
        }));
        qs.restoreState([{
            id: 'q1',
            isCompleted: true,
            isActive: false,
            objectives: [{ id: 'o1', current: 1, completed: true }],
        }]);
        expect(qs.getQuests()[0].isCompleted).toBe(true);
    });

    it('restoreState ignores unknown quest ids gracefully', () => {
        qs.addQuest(makeQuest({ id: 'q1' }));
        expect(() => qs.restoreState([{ id: 'unknown_quest', isCompleted: false, isActive: true, objectives: [] }])).not.toThrow();
    });

    // ── current cap ──────────────────────────────────────────────────────────

    it('objective current never exceeds required', () => {
        qs.addQuest(makeQuest({
            objectives: [{ id: 'o1', type: 'kill', description: '', targetId: 'Guard', required: 1, current: 0, completed: false }],
        }));
        qs.onKill('Guard');
        qs.onKill('Guard'); // extra kill after completion — should not overflow
        expect(qs.getQuests()[0].objectives[0].current).toBe(1);
    });
});
