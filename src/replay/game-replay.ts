/**
 * Whole-game replays: record a play session (the character made at the
 * start, then every input at the frame it arrived) and play it back on a
 * fresh page to the same state.
 *
 * Open the game with `?replay=record` to record, or `?replay=play` with a
 * log in localStorage (`camelot_replay_log`) to play one back.  Either way
 * the game runs in deterministic mode:
 *  - frames are a fixed 16 ms step (physics, animation, the game's own
 *    clock), driven here instead of by the render loop;
 *  - timers in game code fire on frames (`simClock`), and async results
 *    that change the game (navmesh builds, models) land between frames in
 *    the order the work began (`asyncWork`);
 *  - input is caught before the game sees it and dispatched at the next
 *    frame boundary, the same way the replay dispatches it;
 *  - panel animations are off (they end on the wall clock).
 * With all random rolls drawn from the seeded kernel streams, the same log
 * gives the same game.  `digest()` reads the state the check compares.
 *
 * The page's handle is `window.__camelotReplay`.
 */
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";
import { simClock } from "../core/sim-clock";
import { asyncWork } from "../core/async-work";
import { CharacterCreationUI, type CharacterCreationResult } from "../ui/character-creation-ui";
import { WorldSeed, type WorldGenOptions } from "../world/world-seed";
import { applyPrefs, loadPrefs } from "../ui/accessibility";
import type { Game } from "../game";

export type ReplayMode = "record" | "play";

/** The fixed frame step (Babylon's constant animation step). */
export const STEP_MS = 16;
export const REPLAY_LOG_KEY = "camelot_replay_log";

/** The character made at the start, with its world seed as data. */
export interface ReplayChoice extends Omit<CharacterCreationResult, "worldSeed"> {
  worldSeed: { seed: string; options: WorldGenOptions } | null;
}

/** One input, at the frame boundary it is dispatched on. */
export type ReplayInput =
  | { f: number; target: string; type: string; init: Record<string, unknown> }
  | { f: number; target: string; type: "input" | "change"; value: string; checked?: boolean }
  | { f: number; lock: boolean };

export interface GameReplayLog {
  version: 1;
  kind: "camelot-game";
  stepMs: number;
  choice: ReplayChoice;
  /** Frames the session ran. */
  frames: number;
  inputs: ReplayInput[];
}

const KEY_EVENTS = ["keydown", "keyup"];
const POINTER_EVENTS = ["pointerdown", "pointermove", "pointerup", "pointercancel"];
const MOUSE_EVENTS = ["mousedown", "mousemove", "mouseup", "click", "dblclick", "contextmenu", "wheel"];
// (Focus and blur aren't input: they follow from clicks and the game's own focus() calls.)
const INTERCEPTED = [...KEY_EVENTS, ...POINTER_EVENTS, ...MOUSE_EVENTS];

const MOUSE_FIELDS = ["clientX", "clientY", "screenX", "screenY", "movementX", "movementY", "button", "buttons", "detail",
  "ctrlKey", "shiftKey", "altKey", "metaKey"] as const;
const POINTER_FIELDS = ["pointerId", "pointerType", "isPrimary", "width", "height", "pressure"] as const;
const WHEEL_FIELDS = ["deltaX", "deltaY", "deltaZ", "deltaMode"] as const;
const KEY_FIELDS = ["key", "code", "location", "repeat", "ctrlKey", "shiftKey", "altKey", "metaKey", "keyCode", "which", "charCode"] as const;

/** Form controls keep their real events (typing, toggling); their value changes are logged instead. */
function isFormControl(el: EventTarget | null): el is HTMLElement {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|OPTION|LABEL)$/.test(el.tagName));
}

/** A path that finds the same element on a fresh page. */
export function targetPath(t: EventTarget | null, canvas: HTMLCanvasElement): string {
  if (t === window) return "window";
  if (t === document) return "document";
  if (t === canvas) return "canvas";
  if (!(t instanceof Element)) return "document";
  if (t === document.body) return "body";
  if (t === document.documentElement) return "html";
  const parts: string[] = [];
  for (let el: Element | null = t; el && el !== document.body; el = el.parentElement) {
    if (el.id) { parts.unshift(`#${CSS.escape(el.id)}`); break; }
    const parent: Element | null = el.parentElement;
    const n = parent ? Array.prototype.indexOf.call(parent.children, el) + 1 : 1;
    parts.unshift(`${el.tagName.toLowerCase()}:nth-child(${n})`);
    if (!parent) break;
  }
  return parts[0]?.startsWith("#") ? parts.join(" > ") : `body > ${parts.join(" > ")}`;
}

function resolveTarget(path: string, canvas: HTMLCanvasElement): EventTarget | null {
  switch (path) {
    case "window": return window;
    case "document": return document;
    case "canvas": return canvas;
    case "body": return document.body;
    case "html": return document.documentElement;
    default: return document.querySelector(path);
  }
}

