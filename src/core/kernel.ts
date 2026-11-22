/**
 * Kernel — the runtime that features plug into.
 *
 *  - `events`   the typed game event bus (GameEventBus)
 *  - `phases`   the phase scheduler (who runs when, and what it costs)
 *  - `services` typed service registry (what a feature can use)
 *  - `rng`      named seeded random streams
 *  - `scope`    root ownership scope; each feature gets a child scope
 *
 * A Feature is a self-contained module: it registers systems, subscribes to
 * events and provides services in `install`, and everything it creates is
 * owned by its scope, so `uninstall` (or kernel disposal) releases it all.
 *
 * Engine overhaul, Phase 1 (docs/engine-overhaul-plan.md → Kernel).
 */
import { GameEventBus, type GameEvents, type GameEventType } from "../systems/event-bus";
import { PhaseScheduler, type PhaseSystem } from "./phases";
import { RngStreams } from "./rng/rng";
import { Scope } from "./scope";

/** A typed key for a service: `createServiceKey<Clock>("clock")`. */
export interface ServiceKey<T> {
  readonly name: string;
  /** Type carrier only. */
  readonly __type?: T;
}

export function createServiceKey<T>(name: string): ServiceKey<T> {
  return { name };
}

export class ServiceRegistry {
  private readonly _services = new Map<string, unknown>();

  public provide<T>(key: ServiceKey<T>, value: T): () => void {
    if (this._services.has(key.name)) throw new Error(`service '${key.name}' is already provided`);
    this._services.set(key.name, value);
    return () => {
      if (this._services.get(key.name) === value) this._services.delete(key.name);
    };
  }

  public get<T>(key: ServiceKey<T>): T {
    if (!this._services.has(key.name)) throw new Error(`service '${key.name}' is not provided`);
    return this._services.get(key.name) as T;
  }

  public tryGet<T>(key: ServiceKey<T>): T | undefined {
    return this._services.get(key.name) as T | undefined;
  }
}

/** What a feature sees while installing: the kernel plus its own scope. */
export interface FeatureContext {
  readonly kernel: Kernel;
  readonly scope: Scope;
  /** Register a system in a phase, owned by the feature's scope. */
  system(system: PhaseSystem): void;
  /** Subscribe to an event, owned by the feature's scope. */
  on<T extends GameEventType>(event: T, cb: (payload: GameEvents[T]) => void): void;
  /** Provide a service, owned by the feature's scope. */
  provide<T>(key: ServiceKey<T>, value: T): void;
}

export interface Feature {
  readonly id: string;
  install(ctx: FeatureContext): void;
}

export class Kernel {
  public readonly events: GameEventBus;
  public readonly phases = new PhaseScheduler();
  public readonly services = new ServiceRegistry();
  public readonly rng: RngStreams;
  public readonly scope = new Scope("kernel");
  private readonly _features = new Map<string, Scope>();

  constructor(opts: { events?: GameEventBus; seed?: string } = {}) {
    this.events = opts.events ?? new GameEventBus();
    this.rng = new RngStreams(opts.seed ?? "camelot");
  }

  public install(feature: Feature): void {
    if (this._features.has(feature.id)) throw new Error(`feature '${feature.id}' is already installed`);
    const scope = this.scope.child(feature.id);
    this._features.set(feature.id, scope);
    const ctx: FeatureContext = {
      kernel: this,
      scope,
      system: (s) => { scope.add(this.phases.register(s)); },
      on: (event, cb) => { scope.add(this.events.on(event, cb)); },
      provide: (key, value) => { scope.add(this.services.provide(key, value)); },
    };
    try {
      feature.install(ctx);
    } catch (err) {
      scope.dispose();
      this._features.delete(feature.id);
      throw err;
    }
  }

  public uninstall(id: string): void {
    const scope = this._features.get(id);
    if (!scope) return;
    scope.dispose();
    this._features.delete(id);
  }

  public isInstalled(id: string): boolean {
    return this._features.has(id);
  }

  public dispose(): void {
    this.scope.dispose();
    this._features.clear();
  }
}
