/**
 * Vitest setup: guarantee a `localStorage` global in the jsdom environment.
 *
 * vitest 4's global population strips jsdom 28's `localStorage` accessor, so
 * `window.localStorage` and `globalThis.localStorage` are both `undefined`
 * inside tests — any suite touching it directly (e.g. `localStorage.clear()`
 * in `beforeEach`) crashes.  Install a minimal in-memory Storage shim when the
 * real one is missing.  Suites that stub `localStorage` via `vi.stubGlobal`
 * are unaffected — stubbing still wins and `unstubAllGlobals` restores this
 * shim afterwards.
 */
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: shim,
    configurable: true,
    writable: true,
  });
}

export {};