function pickFields(e: Event, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f] = (e as unknown as Record<string, unknown>)[f];
  return out;
}

function captureInit(e: Event): Record<string, unknown> {
  if (e instanceof KeyboardEvent) return pickFields(e, KEY_FIELDS);
  const init = pickFields(e, MOUSE_FIELDS);
  if (e instanceof PointerEvent) Object.assign(init, pickFields(e, POINTER_FIELDS));
  if (e instanceof WheelEvent) Object.assign(init, pickFields(e, WHEEL_FIELDS));
  return init;
}

/** A synthetic copy of a recorded event (keyCode and which included, which Babylon reads). */
export function makeEvent(type: string, init: Record<string, unknown>): Event {
  const base = { bubbles: true, cancelable: true, composed: true };
  if (KEY_EVENTS.includes(type)) {
    const ev = new KeyboardEvent(type, { ...base, ...(init as KeyboardEventInit) });
    for (const f of ["keyCode", "which", "charCode"]) Object.defineProperty(ev, f, { value: init[f] ?? 0 });
    return ev;
  }
  if (type === "wheel") return new WheelEvent(type, { ...base, ...(init as WheelEventInit) });
  if (POINTER_EVENTS.includes(type)) return new PointerEvent(type, { ...base, ...(init as PointerEventInit) });
  return new MouseEvent(type, { ...base, ...(init as MouseEventInit) });
}

function serializeChoice(c: CharacterCreationResult): ReplayChoice {
  return { ...c, worldSeed: c.worldSeed ? { seed: c.worldSeed.seedString, options: { ...c.worldSeed.options } } : null };
}

function restoreChoice(c: ReplayChoice): CharacterCreationResult {
  let seed: WorldSeed | null = null;
  if (c.worldSeed) {
    // The creation screen passes an all-digits seed as a number.
    const s = c.worldSeed.seed;
    const arg = /^\d+$/.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : s;
    seed = new WorldSeed(arg, c.worldSeed.options);
  }
  return { ...c, worldSeed: seed };
}

/** The state a replay must reproduce: the player, the clock, the bag, quests, every NPC, the random streams. */
export function gameDigest(g: Game): Record<string, unknown> {
  const cam = g.player.camera;
  return {
    player: {
      position: cam.position.asArray(), rotation: [cam.rotation.x, cam.rotation.y],
      health: g.player.health, magicka: g.player.magicka, stamina: g.player.stamina, level: g.player.level,
    },
    gold: g._pack.gold(),
    clock: g.timeSystem.elapsedGameTime,
    inventory: g.inventorySystem.items.map((i) => `${i.id}×${i.quantity}`).sort(),
    quests: g.frameworkRuntime.questEngine.getSnapshot().quests,
    npcs: g.scheduleSystem.npcs.map((n) => ({
      key: n.key, position: n.mesh.position.asArray(), health: n.health, state: n.aiState, dead: n.isDead,
    })).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
    rng: g.kernel.rng.getSaveState(),
  };
}

