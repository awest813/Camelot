import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioSystem } from './audio-system';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ── Mock Web Audio API ───────────────────────────────────────────────────────

function makeGainNode() {
    return {
        gain: {
            value: 1,
            linearRampToValueAtTime: vi.fn(),
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn().mockReturnThis(),
    };
}

function makeOscillator() {
    return {
        type: 'sine',
        frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
    };
}

function makeBufferSource() {
    return {
        buffer: null as AudioBuffer | null,
        loop: false,
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
    };
}

function makeBiquadFilter() {
    return {
        type: 'lowpass' as BiquadFilterType,
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: vi.fn().mockReturnThis(),
    };
}

const mockAudioBuffer: AudioBuffer = {
    sampleRate: 44100,
    length: 88200,
    duration: 2,
    numberOfChannels: 1,
    getChannelData: vi.fn(() => new Float32Array(88200)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
};

const mockCtx = {
    state: 'running' as AudioContextState,
    sampleRate: 44100,
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    createGain: vi.fn(makeGainNode),
    createOscillator: vi.fn(makeOscillator),
    createBufferSource: vi.fn(makeBufferSource),
    createBiquadFilter: vi.fn(makeBiquadFilter),
    createBuffer: vi.fn(() => mockAudioBuffer),
    resume: vi.fn().mockResolvedValue(undefined),
};

// Must be a regular function (not arrow) so it can be used with `new`
vi.stubGlobal('AudioContext', vi.fn(function() { return mockCtx; }));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AudioSystem', () => {
    let audio: AudioSystem;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCtx.state = 'running';
        audio = new AudioSystem();
    });

    it('initialises without throwing', () => {
        expect(audio).toBeDefined();
        expect(audio.isMuted).toBe(false);
    });

    it('toggleMute sets isMuted and ramps the master gain', () => {
        expect(audio.isMuted).toBe(false);
        audio.toggleMute();
        expect(audio.isMuted).toBe(true);
        // Gain should ramp to 0
        const masterGain = mockCtx.createGain.mock.results[0].value;
        expect(masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));

        audio.toggleMute();
        expect(audio.isMuted).toBe(false);
        // Gain should ramp back up
        expect(masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.4, expect.any(Number));
    });

    it('updateFootsteps does not play when player is stationary', () => {
        const pos = new Vector3(5, 0, 5);
        // First call seeds the baseline position (may detect movement from Vector3.Zero)
        audio.updateFootsteps(0.016, pos);
        // From here the position is unchanged — no additional oscillators should be created
        const createOscBefore = mockCtx.createOscillator.mock.calls.length;
        audio.updateFootsteps(0.016, pos);
        audio.updateFootsteps(0.016, pos);
        audio.updateFootsteps(0.016, pos);
        expect(mockCtx.createOscillator.mock.calls.length).toBe(createOscBefore);
    });

    it('updateFootsteps plays a footstep when the player moves enough', () => {
        const pos1 = new Vector3(0, 0, 0);
        const pos2 = new Vector3(0, 0, 5);
        const createOscBefore = mockCtx.createOscillator.mock.calls.length;

        // First call establishes the baseline position
        audio.updateFootsteps(0.016, pos1);
        // Second call detects movement — timer starts at 0 so a step fires immediately
        audio.updateFootsteps(0.5, pos2);

        expect(mockCtx.createOscillator.mock.calls.length).toBeGreaterThan(createOscBefore);
    });

    it('updateFootsteps resets the timer when the player stops', () => {
        const moving = new Vector3(0, 0, 5);
        const still = new Vector3(0, 0, 5);

        audio.updateFootsteps(0.016, new Vector3(0, 0, 0));
        audio.updateFootsteps(0.5, moving); // step fires

        const oscCountAfterStep = mockCtx.createOscillator.mock.calls.length;

        // Player stands still for a long time — should NOT fire extra steps
        for (let i = 0; i < 50; i++) {
            audio.updateFootsteps(0.016, still);
        }
        expect(mockCtx.createOscillator.mock.calls.length).toBe(oscCountAfterStep);
    });

    it('steps keep pace with the ground covered: a sprint quickens them, a horse makes hoofbeats', () => {
        const step = (_from: number, to: number, dt: number, gait = {}) => {
            const before = mockCtx.createOscillator.mock.calls.length;
            audio.updateFootsteps(dt, new Vector3(0, 0, to), gait);
            return mockCtx.createOscillator.mock.calls.length - before;
        };
        audio.updateFootsteps(0.016, new Vector3(0, 0, 0));
        expect(step(0, 0.5, 0.1), 'the first step sounds at once').toBeGreaterThan(0);
        expect(step(0.5, 1.0, 0.1), 'half a stride on: silent').toBe(0);
        expect(step(1.0, 2.2, 0.1), 'a stride covered: a step').toBeGreaterThan(0);
        // Mounted: two knocks per hoofbeat, every 2.4 m.
        expect(step(2.2, 5.0, 0.1, { mounted: true })).toBe(2);
        // Swimming or flying: nothing.
        expect(step(5, 9, 0.1, { airborne: true })).toBe(0);
        // A teleport isn't a step.
        expect(step(9, 900, 0.016)).toBe(0);
    });

    it('voices the game\'s events through listen(), and stops when unsubscribed', () => {
        const handlers = new Map<string, Array<(p: unknown) => void>>();
        const bus = {
            on: (name: string, fn: (p: unknown) => void) => {
                handlers.set(name, [...(handlers.get(name) ?? []), fn]);
                return () => handlers.set(name, (handlers.get(name) ?? []).filter((f) => f !== fn));
            },
        };
        const off = audio.listen(bus as never);
        const sounds = (name: string, payload: unknown = {}) => {
            const before = mockCtx.createOscillator.mock.calls.length;
            for (const fn of handlers.get(name) ?? []) fn(payload);
            return mockCtx.createOscillator.mock.calls.length - before;
        };
        for (const e of ['spell:cast', 'combat:blocked', 'loot:pickedUp', 'player:levelUp', 'quest:completed', 'portal:entered', 'item:consumed', 'stealth:detected']) {
            expect(sounds(e, { itemId: 'gold_coins' }), e).toBeGreaterThan(0);
        }
        off();
        expect(sounds('combat:blocked')).toBe(0);
    });

    it('a storm brings thunder, outdoors; indoors the weather is near silent', () => {
        const handlers = new Map<string, (p: unknown) => void>();
        audio.listen({ on: (n: string, fn: (p: unknown) => void) => { handlers.set(n, fn); return () => {}; } } as never);
        handlers.get('weather:changed')!({ state: 'storm' });
        const before = mockCtx.createBufferSource.mock.calls.length;
        for (let i = 0; i < 70 * 60; i++) audio.updateFootsteps(1 / 60, new Vector3(0, 0, 0));
        expect(mockCtx.createBufferSource.mock.calls.length, 'a thunderclap within 70 s').toBeGreaterThan(before);
        handlers.get('cell:changed')!({ cellId: 'cave_01', cellName: 'Old Cave' });
        const inside = mockCtx.createBufferSource.mock.calls.length;
        for (let i = 0; i < 70 * 60; i++) audio.updateFootsteps(1 / 60, new Vector3(0, 0, 0));
        expect(mockCtx.createBufferSource.mock.calls.length, 'no thunder in the cave').toBe(inside);
    });

    it('playMeleeAttack creates oscillator and buffer source nodes', () => {
        const oscBefore = mockCtx.createOscillator.mock.calls.length;
        const srcBefore = mockCtx.createBufferSource.mock.calls.length;
        audio.playMeleeAttack();
        expect(mockCtx.createOscillator.mock.calls.length).toBeGreaterThan(oscBefore);
        expect(mockCtx.createBufferSource.mock.calls.length).toBeGreaterThan(srcBefore);
    });

    it('playMagicAttack creates multiple oscillators for the whoosh + shimmer', () => {
        const oscBefore = mockCtx.createOscillator.mock.calls.length;
        audio.playMagicAttack();
        expect(mockCtx.createOscillator.mock.calls.length).toBeGreaterThanOrEqual(oscBefore + 2);
    });

    it('playPlayerHit creates oscillator and buffer source nodes', () => {
        const oscBefore = mockCtx.createOscillator.mock.calls.length;
        const srcBefore = mockCtx.createBufferSource.mock.calls.length;
        audio.playPlayerHit();
        expect(mockCtx.createOscillator.mock.calls.length).toBeGreaterThan(oscBefore);
        expect(mockCtx.createBufferSource.mock.calls.length).toBeGreaterThan(srcBefore);
    });

    it('playNPCDeath creates an oscillator that sweeps downward', () => {
        const oscBefore = mockCtx.createOscillator.mock.calls.length;
        audio.playNPCDeath();
        const newOscs = mockCtx.createOscillator.mock.results.slice(oscBefore);
        expect(newOscs.length).toBeGreaterThan(0);
        const osc = newOscs[0].value;
        // Should schedule a downward frequency ramp
        expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
            75,
            expect.any(Number)
        );
    });

    it('resumes a suspended AudioContext before playing sounds', () => {
        mockCtx.state = 'suspended';
        audio.playMeleeAttack();
        expect(mockCtx.resume).toHaveBeenCalled();
    });

    it('setMasterVolume updates volume and clamps values within [0, 1]', () => {
        audio.setMasterVolume(0.8);
        expect(audio.masterVolume).toBe(0.8);

        audio.setMasterVolume(1.5);
        expect(audio.masterVolume).toBe(1.0);

        audio.setMasterVolume(-0.2);
        expect(audio.masterVolume).toBe(0.0);
    });
});
