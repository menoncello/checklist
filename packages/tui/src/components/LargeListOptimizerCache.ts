import { CacheEntry } from './LargeListOptimizerTypes';
import { LargeListOptimizerUtils } from './LargeListOptimizerUtils';

export class LargeListOptimizerCache<T> {
  private cache = new Map<number, CacheEntry<T>>();
  private maxSize: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  public get(index: number): T | null {
    const entry = this.cache.get(index);
    if (entry) {
      entry.accessCount++;
      entry.lastAccess = Date.now();
      this.hitCount++;
      return entry.item;
    }
    this.missCount++;
    return null;
  }

  public set(index: number, item: T): void {
    const now = Date.now();
    const existingEntry = this.cache.get(index);

    if (existingEntry) {
      existingEntry.item = item;
      existingEntry.timestamp = now;
      existingEntry.lastAccess = now;
      existingEntry.accessCount++;
    } else {
      this.cache.set(index, {
        item,
        timestamp: now,
        accessCount: 1,
        lastAccess: now,
      });

      // Check if we need to evict
      if (this.cache.size > this.maxSize) {
        this.evictLRU();
      }
    }
  }

  public has(index: number): boolean {
    return this.cache.has(index);
  }

  public delete(index: number): boolean {
    return this.cache.delete(index);
  }

  public clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  public size(): number {
    return this.cache.size;
  }

  public getHitRate(): number {
    return LargeListOptimizerUtils.calculateCacheHitRate(
      this.hitCount,
      this.missCount
    );
  }

  public getMemoryUsage(): number {
    return LargeListOptimizerUtils.estimateMemoryUsage(this.cache);
  }

  public warmUp(startIndex: number, items: T[]): void {
    items.forEach((item, offset) => {
      this.set(startIndex + offset, item);
    });
  }

  public getItems(indices: number[]): { index: number; item: T }[] {
    const results: { index: number; item: T }[] = [];

    for (const index of indices) {
      const item = this.get(index);
      if (item !== null) {
        results.push({ index, item });
      }
    }

    return results;
  }

  public getMissingIndices(indices: number[]): number[] {
    return indices.filter((index) => !this.has(index));
  }

  public recordAccess(index: number): void {
    const entry = this.cache.get(index);
    if (entry) {
      entry.accessCount++;
      entry.lastAccess = Date.now();
    }
  }

  private evictLRU(): void {
    const evictionTargets = LargeListOptimizerUtils.getEvictionTargets(
      this.cache,
      Math.floor(this.maxSize * 0.8) // Evict to 80% capacity
    );

    for (const index of evictionTargets) {
      this.cache.delete(index);
    }
  }

  public getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.getHitRate(),
      memoryUsage: this.getMemoryUsage(),
    };
  }

  public entries(): IterableIterator<[number, CacheEntry<T>]> {
    return this.cache.entries();
  }
}
