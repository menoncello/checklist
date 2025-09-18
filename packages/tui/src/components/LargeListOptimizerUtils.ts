import {
  ListOptimizationConfig,
  OptimizationMetrics,
  CacheEntry,
  ScrollMetrics,
} from './LargeListOptimizerTypes';

export class LargeListOptimizerUtils {
  static createDefaultConfig(
    config: Partial<ListOptimizationConfig>
  ): ListOptimizationConfig {
    return {
      enableVirtualization: true,
      enableCaching: true,
      enableLazyLoading: true,
      virtualizationThreshold: 1000,
      cacheSize: 5000,
      chunkSize: 100,
      preloadDistance: 200,
      enableMetrics: true,
      debounceDelay: 16, // ~60fps
      enableWorkerOptimization: false,
      ...config,
    };
  }

  static createDefaultMetrics(): OptimizationMetrics {
    return {
      totalItems: 0,
      cachedItems: 0,
      cacheHitRate: 0,
      averageLoadTime: 0,
      activeLoaders: 0,
      memoryUsage: 0,
      renderTime: 0,
      scrollPerformance: {
        averageFPS: 60,
        frameDrops: 0,
        smoothnessScore: 1.0,
      },
    };
  }

  static calculateCacheHitRate(hits: number, misses: number): number {
    const total = hits + misses;
    return total > 0 ? hits / total : 0;
  }

  static estimateMemoryUsage<T>(cache: Map<number, CacheEntry<T>>): number {
    let totalSize = 0;
    for (const [, entry] of cache) {
      // Rough estimation - would need more sophisticated calculation in practice
      totalSize += JSON.stringify(entry.item).length * 2; // Rough bytes estimation
      totalSize += 64; // Overhead for cache entry metadata
    }
    return totalSize;
  }

  static calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  static detectScrollDirection(
    accessPattern: number[]
  ): 'up' | 'down' | 'bidirectional' {
    if (accessPattern.length < 3) return 'bidirectional';

    const recent = accessPattern.slice(-5);
    let upward = 0;
    let downward = 0;

    for (let i = 1; i < recent.length; i++) {
      if (recent[i] > recent[i - 1]) {
        downward++;
      } else if (recent[i] < recent[i - 1]) {
        upward++;
      }
    }

    if (downward > upward * 1.5) return 'down';
    if (upward > downward * 1.5) return 'up';
    return 'bidirectional';
  }

  static getPreloadIndices(
    currentIndex: number,
    direction: 'up' | 'down' | 'bidirectional',
    preloadDistance: number,
    totalItems: number
  ): number[] {
    switch (direction) {
      case 'down':
        return this.getDownwardPreloadIndices(
          currentIndex,
          preloadDistance,
          totalItems
        );
      case 'up':
        return this.getUpwardPreloadIndices(currentIndex, preloadDistance);
      case 'bidirectional':
        return this.getBidirectionalPreloadIndices(
          currentIndex,
          preloadDistance,
          totalItems
        );
      default:
        return [];
    }
  }

  private static getDownwardPreloadIndices(
    currentIndex: number,
    preloadDistance: number,
    totalItems: number
  ): number[] {
    const indices: number[] = [];
    const maxIndex = Math.min(currentIndex + preloadDistance, totalItems - 1);

    for (let i = currentIndex + 1; i <= maxIndex; i++) {
      indices.push(i);
    }
    return indices;
  }

  private static getUpwardPreloadIndices(
    currentIndex: number,
    preloadDistance: number
  ): number[] {
    const indices: number[] = [];
    const minIndex = Math.max(currentIndex - preloadDistance, 0);

    for (let i = currentIndex - 1; i >= minIndex; i--) {
      indices.push(i);
    }
    return indices;
  }

  private static getBidirectionalPreloadIndices(
    currentIndex: number,
    preloadDistance: number,
    totalItems: number
  ): number[] {
    const halfDistance = Math.floor(preloadDistance / 2);
    const upward = this.getUpwardPreloadIndices(currentIndex, halfDistance);
    const downward = this.getDownwardPreloadIndices(
      currentIndex,
      halfDistance,
      totalItems
    );
    return [...upward, ...downward];
  }

  static getEvictionTargets<T>(
    cache: Map<number, CacheEntry<T>>,
    maxSize: number
  ): number[] {
    if (cache.size <= maxSize) return [];

    // Sort by access frequency and recency (LRU)
    const entries = Array.from(cache.entries());
    entries.sort(([, a], [, b]) => {
      // Primary: access count (ascending)
      if (a.accessCount !== b.accessCount) {
        return a.accessCount - b.accessCount;
      }
      // Secondary: last access time (ascending - older first)
      return a.lastAccess - b.lastAccess;
    });

    const numToEvict = cache.size - maxSize;
    return entries.slice(0, numToEvict).map(([index]) => index);
  }

  static updateScrollMetrics(
    frameTimeHistory: number[],
    lastFrameTime: number
  ): ScrollMetrics {
    const currentTime = performance.now();
    const frameTime = currentTime - lastFrameTime;

    frameTimeHistory.push(frameTime);
    if (frameTimeHistory.length > 60) {
      frameTimeHistory.shift(); // Keep last 60 frames
    }

    const averageFrameTime =
      frameTimeHistory.reduce((sum, time) => sum + time, 0) /
      frameTimeHistory.length;
    const averageFPS = averageFrameTime > 0 ? 1000 / averageFrameTime : 60;

    const frameDrops = frameTimeHistory.filter((time) => time > 20).length; // Frames taking >20ms
    const smoothnessScore = Math.max(
      0,
      1 - frameDrops / frameTimeHistory.length
    );

    return {
      averageFPS,
      frameDrops,
      smoothnessScore,
      lastScrollTime: currentTime,
    };
  }
}
