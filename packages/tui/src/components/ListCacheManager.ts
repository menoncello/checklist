export interface CacheEntry<T> {
  item: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

export class ListCacheManager<T> {
  private cache = new Map<number, CacheEntry<T>>();
  private cacheSize: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(cacheSize: number) {
    this.cacheSize = cacheSize;
  }

  get(index: number): CacheEntry<T> | undefined {
    const entry = this.cache.get(index);
    if (entry) {
      entry.accessCount++;
      entry.lastAccess = Date.now();
      this.hitCount++;
    } else {
      this.missCount++;
    }
    return entry;
  }

  set(index: number, item: T): void {
    if (this.cache.size >= this.cacheSize) {
      this.evictLRU();
    }

    this.cache.set(index, {
      item,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
    });
  }

  has(index: number): boolean {
    return this.cache.has(index);
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
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

  getCacheMetrics(): {
    size: number;
    hitRate: number;
    hitCount: number;
    missCount: number;
  } {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hitRate: total > 0 ? this.hitCount / total : 0,
      hitCount: this.hitCount,
      missCount: this.missCount,
    };
  }
}
