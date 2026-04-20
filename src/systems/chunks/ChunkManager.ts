import type {
  Chunk,
  ChunkAdapter,
  ChunkEvent,
  ChunkManagerOptions,
  ChunkSource,
  Vec2Like,
} from "./ChunkTypes";
import {
  squareCoordsAround,
  sortCoordsByDistance,
  toChunkKey,
  worldToChunkCoords,
} from "./ChunkUtils";

export class ChunkManager<TData> {
  private readonly chunks = new Map<string, Chunk<TData>>();
  private readonly activeKeys = new Set<string>();
  private readonly preloadKeys = new Set<string>();
  private readonly loadingKeys = new Set<string>();
  private readonly abortControllers = new Map<string, AbortController>();

  private readonly options: Required<ChunkManagerOptions>;

  constructor(
    private readonly source: ChunkSource<TData>,
    private readonly adapter?: ChunkAdapter<TData>,
    options?: ChunkManagerOptions,
    private readonly onEvent?: (event: ChunkEvent<TData>) => void
  ) {
    this.options = {
      chunkSize: options?.chunkSize ?? 256,
      activeRadius: options?.activeRadius ?? 1,
      preloadRadius: options?.preloadRadius ?? options?.activeRadius ?? 1,
      maxCachedChunks: options?.maxCachedChunks ?? 24,
      loadConcurrency: options?.loadConcurrency ?? 4,
    };

    if (this.options.preloadRadius < this.options.activeRadius) {
      this.options.preloadRadius = this.options.activeRadius;
    }
  }

  getChunkAtWorld(world: Vec2Like): Chunk<TData> | undefined {
    const coords = worldToChunkCoords(world, this.options.chunkSize);
    return this.chunks.get(toChunkKey(coords));
  }

  getChunkByKey(key: string): Chunk<TData> | undefined {
    return this.chunks.get(key);
  }

  getLoadedChunks(): Chunk<TData>[] {
    return [...this.chunks.values()].filter((chunk) => chunk.isLoaded);
  }

  getActiveChunks(): Chunk<TData>[] {
    return [...this.activeKeys]
      .map((key) => this.chunks.get(key))
      .filter((chunk): chunk is Chunk<TData> => Boolean(chunk));
  }

  getMountedChunks(): Chunk<TData>[] {
    return [...this.chunks.values()].filter((chunk) => chunk.isMounted);
  }

  async update(worldPosition: Vec2Like): Promise<void> {
    const center = worldToChunkCoords(worldPosition, this.options.chunkSize);

    const activeCoords = sortCoordsByDistance(
      squareCoordsAround(center, this.options.activeRadius),
      center
    );

    const preloadCoords = sortCoordsByDistance(
      squareCoordsAround(center, this.options.preloadRadius),
      center
    );

    const nextActiveKeys = new Set(activeCoords.map(toChunkKey));
    const nextPreloadKeys = new Set(preloadCoords.map(toChunkKey));

    for (const coords of preloadCoords) {
      this.ensureChunk(coords);
    }

    for (const chunk of this.chunks.values()) {
      if (nextPreloadKeys.has(chunk.key)) {
        chunk.lastTouched = Date.now();
      }
    }

    await this.loadNeededChunks(preloadCoords);

    for (const key of nextActiveKeys) {
      if (!this.activeKeys.has(key)) {
        const chunk = this.chunks.get(key);
        if (!chunk) continue;

        this.activeKeys.add(key);
        this.emit("activated", chunk);

        if (chunk.isLoaded && !chunk.isMounted) {
          await this.mountChunk(chunk);
        }
      }
    }

    for (const key of [...this.activeKeys]) {
      if (!nextActiveKeys.has(key)) {
        const chunk = this.chunks.get(key);
        this.activeKeys.delete(key);

        if (!chunk) continue;

        this.emit("deactivated", chunk);

        if (chunk.isMounted) {
          await this.unmountChunk(chunk);
        }
      }
    }

    this.preloadKeys.clear();
    for (const key of nextPreloadKeys) {
      this.preloadKeys.add(key);
    }

    await this.evictCache();
  }

  async dispose(): Promise<void> {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }

    for (const chunk of this.getMountedChunks()) {
      await this.unmountChunk(chunk);
    }

