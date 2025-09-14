export interface CacheEntry<T> {
  item: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

export interface CacheConfig {
  enableCaching: boolean;
  cacheSize: number;
  maxAge?: number;
}

export class CacheManager<T> {
  private cache = new Map<number, CacheEntry<T>>();
  private accessOrder: number[] = [];

  constructor(private config: CacheConfig) {}

  get(index: number): T | null {
    if (!this.config.enableCaching) return null;

    const entry = this.cache.get(index);
    if (!entry) return null;

    // Check if entry is expired
    if (this.config.maxAge && Date.now() - entry.timestamp > this.config.maxAge) {
      this.delete(index);
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.updateAccessOrder(index);

    return entry.item;
  }

  set(index: number, item: T): void {
    if (!this.config.enableCaching) return;

    const entry: CacheEntry<T> = {
      item,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now()
    };

    this.cache.set(index, entry);
    this.updateAccessOrder(index);
    this.enforceCacheSize();
  }

  delete(index: number): boolean {
    const deleted = this.cache.delete(index);
    if (deleted) {
      this.accessOrder = this.accessOrder.filter(i => i !== index);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  has(index: number): boolean {
    return this.cache.has(index);
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): {
    size: number;
    hitRate: number;
    oldestEntry: number;
    averageAge: number;
  } {
    const now = Date.now();
    let totalHits = 0;
    let totalAccesses = 0;
    let oldestTime = now;
    let totalAge = 0;

    this.cache.forEach((entry) => {
      totalHits += entry.accessCount;
      totalAccesses++;
      totalAge += now - entry.timestamp;
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
      }
    });

    return {
      size: this.cache.size,
      hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
      oldestEntry: now - oldestTime,
      averageAge: totalAccesses > 0 ? totalAge / totalAccesses : 0
    };
  }

  private updateAccessOrder(index: number): void {
    // Remove from current position
    this.accessOrder = this.accessOrder.filter(i => i !== index);
    // Add to end (most recently used)
    this.accessOrder.push(index);
  }

  private enforceCacheSize(): void {
    while (this.cache.size > this.config.cacheSize) {
      // Remove least recently used item
      const lruIndex = this.accessOrder.shift();
      if (lruIndex !== undefined) {
        this.cache.delete(lruIndex);
      }
    }
  }

  getMemoryUsage(): number {
    // Rough estimation of memory usage
    return this.cache.size * 200; // Approximate bytes per entry
  }

  cleanup(): void {
    if (!this.config.maxAge) return;

    const now = Date.now();
    const toDelete: number[] = [];

    this.cache.forEach((entry, index) => {
      if (now - entry.timestamp > this.config.maxAge!) {
        toDelete.push(index);
      }
    });

    toDelete.forEach(index => this.delete(index));
  }
}