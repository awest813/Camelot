import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/**
 * Procedural audio system using the Web Audio API.
 * Generates all sounds synthetically — no audio asset files required.
 * Toggle mute with M. Footsteps fire automatically when the player moves.
 */
export class AudioSystem {
  private _ctx: AudioContext;
  private _masterGain: GainNode;
  private _noiseBuffer: AudioBuffer;

  public isMuted: boolean = false;

  // Footstep state
  private _footstepTimer: number = 0;
  private static readonly _FOOTSTEP_INTERVAL = 0.42; // seconds between steps
  private static readonly _FOOTSTEP_MOVE_SQ = 0.001; // min squared movement to count as walking
  private _lastCamPos: Vector3 = Vector3.Zero();

  constructor() {
    // AudioContext is a browser global; fall back to the webkit-prefixed variant on older Safari
    const Ctx: typeof AudioContext =
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext ?? AudioContext;
    this._ctx = new Ctx();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 0.4;
    this._masterGain.connect(this._ctx.destination);

    // Pre-bake a 2-second white-noise buffer reused by all noise sounds
    this._noiseBuffer = this._buildNoiseBuffer(2);

    this._startAmbient();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    this._masterGain.gain.linearRampToValueAtTime(
      this.isMuted ? 0 : 0.4,
      this._ctx.currentTime + 0.05
    );
  }

  /**
   * Call once per frame. Plays a footstep sound at regular intervals
   * whenever the camera has moved more than the movement threshold.
   */
  public updateFootsteps(deltaTime: number, cameraPos: Vector3): void {
    const movedSq = Vector3.DistanceSquared(cameraPos, this._lastCamPos);
    this._lastCamPos.copyFrom(cameraPos);

    if (movedSq > AudioSystem._FOOTSTEP_MOVE_SQ) {
      this._footstepTimer -= deltaTime;
      if (this._footstepTimer <= 0) {
        this._playFootstep();
        this._footstepTimer = AudioSystem._FOOTSTEP_INTERVAL;
      }
    } else {
      // Reset so the very next step fires immediately on movement resumption
      this._footstepTimer = 0;
    }
  }

  /** Short thud + noise burst for a melee swing. */
  public playMeleeAttack(): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("sine", 130, 55, 0.28, 0.12, t);
    this._playNoiseBurst(0.18, 0.12, 1200, 3000, t);
  }

  /** Rising sawtooth whoosh for a magic cast. */
  public playMagicAttack(): void {
    this._resume();
    const t = this._ctx.currentTime;

    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.38);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(t);
    osc.stop(t + 0.52);

    // High shimmer overlay
    const osc2 = this._ctx.createOscillator();
    const gain2 = this._ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1400, t);
    osc2.frequency.exponentialRampToValueAtTime(2800, t + 0.3);
    gain2.gain.setValueAtTime(0.0001, t);
    gain2.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc2.connect(gain2);
    gain2.connect(this._masterGain);
    osc2.start(t);
    osc2.stop(t + 0.42);
  }

  /** Dull thud when the player takes a hit. */
  public playPlayerHit(): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("sine", 95, 48, 0.32, 0.18, t);
    this._playNoiseBurst(0.12, 0.15, 200, 900, t);
  }

  /** Descending tone when an NPC is defeated. */
  public playNPCDeath(): void {
    this._resume();
    const t = this._ctx.currentTime;
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.45);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(t);
    osc.stop(t + 0.47);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _resume(): void {
    if (this._ctx.state === "suspended") {
      this._ctx.resume();
    }
  }

  private _playFootstep(): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("sine", 82, 42, 0.24, 0.1, t);
    this._playNoiseBurst(0.07, 0.08, 300, 1100, t);
  }

  /** Sweep a single oscillator frequency and amplitude over `duration` seconds. */
  private _playTone(
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    gainPeak: number,
    duration: number,
    t: number
  ): void {
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  /** Play a bandpass-filtered burst from the pre-baked noise buffer. */
  private _playNoiseBurst(
    gainPeak: number,
    duration: number,
    freqLow: number,
    freqHigh: number,
    t: number
  ): void {
    const source = this._ctx.createBufferSource();
    source.buffer = this._noiseBuffer;

    const filter = this._ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = (freqLow + freqHigh) / 2;
    filter.Q.value = 0.8;

    const gain = this._ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);
    source.start(t);
    source.stop(t + duration + 0.01);
  }

  /** Create a looping low-pass-filtered noise ambient wind layer. */
  private _startAmbient(): void {
    const source = this._ctx.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.loop = true;

    const filter = this._ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;

    const ambGain = this._ctx.createGain();
    ambGain.gain.value = 0.05;

    source.connect(filter);
    filter.connect(ambGain);
    ambGain.connect(this._masterGain);
    source.start();
  }

  /** Build a mono white-noise AudioBuffer of the given duration in seconds. */
  private _buildNoiseBuffer(durationSeconds: number): AudioBuffer {
    const rate = this._ctx.sampleRate;
    const length = Math.ceil(rate * durationSeconds);
    const buffer = this._ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
