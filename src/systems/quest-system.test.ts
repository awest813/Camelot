import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestSystem } from './quest-system';
import { QuestGraphEngine } from '../framework/quests/quest-graph-engine';

const engineWith = () => new QuestGraphEngine([
    {
        id: 'quest_kill_guard', name: 'Eliminate the Guard', description: 'Defeat him.', xpReward: 100, rewardGold: 20,
        nodes: [{ id: 'obj_kill_guard', description: 'Defeat the Guard', triggerType: 'kill', targetId: 'Guard', requiredCount: 1 }],
    },
    {
        id: 'chain', name: 'Chain', startNodeIds: ['a'], nodes: [
            { id: 'a', description: 'First', triggerType: 'talk', targetId: 'Elder', requiredCount: 1, nextNodeIds: ['b'] },
            { id: 'b', description: 'Second', triggerType: 'pickup', targetId: 'token', requiredCount: 2 },
        ],
    },
    { id: 'never', name: 'Not started', nodes: [{ id: 'x', description: 'x', triggerType: 'kill', targetId: 'X', requiredCount: 1 }] },
]);

describe('QuestSystem (the quest log)', () => {
    let qs: QuestSystem;
    let ui: { showNotification: ReturnType<typeof vi.fn>; toggleQuestLog: ReturnType<typeof vi.fn>; updateQuestLog: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        ui = { showNotification: vi.fn(), toggleQuestLog: vi.fn(), updateQuestLog: vi.fn() };
        qs = new QuestSystem(ui as never);
    });

    it('shows started framework quests as entries built from the engine', () => {
        const engine = engineWith();
        qs.setFramework(() => engine);
        expect(qs.getQuests(), 'nothing started yet').toEqual([]);
        engine.activateQuest('quest_kill_guard');
        engine.activateQuest('chain');
        const [guard, chain] = qs.getQuests();
        expect(guard).toMatchObject({ id: 'quest_kill_guard', name: 'Eliminate the Guard', isActive: true, reward: '100 XP, 20 gold' });
        expect(guard.objectives).toEqual([expect.objectContaining({ id: 'obj_kill_guard', type: 'kill', current: 0, required: 1 })]);
        expect(chain.objectives.map((o) => o.id), 'only reached nodes show').toEqual(['a']);

        engine.applyEvent({ type: 'talk', targetId: 'Elder' });
        engine.applyEvent({ type: 'pickup', targetId: 'token' });
        const after = qs.getQuests().find((q) => q.id === 'chain')!;
        expect(after.objectives.map((o) => [o.id, o.type, o.current, o.completed])).toEqual([['a', 'talk', 1, true], ['b', 'fetch', 1, false]]);

        engine.applyEvent({ type: 'kill', targetId: 'Guard' });
        expect(qs.getCompletedQuests().map((q) => q.id)).toEqual(['quest_kill_guard']);
        engine.failQuest('chain');
        expect(qs.getFailedQuests().map((q) => q.id)).toEqual(['chain']);
        expect(qs.getActiveQuests()).toEqual([]);
    });

    it('toggleQuestLog opens with every quest and redraws on refresh; closes on second press', () => {
        const engine = engineWith();
        qs.setFramework(() => engine);
        engine.activateQuest('quest_kill_guard');
        qs.toggleQuestLog();
        expect(ui.toggleQuestLog).toHaveBeenCalledWith(true);
        expect(ui.updateQuestLog).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'quest_kill_guard' })]);
        qs.refresh();
        expect(ui.updateQuestLog).toHaveBeenCalledTimes(2);
        qs.toggleQuestLog();
        expect(ui.toggleQuestLog).toHaveBeenLastCalledWith(false);
        qs.refresh();
        expect(ui.updateQuestLog, 'no redraw while closed').toHaveBeenCalledTimes(2);
    });

    it('restoreState drops legacy entries the engine does not own (old job entries)', () => {
        const engine = engineWith();
        qs.setFramework(() => engine);
        expect(() => qs.restoreState([{ id: 'job_inn_1_0', isCompleted: false, isActive: true, objectives: [] }])).not.toThrow();
        expect(qs.getQuests()).toEqual([]);
    });

    it('carries old-save progress for quests the engine now owns into the engine', () => {
        const engine = engineWith();
        qs.setFramework(() => engine);
        engine.activateQuest('quest_kill_guard');
        qs.restoreState([{ id: 'quest_kill_guard', isCompleted: true, isActive: false, objectives: [{ id: 'obj_kill_guard', current: 1, completed: true }] }]);
        expect(engine.getQuestStatus('quest_kill_guard')).toBe('completed');
        expect(qs.getCompletedQuests().map((q) => q.id)).toEqual(['quest_kill_guard']);

        const fresh = engineWith();
        qs.setFramework(() => fresh);
        qs.restoreState([{ id: 'quest_kill_guard', isCompleted: false, isActive: true, isFailed: true, objectives: [{ id: 'obj_kill_guard', current: 0, completed: false }] }]);
        expect(fresh.getQuestStatus('quest_kill_guard')).toBe('failed');
        expect(fresh.getQuestState('quest_kill_guard')!.nodes.obj_kill_guard).toMatchObject({ failed: true, active: false });
    });
});
