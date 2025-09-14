import { ListCacheManager } from './ListCacheManager';
import { ListChunkLoader } from './ListChunkLoader';
import { ListPreloader } from './ListPreloader';
import { CacheManager } from './optimization/CacheManager.js';
import { MetricsCollector } from './optimization/MetricsCollector.js';

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

export class LargeListOptimizer<T> {
  private config: ListOptimizationConfig;
  private dataSource: ListDataSource<T>;
  private cacheManager: ListCacheManager<T>;
  private chunkLoader: ListChunkLoader;
  private preloader: ListPreloader;
  private accessPattern: number[] = [];
  private cache: CacheManager<T>;
  private metricsCollector: MetricsCollector;
  private loadingChunks = new Map<string, { start: number; end: number; promise: Promise<unknown>; requestTime: number }>();
  private metrics: OptimizationMetrics;
  private eventHandlers = new Map<string, Set<Function>>();
  private lastFrameTime = performance.now();
  private debounceTimer: Timer | null = null;

  constructor(
    dataSource: ListDataSource<T>,
    config: Partial<ListOptimizationConfig> = {}
  ) {
    this.dataSource = dataSource;
    this.config = this.createDefaultConfig(config);
    this.metrics = this.createDefaultMetrics();
    this.cacheManager = new ListCacheManager<T>(this.config.cacheSize);
    this.cache = new CacheManager<T>({
      enableCaching: this.config.enableCaching,
      cacheSize: this.config.cacheSize
    });
    this.metricsCollector = new MetricsCollector();
    this.chunkLoader = new ListChunkLoader();
    this.preloader = new ListPreloader(this.config.preloadDistance);
    this.updateTotalItems();
  }

