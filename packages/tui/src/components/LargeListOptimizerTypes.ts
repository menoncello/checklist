export interface ListOptimizationConfig {
  enableVirtualization: boolean;
  enableCaching: boolean;
  enableLazyLoading: boolean;
  virtualizationThreshold: number;
  cacheSize: number;
  chunkSize: number;
  preloadDistance: number;
  enableMetrics: boolean;
  debounceDelay: number;
  enableWorkerOptimization: boolean;
}

export interface ListDataSource<T> {
  getTotal(): number;
  getItem(index: number): Promise<T> | T;
  getItems(start: number, count: number): Promise<T[]> | T[];
  search?(query: string): Promise<number[]> | number[];
  sort?(compareFn: (a: T, b: T) => number): void;
  filter?(predicate: (item: T) => boolean): Promise<number[]> | number[];
}

export interface OptimizationMetrics {
  totalItems: number;
  cachedItems: number;
  cacheHitRate: number;
  averageLoadTime: number;
  activeLoaders: number;
  memoryUsage: number;
  renderTime: number;
  scrollPerformance: {
    averageFPS: number;
    frameDrops: number;
    smoothnessScore: number;
  };
}

export interface CacheEntry<T> {
  item: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

export interface LoadingChunk {
  start: number;
  end: number;
  promise: Promise<void>;
  requestTime: number;
}

export interface VirtualizationRange {
  startIndex: number;
  endIndex: number;
  visibleItems: number;
  bufferSize: number;
}

export interface ScrollMetrics {
  averageFPS: number;
  frameDrops: number;
  smoothnessScore: number;
  lastScrollTime: number;
}

export interface OptimizationStrategy {
  shouldPreload: (currentIndex: number, direction: 'up' | 'down') => boolean;
  getPreloadRange: (
    currentIndex: number,
    direction: 'up' | 'down'
  ) => { start: number; end: number };
  shouldEvictCache: (cacheSize: number, maxSize: number) => boolean;
  getCacheEvictionTargets: (
    cache: Map<number, CacheEntry<unknown>>
  ) => number[];
}
