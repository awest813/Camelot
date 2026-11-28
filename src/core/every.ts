/**
 * Run `fn` at most once every `seconds` of the dt it is fed (the first call
 * runs at once): for per-frame systems whose work need not be per frame (a
 * HUD chip, a stat sync).
 */
export function every(seconds: number, fn: () => void): (dt: number) => void {
  let wait = 0;
  return (dt) => {
    wait -= dt;
    if (wait > 0) return;
    wait = seconds;
    fn();
  };
}
