/**
 * The loading cover in index.html: it shows from first paint while the
 * engine, physics and world start, and fades out once there is something
 * to show (the title, the game, or a fatal error).
 */
export function dismissBootCover(): void {
  if (typeof document === "undefined") return;
  const cover = document.getElementById("boot-cover");
  if (!cover || cover.classList.contains("is-gone")) return;
  cover.classList.add("is-gone");
  cover.removeAttribute("aria-live");
  const remove = () => cover.remove();
  cover.addEventListener("transitionend", remove, { once: true });
  setTimeout(remove, 800); // (no transition under reduced motion, or in a hidden tab)
}
