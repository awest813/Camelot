/**
 * Scope — ownership for everything a feature, chunk or encounter creates.
 *
 * Register disposers (or objects with `dispose()`) as you create things; when
 * the scope is disposed they are released in reverse order, and child scopes
 * go first.  Disposing twice is a no-op, and anything added to a disposed
 * scope is released immediately, so late async callbacks can't leak.
 *
 * Engine overhaul, Phase 1 (docs/engine-overhaul-plan.md → Kernel).
 */
export type Disposer = () => void;
export interface Disposable { dispose(): void }

export class Scope {
  private readonly _disposers: Disposer[] = [];
  private readonly _children = new Set<Scope>();
  private _disposed = false;

  constructor(public readonly name = "scope", private readonly _parent: Scope | null = null) {}

  public get disposed(): boolean {
    return this._disposed;
  }

  /** Own a disposer or disposable; returns it for chaining. */
  public add<T extends Disposer | Disposable>(item: T): T {
    const fn: Disposer = typeof item === "function" ? item : () => item.dispose();
    if (this._disposed) {
      safe(fn, this.name);
      return item;
    }
    this._disposers.push(fn);
    return item;
  }

  /** A nested scope, disposed with this one (or on its own, earlier). */
  public child(name: string): Scope {
    const c = new Scope(`${this.name}/${name}`, this);
    if (this._disposed) {
      c.dispose();
      return c;
    }
    this._children.add(c);
    return c;
  }

  public dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    for (const c of [...this._children]) c.dispose();
    this._children.clear();
    for (let i = this._disposers.length - 1; i >= 0; i--) safe(this._disposers[i], this.name);
    this._disposers.length = 0;
    this._parent?._children.delete(this);
  }
}

function safe(fn: Disposer, scope: string): void {
  try {
    fn();
  } catch (err) {
    console.warn(`[scope ${scope}] disposer failed`, err);
  }
}
