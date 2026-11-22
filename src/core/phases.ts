/**
 * PhaseScheduler — systems declare when they run instead of being called in
 * a hand-written order.
 *
 * Each system registers into a phase, optionally `after` other systems in the
 * same phase.  `run(phase, dt)` calls them in dependency order (ties keep
 * registration order) and records how long each took, so the profiler gets
 * per-system cost for free.
 *
 * Phases, in frame order:
 *   input → sim (fixed step) → ai → physics → anim → present → ui
 *
 * Engine overhaul, Phase 1 (docs/engine-overhaul-plan.md → Kernel).
 */
export const PHASES = ["input", "sim", "ai", "physics", "anim", "present", "ui"] as const;
export type Phase = (typeof PHASES)[number];

export interface PhaseSystem {
  id: string;
  phase: Phase;
  /** Ids of systems in the same phase that must run first. */
  after?: string[];
  update(dt: number): void;
}

export interface SystemTiming {
  id: string;
  phase: Phase;
  /** Exponential moving average of the update time, in ms. */
  avgMs: number;
  lastMs: number;
}

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class PhaseScheduler {
  private readonly _systems = new Map<string, PhaseSystem>();
  private readonly _order = new Map<Phase, PhaseSystem[]>();
  private readonly _timings = new Map<string, SystemTiming>();
  private _dirty = true;

  /** Register a system; returns a function that unregisters it. */
  public register(system: PhaseSystem): () => void {
    if (this._systems.has(system.id)) throw new Error(`system '${system.id}' is already registered`);
    this._systems.set(system.id, system);
    this._timings.set(system.id, { id: system.id, phase: system.phase, avgMs: 0, lastMs: 0 });
    this._dirty = true;
    return () => {
      if (this._systems.get(system.id) !== system) return;
      this._systems.delete(system.id);
      this._timings.delete(system.id);
      this._dirty = true;
    };
  }

  public has(id: string): boolean {
    return this._systems.has(id);
  }

  /** Systems of a phase in the order they will run. */
  public orderOf(phase: Phase): string[] {
    this._sort();
    return (this._order.get(phase) ?? []).map((s) => s.id);
  }

  public run(phase: Phase, dt: number): void {
    this._sort();
    const list = this._order.get(phase);
    if (!list) return;
    for (const s of list) {
      const t0 = now();
      try {
        s.update(dt);
      } catch (err) {
        console.error(`[phases] ${s.id} failed`, err);
      }
      const ms = now() - t0;
      const t = this._timings.get(s.id);
      if (t) {
        t.lastMs = ms;
        t.avgMs = t.avgMs === 0 ? ms : t.avgMs * 0.95 + ms * 0.05;
      }
    }
  }

  /** Per-system timings, slowest first. */
  public timings(): SystemTiming[] {
    return [...this._timings.values()].sort((a, b) => b.avgMs - a.avgMs);
  }

  /** Stable topological sort within each phase. */
  private _sort(): void {
    if (!this._dirty) return;
    this._dirty = false;
    this._order.clear();
    for (const phase of PHASES) {
      const members = [...this._systems.values()].filter((s) => s.phase === phase);
      const ids = new Set(members.map((s) => s.id));
      const placed = new Set<string>();
      const out: PhaseSystem[] = [];
      const visiting = new Set<string>();
      const visit = (s: PhaseSystem) => {
        if (placed.has(s.id)) return;
        if (visiting.has(s.id)) throw new Error(`phase '${phase}': dependency cycle at '${s.id}'`);
        visiting.add(s.id);
        for (const dep of s.after ?? []) {
          if (!ids.has(dep)) continue; // depending on an absent system is fine
          visit(this._systems.get(dep)!);
        }
        visiting.delete(s.id);
        placed.add(s.id);
        out.push(s);
      };
      for (const s of members) visit(s);
      if (out.length) this._order.set(phase, out);
    }
  }
}
