import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { cosmeticRng } from "../core/rng/rng";
import type { GameEventBus } from "./event-bus";

/** How the player is moving, for the footsteps. */
export interface Gait {
  /** On a horse: hoofbeats, a longer stride. */
  mounted?: boolean;
  /** Crouched: soft steps. */
  crouching?: boolean;
  /** Feet off the ground (swimming, flying in the editor): no steps. */
  airborne?: boolean;
}

/** Metres per step: a walker's stride, a horse's. */
const FOOT_STRIDE = 1.6;
const HOOF_STRIDE = 2.4;
/** Faster than this (m/s) is a teleport (fast travel, a load), not a step. */
const MAX_STEP_SPEED = 60;

/**
 * Procedural audio system using the Web Audio API.
 * Generates all sounds synthetically — no audio asset files required.
 * Mute with F7.  Footsteps keep pace with how fast the player moves (and
 * turn to hoofbeats on a horse); the game's events are given voices
 * (`listen`); the ambience follows the weather, the night and the roof
 * over your head.
 */
export class AudioSystem {
  private _ctx: AudioContext;
  private _masterGain: GainNode;
  private _noiseBuffer: AudioBuffer;

  private _masterVolume: number = 0.4;

  public isMuted: boolean = false;

  // Footstep state: metres walked since the last step.
  private _stepDistance = Number.POSITIVE_INFINITY; // the first step sounds at once
  private _lastCamPos: Vector3 | null = null;

  // Ambience: wind always, rain in rain and storms, crickets at night; muffled indoors.
  private _windGain: GainNode | null = null;
  private _rainGain: GainNode | null = null;
  private _cricketGain: GainNode | null = null;
  private _weather = "clear";
  private _night = false;
  private _indoors = false;
  private _thunderIn = 30;
  private _chirpIn = 1;

  constructor() {
    // AudioContext is a browser global; fall back to the webkit-prefixed variant on older Safari
    const Ctx: typeof AudioContext =
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext ?? AudioContext;
    this._ctx = new Ctx();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._masterVolume;
    this._masterGain.connect(this._ctx.destination);

    // Pre-bake a 2-second white-noise buffer reused by all noise sounds
    this._noiseBuffer = this._buildNoiseBuffer(2);

    this._startAmbient();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  public get masterVolume(): number {
    return this._masterVolume;
  }

  public setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._masterVolume = clamped;
    if (!this.isMuted) {
      this._masterGain.gain.linearRampToValueAtTime(
        clamped,
        this._ctx.currentTime + 0.05
      );
    }
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    this._masterGain.gain.linearRampToValueAtTime(
      this.isMuted ? 0 : this._masterVolume,
      this._ctx.currentTime + 0.05
    );
  }

  /**
   * Call every gameplay step.  A step sounds each stride of ground covered
   * (so sprinting quickens them and a horse's are hoofbeats); the ambience's
   * own timers (thunder, crickets) run here too.
   */
  public updateFootsteps(deltaTime: number, cameraPos: Vector3, gait: Gait = {}): void {
    this._tickAmbience(deltaTime);
    const last = this._lastCamPos;
    if (!last) { this._lastCamPos = cameraPos.clone(); return; }
    const dx = cameraPos.x - last.x, dz = cameraPos.z - last.z;
    last.copyFrom(cameraPos);
    if (deltaTime <= 0) return;
    const moved = Math.sqrt(dx * dx + dz * dz);
    if (gait.airborne || moved / deltaTime > MAX_STEP_SPEED || moved < 0.002) {
      // Standing, swimming or teleported: the next real step sounds at once.
      this._stepDistance = Number.POSITIVE_INFINITY;
      return;
    }
    this._stepDistance += moved;
    const stride = gait.mounted ? HOOF_STRIDE : FOOT_STRIDE;
    if (this._stepDistance < stride) return;
    this._stepDistance = Number.isFinite(this._stepDistance) ? this._stepDistance - stride : 0;
    if (gait.mounted) this._playHoof();
    else this._playFootstep(gait.crouching ? 0.45 : 1);
  }

