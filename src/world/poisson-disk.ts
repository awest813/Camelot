/**
 * Fast Poisson-Disk Sampling in 2D (Bridson's Algorithm).
 *
 * Implements Robert Bridson's O(N) algorithm for generating blue-noise sample distributions
 * with a guaranteed minimum distance `r` between any two points.
 *
 * MIT License.
 *
 * References:
 *   Bridson, R. (2007). "Fast Poisson Disk Sampling in Arbitrary Dimensions".
 *   SIGGRAPH Sketches.
 */

export interface PoissonPoint {
  x: number;
  y: number;
}

export interface PoissonBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PoissonOptions {
  /** Maximum candidate attempts per active point before retiring it (default: 30). */
  k?: number;
  /** Custom PRNG returning a float in [0, 1). Defaults to Math.random. */
  prng?: () => number;
  /** Optional density rejection callback: return 0.0 to 1.0 (1.0 = full density, 0.0 = rejected). */
  densityFilter?: (x: number, y: number) => number;
}

/**
 * Simple deterministic Mulberry32 PRNG generator for seeded sampling.
 */
export function createMulberry32(seed: number): () => number {
  let s = Math.floor(seed) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a set of 2D Poisson-disk sample points within a rectangular bounding box.
 *
 * @param bounds Spatial bounding rectangle for the sampling domain.
 * @param minDistance Minimum distance `r` between any two generated points.
 * @param options Additional options (candidate count `k`, seeded PRNG, density filter).
 * @returns Array of Poisson points where distance(p1, p2) >= minDistance.
 */
export function generatePoissonPoints(
  bounds: PoissonBounds,
  minDistance: number,
  options: PoissonOptions = {},
): PoissonPoint[] {
  if (minDistance <= 0) {
    throw new Error(`minDistance must be positive, got ${minDistance}`);
  }

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width <= 0 || height <= 0) {
    return [];
  }

  const k = options.k ?? 30;
  const prng = options.prng ?? Math.random;
  const densityFilter = options.densityFilter;

  // Grid cell size such that each grid cell contains at most one point (r / sqrt(2))
  const cellSize = minDistance / Math.SQRT2;
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);

  // Initialize acceleration grid (-1 = empty)
  const grid: number[] = new Array(gridWidth * gridHeight).fill(-1);

  const points: PoissonPoint[] = [];
  const activeList: number[] = [];

  // Helper to map 2D coordinates to 1D grid index
  const getGridIndex = (gx: number, gy: number): number => gy * gridWidth + gx;

  // Pick initial seed point (must satisfy density filter if provided)
  let initialPoint: PoissonPoint | null = null;
  for (let attempt = 0; attempt < 100; attempt++) {
    const candX = bounds.minX + prng() * width;
    const candY = bounds.minY + prng() * height;
    if (densityFilter && prng() > densityFilter(candX, candY)) {
      continue;
    }
    initialPoint = { x: candX, y: candY };
    break;
  }

  if (!initialPoint) {
    return [];
  }

  points.push(initialPoint);
  const initGx = Math.floor((initialPoint.x - bounds.minX) / cellSize);
  const initGy = Math.floor((initialPoint.y - bounds.minY) / cellSize);
  if (initGx >= 0 && initGx < gridWidth && initGy >= 0 && initGy < gridHeight) {
    grid[getGridIndex(initGx, initGy)] = 0;
  }
  activeList.push(0);

  const minDistSq = minDistance * minDistance;

  while (activeList.length > 0) {
    // Pick an active point uniformly at random
    const activeIdx = Math.floor(prng() * activeList.length);
    const pointIdx = activeList[activeIdx];
    const sourcePoint = points[pointIdx];

    let foundCandidate = false;

    for (let attempt = 0; attempt < k; attempt++) {
      // Generate a point in the spherical annulus between r and 2r around source
      const angle = prng() * Math.PI * 2;
      const radius = minDistance * (1 + prng()); // uniform in [r, 2r]
      const candidateX = sourcePoint.x + Math.cos(angle) * radius;
      const candidateY = sourcePoint.y + Math.sin(angle) * radius;

      // Check boundary
      if (
        candidateX < bounds.minX ||
        candidateX >= bounds.maxX ||
        candidateY < bounds.minY ||
        candidateY >= bounds.maxY
      ) {
        continue;
      }

      // Check density rejection mask if provided
      if (densityFilter) {
        const threshold = densityFilter(candidateX, candidateY);
        if (prng() > threshold) {
          continue;
        }
      }

      const gx = Math.floor((candidateX - bounds.minX) / cellSize);
      const gy = Math.floor((candidateY - bounds.minY) / cellSize);

      // Check neighborhood in grid: [-2, +2] in x and y
      const minSearchX = Math.max(0, gx - 2);
      const maxSearchX = Math.min(gridWidth - 1, gx + 2);
      const minSearchY = Math.max(0, gy - 2);
      const maxSearchY = Math.min(gridHeight - 1, gy + 2);

      let tooClose = false;
      for (let sy = minSearchY; sy <= maxSearchY; sy++) {
        for (let sx = minSearchX; sx <= maxSearchX; sx++) {
          const neighborIdx = grid[getGridIndex(sx, sy)];
          if (neighborIdx !== -1) {
            const neighbor = points[neighborIdx];
            const dx = candidateX - neighbor.x;
            const dy = candidateY - neighbor.y;
            if (dx * dx + dy * dy < minDistSq) {
              tooClose = true;
              break;
            }
          }
        }
        if (tooClose) break;
      }

      if (!tooClose) {
        // Valid candidate found!
        const newPointIdx = points.length;
        const newPoint: PoissonPoint = { x: candidateX, y: candidateY };
        points.push(newPoint);
        grid[getGridIndex(gx, gy)] = newPointIdx;
        activeList.push(newPointIdx);
        foundCandidate = true;
        break;
      }
    }

    if (!foundCandidate) {
      // Remove point from active list using fast unordered swap-pop
      const last = activeList.pop()!;
      if (activeIdx < activeList.length) {
        activeList[activeIdx] = last;
      }
    }
  }

  return points;
}