    for (const chunk of this.getLoadedChunks()) {
      await this.unloadChunk(chunk);
    }

    this.activeKeys.clear();
    this.preloadKeys.clear();
    this.loadingKeys.clear();
    this.abortControllers.clear();
    this.chunks.clear();
  }

  private ensureChunk(coords: Vec2Like): Chunk<TData> {
    const key = toChunkKey(coords);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const chunk: Chunk<TData> = {
      key,
      coords,
      data: null,
      isLoaded: false,
      isLoading: false,
      isMounted: false,
      lastTouched: Date.now(),
    };

    this.chunks.set(key, chunk);
    this.emit("created", chunk);
    return chunk;
  }

  private async loadNeededChunks(coordsList: Vec2Like[]): Promise<void> {
    const queue = coordsList
      .map((coords) => this.chunks.get(toChunkKey(coords)))
      .filter((chunk): chunk is Chunk<TData> => Boolean(chunk))
      .filter((chunk) => !chunk.isLoaded && !chunk.isLoading);

    const workers = Array.from({
      length: Math.min(this.options.loadConcurrency, queue.length),
    }).map(async () => {
      while (queue.length > 0) {
        const chunk = queue.shift();
        if (!chunk) return;
        await this.loadChunk(chunk);
      }
    });

    await Promise.all(workers);
  }

  private async loadChunk(chunk: Chunk<TData>): Promise<void> {
    if (chunk.isLoaded || chunk.isLoading || this.loadingKeys.has(chunk.key)) {
      return;
    }

    chunk.isLoading = true;
    chunk.error = undefined;
    this.loadingKeys.add(chunk.key);
    this.emit("load-start", chunk);

    const controller = new AbortController();
    this.abortControllers.set(chunk.key, controller);

    try {
      chunk.data = await this.source.loadChunk(chunk.coords, controller.signal);
      chunk.isLoaded = true;
      chunk.lastTouched = Date.now();
      this.emit("loaded", chunk);

      if (this.activeKeys.has(chunk.key) && !chunk.isMounted) {
        await this.mountChunk(chunk);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        chunk.error = error;
        this.emit("load-error", chunk);
      }
    } finally {
      chunk.isLoading = false;
      this.loadingKeys.delete(chunk.key);
      this.abortControllers.delete(chunk.key);
    }
  }

  private async mountChunk(chunk: Chunk<TData>): Promise<void> {
    if (!this.adapter || chunk.isMounted || !chunk.isLoaded) return;

    this.emit("mount-start", chunk);
    await this.adapter.mount(chunk);
    chunk.isMounted = true;
    this.emit("mounted", chunk);
  }

  private async unmountChunk(chunk: Chunk<TData>): Promise<void> {
    if (!this.adapter || !chunk.isMounted) return;

    this.emit("unmount-start", chunk);
    await this.adapter.unmount(chunk);
    chunk.isMounted = false;
    this.emit("unmounted", chunk);
  }

  private async unloadChunk(chunk: Chunk<TData>): Promise<void> {
    if (!chunk.isLoaded) return;

    if (chunk.isMounted) {
      await this.unmountChunk(chunk);
    }

    this.abortControllers.get(chunk.key)?.abort();
    this.abortControllers.delete(chunk.key);

    await this.source.unloadChunk?.(chunk);

    chunk.data = null;
    chunk.isLoaded = false;
    chunk.error = undefined;
    this.emit("unloaded", chunk);
  }

  private async evictCache(): Promise<void> {
    const loaded = this.getLoadedChunks();
    if (loaded.length <= this.options.maxCachedChunks) return;

    const victims = loaded
      .filter(
        (chunk) =>
          !this.activeKeys.has(chunk.key) &&
          !this.preloadKeys.has(chunk.key) &&
          !chunk.isLoading
      )
      .sort((a, b) => a.lastTouched - b.lastTouched);

    while (
      this.getLoadedChunks().length > this.options.maxCachedChunks &&
      victims.length > 0
    ) {
      const victim = victims.shift();
      if (!victim) break;
      await this.unloadChunk(victim);
    }
  }

  private emit(type: ChunkEvent<TData>["type"], chunk: Chunk<TData>): void {
    this.onEvent?.({ type, chunk });
  }
}
