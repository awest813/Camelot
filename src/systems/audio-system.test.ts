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
});