  private createDefaultConfig(config: Partial<ListOptimizationConfig>): ListOptimizationConfig {
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

  private createDefaultMetrics(): ListOptimizationMetrics {
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
        smoothnessScore: 100,
      },
    };
  }

  private async updateTotalItems(): Promise<void> {
    this.metrics.totalItems = this.dataSource.getTotal();
    this.emit('metricsUpdated', this.metrics);
  }

  public async getItem(index: number): Promise<T | null> {
    if (index < 0 || index >= this.metrics.totalItems) {
      return null;
    }

    this.recordAccess(index);

    // Check cache first
    const cached = this.cache.get(index);
    if (cached != null) {
      this.updateCacheMetrics();
      return cached;
    }

    // Load item (potentially with chunking)
    if (this.config.enableLazyLoading) {
      return this.loadItemWithChunking(index);
    } else {
      const item = await this.dataSource.getItem(index);
      this.cache.set(index, item);
      return item;
    }
  }

  public async getItems(start: number, count: number): Promise<(T | null)[]> {
    const items: (T | null)[] = [];
    const uncachedRanges: { start: number; count: number }[] = [];

    // Collect cached items and identify gaps
    let currentGapStart = -1;

    for (let i = start; i < start + count; i++) {
      if (i >= this.metrics.totalItems) {
        items.push(null);
        continue;
      }

      const cached = this.config.enableCaching ? this.cache.get(i) : null;
      if (cached) {
        items.push(cached.item);
        cached.accessCount++;
        cached.lastAccess = Date.now();

        // Close current gap if any
        if (currentGapStart !== -1) {
          uncachedRanges.push({
            start: currentGapStart,
            count: i - currentGapStart,
          });
          currentGapStart = -1;
        }
      } else {
        items.push(null); // Placeholder
        if (currentGapStart === -1) {
          currentGapStart = i;
        }
      }
    }

    // Close final gap if any
    if (currentGapStart !== -1) {
      uncachedRanges.push({
        start: currentGapStart,
        count: start + count - currentGapStart,
      });
    }

    // Load uncached ranges
    for (const range of uncachedRanges) {
      try {
        const loadedItems = await this.loadItemsWithChunking(
          range.start,
          range.count
        );

        this.assignLoadedItems(loadedItems, range.start, start, items);
      } catch (error) {
        this.emit('loadError', { range, error });
      }
    }

    this.updateCacheMetrics();
    return items;
  }

  private async loadItemWithChunking(index: number): Promise<T | null> {
    const chunkStart =
      Math.floor(index / this.config.chunkSize) * this.config.chunkSize;
    const chunkKey = `${chunkStart}-${chunkStart + this.config.chunkSize}`;

    // Check if chunk is already loading
    const existingChunk = this.loadingChunks.get(chunkKey);
    if (existingChunk) {
      await existingChunk.promise;
      const cached = this.cache.get(index);
      return cached ? cached.item : null;
    }

    // Start loading chunk
    const loadingChunk: LoadingChunk = {
      start: chunkStart,
      end: Math.min(
        chunkStart + this.config.chunkSize,
        this.metrics.totalItems
      ),
      promise: this.loadChunk(chunkStart, this.config.chunkSize),
      requestTime: performance.now(),
    };

    this.loadingChunks.set(chunkKey, loadingChunk);
    this.metrics.activeLoaders++;

    try {
      await loadingChunk.promise;
      const cached = this.cache.get(index);
      return cached ? cached.item : null;
    } finally {
      this.loadingChunks.delete(chunkKey);
      this.metrics.activeLoaders--;
    }
  }

  private async loadItemsWithChunking(
    start: number,
    count: number
  ): Promise<T[]> {
    const items: T[] = [];
    const chunks: Promise<void>[] = [];

    // Break request into chunks
    for (let i = 0; i < count; i += this.config.chunkSize) {
      const chunkStart = start + i;
      const chunkCount = Math.min(this.config.chunkSize, count - i);

      chunks.push(this.loadChunk(chunkStart, chunkCount));
    }

    // Wait for all chunks
    await Promise.all(chunks);

    // Collect items from cache
    for (let i = start; i < start + count; i++) {
      const cached = this.cache.get(i);
      if (cached) {
        items.push(cached.item);
      }
    }

    return items;
  }

  private async loadChunk(start: number, count: number): Promise<void> {
    const loadStartTime = performance.now();

    try {
      const items = await this.dataSource.getItems(start, count);

      for (let i = 0; i < items.length; i++) {
        this.cacheItem(start + i, items[i]);
      }

      const loadTime = performance.now() - loadStartTime;
      this.updateLoadTimeMetric(loadTime);

      this.emit('chunkLoaded', { start, count: items.length, loadTime });
    } catch (error) {
      this.emit('chunkLoadError', { start, count, error });
      throw error;
    }
  }

  private cacheItem(index: number, item: T): void {
    if (!this.config.enableCaching) return;

    // Check cache size limit
    if (this.cache.size >= this.config.cacheSize) {
      this.evictLRU();
    }

    this.cache.set(index, {
      item,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
    });

    this.metrics.cachedItems = this.cache.size;
  }

  private evictLRU(): void {
    let oldestTime = Date.now();
    let oldestIndex = -1;

    for (const [index, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestIndex = index;
      }
    }

    if (oldestIndex !== -1) {
      this.cache.delete(oldestIndex);
    }
  }

  private recordAccess(index: number): void {
    this.accessPattern.push(index);

    // Keep access pattern history reasonable
    if (this.accessPattern.length > 1000) {
      this.accessPattern = this.accessPattern.slice(-500);
    }

    // Predict and preload nearby items
    if (this.config.enableLazyLoading) {
      this.predictAndPreload(index);
    }
  }

  private predictAndPreload(currentIndex: number): void {
    // Clear previous debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.performPreload(currentIndex);
    }, this.config.debounceDelay);
  }

  private async performPreload(currentIndex: number): Promise<void> {
    const direction = this.detectScrollDirection();
    const preloadIndices = this.getPreloadIndices(currentIndex, direction);
    this.executePreloadInBackground(preloadIndices);
  }

  private getPreloadIndices(currentIndex: number, direction: string): number[] {
    if (direction === 'down') {
      return this.getDownwardPreloadIndices(currentIndex);
    } else if (direction === 'up') {
      return this.getUpwardPreloadIndices(currentIndex);
    } else {
      return this.getBidirectionalPreloadIndices(currentIndex);
    }
  }

  private getDownwardPreloadIndices(currentIndex: number): number[] {
    const preloadIndices: number[] = [];
    for (let i = 1; i <= this.config.preloadDistance; i++) {
      const index = currentIndex + i;
      if (index < this.metrics.totalItems && !this.cache.has(index)) {
        preloadIndices.push(index);
      }
    }
    return preloadIndices;
  }

  private getUpwardPreloadIndices(currentIndex: number): number[] {
    const preloadIndices: number[] = [];
    for (let i = 1; i <= this.config.preloadDistance; i++) {
      const index = currentIndex - i;
      if (index >= 0 && !this.cache.has(index)) {
        preloadIndices.push(index);
      }
    }
    return preloadIndices;
  }

  private getBidirectionalPreloadIndices(currentIndex: number): number[] {
    const preloadIndices: number[] = [];
    for (let i = 1; i <= this.config.preloadDistance / 2; i++) {
      const upIndex = currentIndex - i;
      const downIndex = currentIndex + i;

      if (upIndex >= 0 && !this.cache.has(upIndex)) {
        preloadIndices.push(upIndex);
      }
      if (downIndex < this.metrics.totalItems && !this.cache.has(downIndex)) {
        preloadIndices.push(downIndex);
      }
    }
    return preloadIndices;
  }

  private executePreloadInBackground(preloadIndices: number[]): void {
    for (const index of preloadIndices.slice(0, 50)) {
      // Limit concurrent preloads
      this.loadItemWithChunking(index).catch(() => {
        // Ignore preload errors
      });
    }
  }

  private assignLoadedItems(loadedItems: T[], rangeStart: number, start: number, items: (T | null)[]): void {
    for (let i = 0; i < loadedItems.length; i++) {
      const index = rangeStart + i;
      const localIndex = index - start;

      if (localIndex >= 0 && localIndex < items.length) {
        items[localIndex] = loadedItems[i];
      }
    }
  }

  private updateCacheMetrics(): void {
    this.metrics.cachedItems = this.cache.size;

    if (this.accessPattern.length > 0) {
      let hits = 0;
      const recentAccesses = this.accessPattern.slice(-100);

      for (const index of recentAccesses) {
        if (this.cache.has(index)) {
          hits++;
        }
      }

      this.metrics.cacheHitRate = (hits / recentAccesses.length) * 100;
    }
  }

  private updateLoadTimeMetric(loadTime: number): void {
    this.metricsCollector.recordLoadTime(loadTime);
  }

  public trackFrameTime(): void {
    if (!this.config.enableMetrics) return;

    const now = performance.now();
    this.metricsCollector.recordFrame(now);
    this.lastFrameTime = now;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  public async search(query: string): Promise<number[]> {
    if (!this.dataSource.search) {
      throw new Error('Data source does not support search');
    }

    const results = await this.dataSource.search(query);
    this.emit('searchComplete', { query, results: results.length });
    return results;
  }

  public async filter(predicate: (item: T) => boolean): Promise<number[]> {
    if (!this.dataSource.filter) {
      throw new Error('Data source does not support filtering');
    }

    const results = await this.dataSource.filter(predicate);
    this.emit('filterComplete', { results: results.length });
    return results;
  }

  public sort(compareFn: (a: T, b: T) => number): void {
    if (!this.dataSource.sort) {
      throw new Error('Data source does not support sorting');
    }

    // Clear cache since sort order changed
    this.clearCache();
    this.dataSource.sort(compareFn);
    this.emit('sortComplete');
  }

  public clearCache(): void {
    this.cache.clear();
    this.loadingChunks.clear();
    this.metrics.cachedItems = 0;
    this.metrics.cacheHitRate = 0;
    this.emit('cacheCleared');
  }

  public warmUpCache(start: number, count: number): Promise<void> {
    return this.loadItemsWithChunking(start, count).then(() => void 0);
  }

  public getMetrics(): OptimizationMetrics {
    // Update metrics from helpers
    const cacheStats = this.cache.getStats();
    const collectedMetrics = this.metricsCollector.getMetrics(
      this.metrics.totalItems,
      cacheStats.size,
      cacheStats.hitRate,
      this.cache.getMemoryUsage()
    );

    return {
      ...this.metrics,
      ...collectedMetrics
    };
  }

  public updateConfig(newConfig: Partial<ListOptimizationConfig>): void {
    const oldCacheSize = this.config.cacheSize;
    this.config = { ...this.config, ...newConfig };

    // Adjust cache size if needed
    if (newConfig.cacheSize != null && newConfig.cacheSize < oldCacheSize) {
      while (this.cache.size > newConfig.cacheSize) {
        this.evictLRU();
      }
    }

    this.emit('configUpdated', this.config);
  }

  public getConfig(): ListOptimizationConfig {
    return { ...this.config };
  }

  public destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.clearCache();
    this.accessPattern = [];
    this.frameTimeHistory = [];
    this.eventHandlers.clear();
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in large list optimizer event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}
