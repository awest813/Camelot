export type ChunkKey = string;

export interface Vec2Like {
  x: number;
  y: number;
}

export interface Chunk<TData = unknown> {
  key: ChunkKey;
  coords: Vec2Like;
  data: TData | null;
  isLoaded: boolean;
  isLoading: boolean;
  isMounted: boolean;
  lastTouched: number;
  error?: unknown;
}

export type ChunkEventType =
  | "created"
  | "load-start"
  | "loaded"
  | "load-error"
  | "activated"
  | "deactivated"
  | "mount-start"
  | "mounted"
  | "unmount-start"
  | "unmounted"
  | "unloaded";

export interface ChunkEvent<TData = unknown> {
  type: ChunkEventType;
  chunk: Chunk<TData>;
}

export interface ChunkManagerOptions {
  chunkSize: number;
  activeRadius: number;
  maxCachedChunks?: number;
  preloadRadius?: number;
  loadConcurrency?: number;
}

export interface ChunkSource<TData> {
  loadChunk(coords: Vec2Like, signal?: AbortSignal): Promise<TData>;
  unloadChunk?(chunk: Chunk<TData>): Promise<void> | void;
}

export interface ChunkAdapter<TData> {
  mount(chunk: Chunk<TData>): Promise<void> | void;
  unmount(chunk: Chunk<TData>): Promise<void> | void;
}
