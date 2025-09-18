export interface CacheEntry<T> {
  item: T;
  lastAccess: number;
  accessCount: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  totalRequests: number;
  evictions: number;
}

export class CacheOperations {
  static getCachedItemAndUpdate<T>(
    cache: Map<number, CacheEntry<T>>,
    index: number,
    enableCaching: boolean
  ): CacheEntry<T> | undefined {
    const cached = enableCaching ? cache.get(index) : undefined;
    if (cached) {
      cached.accessCount++;
      cached.lastAccess = Date.now();
    }
    return cached;
  }

  static closeGapIfExists(
    currentGapStart: number,
    currentIndex: number,
    uncachedRanges: { start: number; count: number }[]
  ): number {
    if (currentGapStart !== -1) {
      uncachedRanges.push({
        start: currentGapStart,
        count: currentIndex - currentGapStart,
      });
      return -1;
    }
    return currentGapStart;
  }

  static closeFinalGapIfExists(
    currentGapStart: number,
    start: number,
    count: number,
    uncachedRanges: { start: number; count: number }[]
  ): void {
    if (currentGapStart !== -1) {
      uncachedRanges.push({
        start: currentGapStart,
        count: start + count - currentGapStart,
      });
    }
  }

  static evictLRUItems<T>(
    cache: Map<number, CacheEntry<T>>,
    targetSize: number,
    metrics: CacheMetrics
  ): void {
    if (cache.size <= targetSize) return;

    const entries = Array.from(cache.entries()).sort(
      ([, a], [, b]) => a.lastAccess - b.lastAccess
    );

    const toEvict = cache.size - targetSize;
    for (let i = 0; i < toEvict; i++) {
      cache.delete(entries[i][0]);
      metrics.evictions++;
    }
  }

  static calculateCacheHitRate(metrics: CacheMetrics): number {
    return metrics.totalRequests > 0 ? metrics.hits / metrics.totalRequests : 0;
  }

  static createCacheEntry<T>(item: T): CacheEntry<T> {
    return {
      item,
      lastAccess: Date.now(),
      accessCount: 1,
    };
  }
}

export interface OptimizerMetrics {
  totalItems: number;
  loadedItems: number;
  cacheHits: number;
  cacheMisses: number;
  errorCount: number;
  lastLoadTime: number;
}

export class MetricsCalculator {
  static calculateLoadRatio(metrics: OptimizerMetrics): number {
    return metrics.totalItems > 0
      ? metrics.loadedItems / metrics.totalItems
      : 0;
  }

  static calculateHitRate(metrics: OptimizerMetrics): number {
    const totalRequests = metrics.cacheHits + metrics.cacheMisses;
    return totalRequests > 0 ? metrics.cacheHits / totalRequests : 0;
  }

  static updateLoadMetrics(
    metrics: OptimizerMetrics,
    loadedCount: number,
    loadTime: number
  ): void {
    metrics.loadedItems += loadedCount;
    metrics.lastLoadTime = loadTime;
  }

  static incrementCacheHit(metrics: OptimizerMetrics): void {
    metrics.cacheHits++;
  }

  static incrementCacheMiss(metrics: OptimizerMetrics): void {
    metrics.cacheMisses++;
  }
}
