/**
 * Replays: record what is fed into a kernel (its seed, the events emitted
 * into it, the phases run and their time steps) as a plain JSON log, and
 * feed the same log to a fresh kernel later.  With every random roll drawn
 * from the kernel's seeded streams, the replay ends in the same state, so
 * a bug report can carry the log and a test can re-run it.
 *
 * This is the kernel-scope replay (features and their services, headless).
 * The whole game in the browser replays through src/replay/game-replay.ts.
 *
 * Engine overhaul, Phase 5.
 */
import type { Kernel } from "./kernel";
import type { Phase } from "./phases";
import type { GameEvents, GameEventType } from "../systems/event-bus";

export type ReplayOp =
  | { op: "emit"; type: GameEventType; payload: unknown }
  | { op: "run"; phase: Phase; dt: number };

export interface ReplayLog {
  version: 1;
  seed: string;
  ops: ReplayOp[];
}

/** Drive a kernel through this instead of directly, and every input is logged. */
export class ReplayRecorder {
  private readonly _ops: ReplayOp[] = [];

  constructor(private readonly _kernel: Kernel, private readonly _seed: string) {}

  public emit<T extends GameEventType>(type: T, payload: GameEvents[T]): void {
    // Kept as JSON from the start, so the log can't hold live objects.
    this._ops.push({ op: "emit", type, payload: JSON.parse(JSON.stringify(payload)) });
    this._kernel.events.emit(type, payload);
  }

  public run(phase: Phase, dt: number): void {
    this._ops.push({ op: "run", phase, dt });
    this._kernel.phases.run(phase, dt);
  }

  public log(): ReplayLog {
    return { version: 1, seed: this._seed, ops: this._ops.map((o) => ({ ...o })) };
  }
}

/** Feed a recorded log to a kernel built for its seed. */
export function replay(log: ReplayLog, kernel: Kernel): void {
  if (log.version !== 1) throw new Error(`unknown replay log version ${String(log.version)}`);
  for (const o of log.ops) {
    if (o.op === "emit") kernel.events.emit(o.type, o.payload as never);
    else kernel.phases.run(o.phase, o.dt);
  }
}

/**
 * Re-run `log` on a fresh kernel from `build(seed)` and compare what
 * `observe` reads afterwards with `expected`.  Returns the first difference
 * as text, or null when the replay matches.
 */
export function verifyReplay<K extends Kernel>(
  log: ReplayLog,
  build: (seed: string) => K,
  observe: (kernel: K) => unknown,
  expected: unknown,
): string | null {
  const kernel = build(log.seed);
  replay(log, kernel);
  const got = JSON.stringify(observe(kernel));
  const want = JSON.stringify(expected);
  return got === want ? null : `replay diverged:\n  expected ${want}\n  got      ${got}`;
}
