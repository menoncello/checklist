import { LargeListOptimizerCache } from './LargeListOptimizerCache';
import {
  ListOptimizationConfig,
  ListDataSource,
  OptimizationMetrics,
  LoadingChunk,
} from './LargeListOptimizerTypes';
import { LargeListOptimizerUtils } from './LargeListOptimizerUtils';
import { ListCacheManager } from './ListCacheManager';
import { ListChunkLoader } from './ListChunkLoader';
import { ListPreloader } from './ListPreloader';
import { MetricsCollector } from './optimization/MetricsCollector';

export * from './LargeListOptimizerTypes';

export class LargeListOptimizer<T> {
  private config: ListOptimizationConfig;
  private dataSource: ListDataSource<T>;
  private cacheManager: ListCacheManager<T>;
  private chunkLoader: ListChunkLoader;
  private preloader: ListPreloader;
  private accessPattern: number[] = [];
  private optimizerCache: LargeListOptimizerCache<T>;
  private metricsCollector: MetricsCollector;
  private loadingChunks = new Map<string, LoadingChunk>();
  private metrics: OptimizationMetrics;
  private eventHandlers = new Map<string, Set<Function>>();
  private lastFrameTime = performance.now();
  private debounceTimer: Timer | null = null;
  private frameTimeHistory: number[] = [];

  constructor(
    dataSource: ListDataSource<T>,
    config: Partial<ListOptimizationConfig> = {}
  ) {
    this.dataSource = dataSource;
    this.config = LargeListOptimizerUtils.createDefaultConfig(config);
    this.metrics = LargeListOptimizerUtils.createDefaultMetrics();
    this.cacheManager = new ListCacheManager<T>(this.config.cacheSize);
    this.optimizerCache = new LargeListOptimizerCache<T>(this.config.cacheSize);
    this.metricsCollector = new MetricsCollector();
    this.chunkLoader = new ListChunkLoader();
    this.preloader = new ListPreloader(this.config.preloadDistance);
    this.updateTotalItems();
  }

  private async updateTotalItems(): Promise<void> {
    this.metrics.totalItems = this.dataSource.getTotal();
  }

  public async getItem(index: number): Promise<T | null> {
    if (this.config.enableCaching && this.optimizerCache.has(index)) {
      const cached = this.optimizerCache.get(index);
      this.recordAccess(index);
      this.predictAndPreload(index);
      return cached;
    }

    try {
      const item = await this.dataSource.getItem(index);
      if (this.config.enableCaching && item !== null) {
        this.optimizerCache.set(index, item);
      }
      this.recordAccess(index);
      this.predictAndPreload(index);
      return item;
    } catch (error) {
      this.emit('loadError', { index, error });
      return null;
    }
  }

  public async getItems(start: number, count: number): Promise<(T | null)[]> {
    const items = this.initializeItemsArray(start, count);
    const missingIndices = this.getCachedItemsAndFindMissing(
      start,
      count,
      items
    );

    if (missingIndices.length > 0) {
      await this.loadMissingItems(start, count, items);
    }

    this.updateCacheMetrics();
    return items;
  }

  private initializeItemsArray(start: number, count: number): (T | null)[] {
    return Array.from({ length: count }, () => null);
  }

  private getCachedItemsAndFindMissing(
    start: number,
    count: number,
    items: (T | null)[]
  ): number[] {
    const requestedIndices = Array.from({ length: count }, (_, i) => start + i);
    const cachedItems = this.optimizerCache.getItems(requestedIndices);
    const cachedIndices = new Set(cachedItems.map((item) => item.index));

    // Fill in cached items
    for (let i = 0; i < count; i++) {
      const index = start + i;
      if (cachedIndices.has(index)) {
        const cached = cachedItems.find((item) => item.index === index);
        items[i] = cached ? cached.item : null;
      }
    }

    return this.optimizerCache.getMissingIndices(requestedIndices);
  }

  private async loadMissingItems(
    start: number,
    count: number,
    items: (T | null)[]
  ): Promise<void> {
    try {
      const loadedItems = await this.dataSource.getItems(start, count);
      this.cacheMissingItems(start, loadedItems, items);
    } catch (error) {
      this.emit('loadError', { start, count, error });
    }
  }