  /**
   * Give the game's events their sounds: spells, blows and blocks, coin and
   * loot, level-ups and quests, doors, water, drink and food, being seen,
   * dying; and the weather, the night and the indoors set the ambience.
   */
  public listen(bus: GameEventBus): () => void {
    const offs = [
      bus.on("spell:cast", ({ heal, effect }) => { if (heal || effect === "ward" || effect === "unseen" || effect === "water_breathing") this.playHealCast(); else this.playMagicAttack(); }),
      bus.on("mark:recalled", () => this.playMagicAttack()),
      bus.on("combat:blocked", () => this.playBlock()),
      bus.on("combat:weaponHit", ({ powerAttack }) => this.playImpact(powerAttack)),
      bus.on("loot:pickedUp", ({ itemId }) => (itemId === "gold_coins" ? this.playCoins() : this.playPickup())),
      bus.on("container:plundered", () => this.playPickup()),
      bus.on("barter:transaction", () => this.playCoins()),
      bus.on("player:levelUp", () => this.playFanfare()),
      bus.on("quest:completed", () => this.playFanfare()),
      bus.on("skill:levelUp", () => this.playChime([660, 880])),
      bus.on("achievement:unlocked", () => this.playChime([523, 784, 1047])),
      bus.on("location:discovered", () => this.playChime([392, 523, 659])),
      bus.on("portal:entered", () => this.playDoor()),
      bus.on("cell:changed", ({ cellId }) => this._setIndoors(cellId !== "exterior")),
      bus.on("swim:entered", () => this.playSplash()),
      bus.on("swim:exited", () => this.playSplash(0.5)),
      bus.on("swim:breathLow", () => this.playBubbles()),
      bus.on("item:consumed", () => this.playGulp()),
      bus.on("stealth:detected", () => this.playAlert()),
      bus.on("player:died", () => this.playKnell()),
      bus.on("weather:changed", ({ state }) => { this._weather = state; this._mixAmbience(); }),
      bus.on("time:hour", ({ hour }) => { this._night = hour >= 21 || hour < 5; this._mixAmbience(); }),
    ];
    return () => { for (const off of offs) off(); };
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

  /** A soft rising chime for a healing or restoring spell. */
  public playHealCast(): void {
    this._resume();
    const t = this._ctx.currentTime;
    [523, 659, 784].forEach((f, i) => this._playTone("sine", f, f * 1.01, 0.09, 0.6, t + i * 0.07));
    this._playNoiseBurst(0.03, 0.5, 4000, 9000, t);
  }

  /** Steel on steel: a block (bright ring over a knock). */
  public playBlock(): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("triangle", 1250, 1180, 0.16, 0.35, t);
    this._playTone("sine", 1870, 1800, 0.07, 0.25, t);
    this._playNoiseBurst(0.2, 0.06, 2500, 6000, t);
  }