/** The first place two digests differ, as a path and both values; null when equal. */
export function digestDiff(a: unknown, b: unknown, path = ""): string | null {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const d = digestDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k);
      if (d) return d;
    }
  }
  return `${path || "(root)"}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
}

/**
 * Drives the game in deterministic mode.  Built before the game, so its
 * input interception runs ahead of every game listener.
 */
export class GameReplay {
  public frame = 0;
  public game: Game | null = null;
  /** Resolves when a playback has run all its frames. */
  public readonly done: Promise<void>;
  private _resolveDone!: () => void;
  private _choice: CharacterCreationResult | null = null;
  private _inputs: ReplayInput[] = [];
  private _queue: Array<() => void> = [];
  private _running = false;
  private _stopped = false;
  private _intercepting = false;

  constructor(
    public readonly mode: ReplayMode,
    private readonly _engine: Engine,
    private readonly _scene: Scene,
    private readonly _canvas: HTMLCanvasElement,
    private readonly _log: GameReplayLog | null = null,
  ) {
    this.done = new Promise((r) => { this._resolveDone = r; });
    if (mode === "play" && !_log) throw new Error("replay: no log to play");
    // Fixed steps everywhere: the engine's frame time, animations, game timers.
    _engine.getDeltaTime = () => STEP_MS;
    _scene.useConstantAnimationDeltaTime = true;
    simClock.useFrameTime(() => this.frame * STEP_MS);
    asyncWork.deterministic = true;
    // Panel animations run on the wall clock and some close a menu when they
    // end (handing input back to play): no animations, so menus close at once.
    applyPrefs({ ...loadPrefs(), reduceMotion: true });
    this._hookCreation();
    if (mode === "record") this._installInterceptor();
  }

  /** The log so far (record) or the one playing. */
  public log(): GameReplayLog {
    if (this._log) return this._log;
    if (!this._choice) throw new Error("replay: the character isn't made yet");
    return { version: 1, kind: "camelot-game", stepMs: STEP_MS, choice: serializeChoice(this._choice), frames: this.frame, inputs: this._inputs.slice() };
  }

  /** Stop stepping (and recording); returns the log. */
  public stop(): GameReplayLog {
    this._stopped = true;
    this._intercepting = false;
    return this.log();
  }

  public digest(): Record<string, unknown> {
    if (!this.game) throw new Error("replay: no game");
    return gameDigest(this.game);
  }

  /** Start once the character is made (the game is paused until then). */
  private _hookCreation(): void {
    const open = CharacterCreationUI.prototype.open;
    const self = this;
    CharacterCreationUI.prototype.open = async function (this: CharacterCreationUI) {
      const result = self.mode === "play" ? restoreChoice(self._log!.choice) : await open.call(this);
      self._choice = result;
      // The game applies the choice right after this resolves; start on a fresh task.
      setTimeout(() => void self._start(), 0);
      return result;
    };
  }

  private async _start(): Promise<void> {
    if (this._running) return;
    this._running = true;
    if (this.game) this.game._adaptiveRes = null; // render scale follows the real frame rate
    this._intercepting = this.mode === "record";
    await asyncWork.settle(); // what boot started lands before frame 0
    if (this.mode === "play") {
      const log = this._log!;
      while (this.frame < log.frames && !this._stopped) await this._step();
      this._resolveDone();
      return;
    }
    const tick = async () => {
      if (this._stopped) return;
      await this._step();
      requestAnimationFrame(() => void tick());
    };
    void tick();
  }

  private async _step(): Promise<void> {
    if (this.mode === "play") {
      for (const op of this._log!.inputs) if (op.f === this.frame) this._dispatch(op);
    } else {
      const queued = this._queue;
      this._queue = [];
      for (const run of queued) run();
    }
    simClock.runDue();
    this._scene.render();
    this.frame++;
    await asyncWork.settle();
  }

  private _dispatch(op: ReplayInput): void {
    if ("lock" in op) { this._engine.isPointerLock = op.lock; return; }
    const target = resolveTarget(op.target, this._canvas);
    if (!target) { console.warn(`[replay] frame ${op.f}: no element at ${op.target}`); return; }
    if ("value" in op) {
      const el = target as HTMLInputElement;
      if (op.checked !== undefined) el.checked = op.checked;
      else el.value = op.value;
      el.dispatchEvent(new Event(op.type, { bubbles: true }));
      return;
    }
    target.dispatchEvent(makeEvent(op.type, op.init));
  }

  /** Record mode: catch input before anything else, log it, dispatch it at the next frame. */
  private _installInterceptor(): void {
    const later = (op: ReplayInput) => {
      this._queue.push(() => {
        this._inputs.push({ ...op, f: this.frame });
        this._dispatch({ ...op, f: this.frame });
      });
    };
    const onInput = (e: Event) => {
      if (!this._intercepting || !e.isTrusted) return;
      if (isFormControl(e.target)) return; // its own handlers run; the value change is logged
      e.stopImmediatePropagation();
      later({ f: 0, target: targetPath(e.target, this._canvas), type: e.type, init: captureInit(e) });
    };
    for (const type of INTERCEPTED) window.addEventListener(type, onInput, { capture: true });
    const onValue = (e: Event) => {
      if (!this._intercepting || !e.isTrusted || !isFormControl(e.target)) return;
      const el = e.target as HTMLInputElement;
      e.stopImmediatePropagation();
      const checkable = el.type === "checkbox" || el.type === "radio";
      later({ f: 0, target: targetPath(el, this._canvas), type: e.type as "input" | "change", value: String(el.value ?? ""), ...(checkable ? { checked: el.checked } : {}) });
    };
    window.addEventListener("input", onValue, { capture: true });
    window.addEventListener("change", onValue, { capture: true });
    // Pointer lock: the engine's flag follows it at a frame boundary.
    window.addEventListener("pointerlockchange", (e) => {
      if (!this._intercepting) return;
      e.stopImmediatePropagation();
      later({ f: 0, lock: document.pointerLockElement === this._canvas });
    }, { capture: true });
  }
}

/** `?replay=record` or `?replay=play`, else null. */
export function replayModeFromUrl(): ReplayMode | null {
  const m = new URLSearchParams(location.search).get("replay");
  return m === "record" || m === "play" ? m : null;
}

export function readStoredLog(): GameReplayLog | null {
  try {
    const raw = localStorage.getItem(REPLAY_LOG_KEY);
    return raw ? (JSON.parse(raw) as GameReplayLog) : null;
  } catch {
    return null;
  }
}
