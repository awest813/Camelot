/**
 * A small behaviour tree for choosing goals.
 *
 * Each node looks at a context and either picks a result or passes (null).
 * A selector tries its children in order and takes the first pick; `when`
 * guards a branch with a condition; `pick` is a leaf.  Trees are plain
 * functions, so they are cheap to run every tick and easy to test without
 * a scene.
 */

/** A node: a result, or null to pass to the next sibling. */
export type BtNode<C, R> = (ctx: C) => R | null;

/** The first child that picks wins. */
export function selector<C, R>(...children: BtNode<C, R>[]): BtNode<C, R> {
  return (ctx) => {
    for (const child of children) {
      const r = child(ctx);
      if (r !== null) return r;
    }
    return null;
  };
}

/** Run `node` only when `cond` holds. */
export function when<C, R>(cond: (ctx: C) => boolean, node: BtNode<C, R>): BtNode<C, R> {
  return (ctx) => (cond(ctx) ? node(ctx) : null);
}

/** A leaf: always this result (or one computed from the context). */
export function pick<C, R>(result: R | ((ctx: C) => R)): BtNode<C, R> {
  return typeof result === "function" ? (result as (ctx: C) => R) : () => result;
}

/** Branch on a key of the context (a "switch" over, e.g., the current goal). */
export function branch<C, K extends string, R>(key: (ctx: C) => K, cases: Partial<Record<K, BtNode<C, R>>>): BtNode<C, R> {
  return (ctx) => cases[key(ctx)]?.(ctx) ?? null;
}
