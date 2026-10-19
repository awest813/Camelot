import path from "path";

/**
 * Resolve a request path against the packaged dist directory.
 * Returns null when the path escapes dist (traversal, null bytes, bad escapes).
 * An empty path resolves to index.html.
 */
export function resolveDistFile(distDir, requestPath) {
  if (typeof requestPath !== "string") return null;
  const distRoot = path.resolve(distDir);
  let rel = requestPath;
  try {
    rel = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (rel.includes("\0")) return null;
  const stripped = rel.replace(/^[/\\]+/, "");
  const target = path.resolve(distRoot, stripped === "" ? "index.html" : stripped);
  const relative = path.relative(distRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return target;
}