  private cacheMissingItems(
    start: number,
    loadedItems: (T | null)[],
    items: (T | null)[]
  ): void {
    for (let i = 0; i < loadedItems.length; i++) {
      const loadedItem = loadedItems[i];
      if (loadedItem !== null) {
        const index = start + i;
        this.optimizerCache.set(index, loadedItem);
        items[i] = loadedItem;
      }
    }
  }

  public async search(query: string): Promise<number[]> {
    if (this.dataSource.search) {
      return await this.dataSource.search(query);
    }
    return [];
  }

  public async filter(predicate: (item: T) => boolean): Promise<number[]> {
    if (this.dataSource.filter) {
      return await this.dataSource.filter(predicate);
    }
    return [];
  }

  public sort(compareFn: (a: T, b: T) => number): void {
    if (this.dataSource.sort) {
      this.dataSource.sort(compareFn);
      this.clearCache();
    }
  }

  public clearCache(): void {
    this.optimizerCache.clear();
    this.metrics.cachedItems = 0;
    this.metrics.cacheHitRate = 0;
    this.emit('cacheCleared');
  }

  public async warmUpCache(start: number, count: number): Promise<void> {
    await this.getItems(start, count);
  }

  public getMetrics(): OptimizationMetrics {
    const cacheStats = this.optimizerCache.getStats();
    return {
      ...this.metrics,
      cachedItems: cacheStats.size,
      cacheHitRate: cacheStats.hitRate,
      memoryUsage: cacheStats.memoryUsage,
    };
  }

  public updateConfig(newConfig: Partial<ListOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update cache size if changed
    if (
      newConfig.cacheSize != null &&
      newConfig.cacheSize !== this.config.cacheSize
    ) {
      this.optimizerCache = new LargeListOptimizerCache<T>(newConfig.cacheSize);
    }

    this.emit('configUpdated', { config: this.config });
  }

  public getConfig(): ListOptimizationConfig {
    return { ...this.config };
  }

  public destroy(): void {
    this.clearCache();
    this.loadingChunks.clear();
    this.eventHandlers.clear();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.emit('destroyed');
  }

  public trackFrameTime(): void {
    const scrollMetrics = LargeListOptimizerUtils.updateScrollMetrics(
      this.frameTimeHistory,
      this.lastFrameTime
    );

    this.metrics.scrollPerformance = {
      averageFPS: scrollMetrics.averageFPS,
      frameDrops: scrollMetrics.frameDrops,
      smoothnessScore: scrollMetrics.smoothnessScore,
    };

    this.lastFrameTime = scrollMetrics.lastScrollTime;
  }

  private recordAccess(index: number): void {
    this.accessPattern.push(index);
    if (this.accessPattern.length > 100) {
      this.accessPattern.shift();
    }
    this.optimizerCache.recordAccess(index);
  }

  private predictAndPreload(currentIndex: number): void {
    if (!this.config.enableLazyLoading) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.performPreload(currentIndex);
    }, this.config.debounceDelay);
  }

  private async performPreload(currentIndex: number): Promise<void> {
    const direction = LargeListOptimizerUtils.detectScrollDirection(
      this.accessPattern
    );
    const preloadIndices = LargeListOptimizerUtils.getPreloadIndices(
      currentIndex,
      direction,
      this.config.preloadDistance,
      this.metrics.totalItems
    );

    const missingIndices =
      this.optimizerCache.getMissingIndices(preloadIndices);

    if (missingIndices.length > 0) {
      this.executePreloadInBackground(missingIndices);
    }
  }

  private executePreloadInBackground(preloadIndices: number[]): void {
    Promise.all(preloadIndices.map((index) => this.getItem(index))).catch(
      (error) => {
        this.emit('preloadError', { indices: preloadIndices, error });
      }
    );
  }

  private updateCacheMetrics(): void {
    const cacheStats = this.optimizerCache.getStats();
    this.metrics.cachedItems = cacheStats.size;
    this.metrics.cacheHitRate = cacheStats.hitRate;
    this.metrics.memoryUsage = cacheStats.memoryUsage;
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  public off(event: string, handler: Function): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in list optimizer event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}