  /** A blow that lands (heavier for a power attack). */
  public playImpact(power = false): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("sine", power ? 110 : 160, 50, power ? 0.38 : 0.26, power ? 0.2 : 0.12, t);
    this._playNoiseBurst(power ? 0.22 : 0.14, 0.09, 600, 2400, t);
  }

  /** A bowstring loosed: a taut twang and the arrow's hiss. */
  public playBowShot(): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("triangle", 190, 120, 0.2, 0.18, t);
    this._playNoiseBurst(0.08, 0.3, 3000, 7000, t + 0.02);
  }

  /** Something taken up: a quick soft knock. */
  public playPickup(): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("sine", 420, 300, 0.12, 0.08, t);
  }

  /** Coins: a few bright clinks. */
  public playCoins(): void {
    this._resume();
    const t = this._ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const f = 2600 + cosmeticRng.next() * 1400;
      this._playTone("triangle", f, f * 0.97, 0.06, 0.12, t + i * 0.045 + cosmeticRng.next() * 0.02);
    }
  }

  /** A short rising chime (a skill risen, a place found, a deed recorded). */
  public playChime(freqs: readonly number[]): void {
    this._resume();
    const t = this._ctx.currentTime;
    freqs.forEach((f, i) => this._playTone("sine", f, f, 0.1, 0.5, t + i * 0.09));
  }

  /** A little fanfare: a level gained, a quest done. */
  public playFanfare(): void {
    this._resume();
    const t = this._ctx.currentTime;
    const notes: Array<[number, number]> = [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36], [1047, 0.5]];
    for (const [f, at] of notes) {
      this._playTone("triangle", f, f, 0.12, at === 0.5 ? 0.9 : 0.22, t + at);
      this._playTone("sine", f * 2, f * 2, 0.03, 0.2, t + at);
    }
  }

  /** A heavy door or passage: a low thud and a scrape. */
  public playDoor(): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("sine", 70, 40, 0.35, 0.3, t);
    this._playNoiseBurst(0.1, 0.35, 150, 700, t + 0.05);
  }

  /** Into (or out of) water. */
  public playSplash(scale = 1): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playNoiseBurst(0.25 * scale, 0.45, 500, 3500, t);
    this._playTone("sine", 300, 90, 0.08 * scale, 0.3, t);
  }

  /** Breath running short: a few rising bubbles. */
  public playBubbles(): void {
    this._resume();
    const t = this._ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const f = 500 + cosmeticRng.next() * 500;
      this._playTone("sine", f, f * 2.2, 0.07, 0.08, t + i * 0.11);
    }
  }

  /** A draught drunk or a bite eaten. */
  public playGulp(): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("sine", 240, 140, 0.16, 0.1, t);
    this._playTone("sine", 220, 120, 0.12, 0.1, t + 0.16);
  }

  /** Seen: a sharp, rising sting. */
  public playAlert(): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("sawtooth", 330, 660, 0.07, 0.25, t);
    this._playTone("sine", 990, 1320, 0.05, 0.2, t + 0.05);
  }

  /** Fallen: a slow, low bell. */
  public playKnell(): void {
    this._resume();
    const t = this._ctx.currentTime;
    this._playTone("sine", 110, 104, 0.3, 2.5, t);
    this._playTone("sine", 277, 270, 0.09, 1.8, t);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _resume(): void {
    if (this._ctx.state === "suspended") {
      this._ctx.resume();
    }
  }

  private _playFootstep(scale = 1): void {
    this._resume();
    const t = this._ctx.currentTime;
    // A little variety, step to step.
    const v = 0.85 + cosmeticRng.next() * 0.3;
    this._playTone("sine", 82 * v, 42 * v, 0.24 * scale, 0.1, t);
    this._playNoiseBurst(0.07 * scale, 0.08, 300 * v, 1100 * v, t);
  }

  /** A hoofbeat: two quick knocks, hollow and dull. */
  private _playHoof(): void {
    this._resume();
    const t = this._ctx.currentTime;
    const v = 0.9 + cosmeticRng.next() * 0.2;
    this._playTone("sine", 140 * v, 60, 0.26, 0.07, t);
    this._playTone("sine", 120 * v, 55, 0.2, 0.07, t + 0.09);
    this._playNoiseBurst(0.06, 0.06, 400, 1500, t);
  }

  /** Thunder now and then in a storm; crickets' chirps on a dry night outdoors. */
  private _tickAmbience(dt: number): void {
    if (this._indoors) return;
    if (this._weather === "storm") {
      this._thunderIn -= dt;
      if (this._thunderIn <= 0) {
        this._thunderIn = 15 + cosmeticRng.next() * 35;
        this._playThunder();
      }
    }
    if (this._night && this._weather !== "rain" && this._weather !== "storm") {
      this._chirpIn -= dt;
      if (this._chirpIn <= 0) {
        this._chirpIn = 0.6 + cosmeticRng.next() * 1.6;
        const t = this._ctx.currentTime;
        const f = 4200 + cosmeticRng.next() * 600;
        for (let i = 0; i < 3; i++) this._playTone("sine", f, f, 0.012, 0.03, t + i * 0.05, this._cricketGain);
      }
    }
  }

  private _playThunder(): void {
    const t = this._ctx.currentTime;
    this._playNoiseBurst(0.3, 3.2, 40, 260, t);
    this._playTone("sine", 55, 30, 0.25, 2.5, t + 0.1);
  }

  private _setIndoors(indoors: boolean): void {
    this._indoors = indoors;
    this._mixAmbience();
  }

  /** The ambience's levels for the weather, the night and the roof (indoors it is near silent). */
  private _mixAmbience(): void {
    const roof = this._indoors ? 0.15 : 1;
    const wind = { clear: 0.05, overcast: 0.06, foggy: 0.035, rain: 0.07, storm: 0.11 }[this._weather] ?? 0.05;
    const rain = { rain: 0.09, storm: 0.15 }[this._weather] ?? 0;
    const at = this._ctx.currentTime + 2;
    this._windGain?.gain.linearRampToValueAtTime(wind * roof, at);
    this._rainGain?.gain.linearRampToValueAtTime(rain * roof, at);
    this._cricketGain?.gain.linearRampToValueAtTime(this._night && !this._indoors ? 1 : 0, at);
  }

  /** Sweep a single oscillator frequency and amplitude over `duration` seconds (into `out`, else the master). */
  private _playTone(
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    gainPeak: number,
    duration: number,
    t: number,
    out: GainNode | null = null,
  ): void {
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(out ?? this._masterGain);
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

  /** The ambience's beds: wind (low-passed noise), rain (band-passed hiss), and a send for crickets. */
  private _startAmbient(): void {
    this._windGain = this._noiseBed("lowpass", 280, 0.05);
    this._rainGain = this._noiseBed("bandpass", 3200, 0);
    this._cricketGain = this._ctx.createGain();
    this._cricketGain.gain.value = 0;
    this._cricketGain.connect(this._masterGain);
  }

  /** A looping filtered-noise layer at `level`; its gain, to mix. */
  private _noiseBed(type: BiquadFilterType, frequency: number, level: number): GainNode {
    const source = this._ctx.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.loop = true;
    const filter = this._ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = type === "bandpass" ? 0.5 : filter.Q.value;
    const gain = this._ctx.createGain();
    gain.gain.value = level;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);
    source.start();
    return gain;
  }

  /** Build a mono white-noise AudioBuffer of the given duration in seconds. */
  private _buildNoiseBuffer(durationSeconds: number): AudioBuffer {
    const rate = this._ctx.sampleRate;
    const length = Math.ceil(rate * durationSeconds);
    const buffer = this._ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = cosmeticRng.next() * 2 - 1;
    }
    return buffer;
  }
}
