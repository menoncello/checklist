export interface CacheEntry<T> {
  item: T;
  index: number;
  lastAccess: number;
  accessCount: number;
}

export interface CacheRange {
  start: number;
  count: number;
}

export class ListCacheManager<T> {
  private cache: Map<number, CacheEntry<T>>;
  private readonly enableCaching: boolean;

  constructor(enableCaching: boolean) {
    this.cache = new Map();
    this.enableCaching = enableCaching;
  }

  get(index: number): CacheEntry<T> | null {
    if (!this.enableCaching) return null;
    return this.cache.get(index) ?? null;
  }

  set(index: number, item: T): void {
    if (!this.enableCaching) return;
    this.cache.set(index, {
      item,
      index,
      lastAccess: Date.now(),
      accessCount: 1,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  updateAccess(entry: CacheEntry<T>): void {
    entry.accessCount++;
    entry.lastAccess = Date.now();
  }

  collectUncachedRanges(start: number, count: number, totalItems: number): {
    items: (T | null)[];
    uncachedRanges: CacheRange[];
  } {
    const items: (T | null)[] = [];
    const uncachedRanges: CacheRange[] = [];
    let currentGapStart = -1;

    for (let i = start; i < start + count; i++) {
      const result = this.processIndex(i, totalItems, currentGapStart, uncachedRanges);
      items.push(result.item);
      currentGapStart = result.gapStart;
    }

    this.closeGap(currentGapStart, start + count, uncachedRanges);
    return { items, uncachedRanges };
  }

  private processIndex(
    index: number,
    totalItems: number,
    currentGapStart: number,
    uncachedRanges: CacheRange[]
  ): { item: T | null; gapStart: number } {
    if (index >= totalItems) {
      return { item: null, gapStart: currentGapStart };
    }

    const cached = this.get(index);
    if (cached) {
      this.updateAccess(cached);
      if (currentGapStart !== -1) {
        uncachedRanges.push({
          start: currentGapStart,
          count: index - currentGapStart,
        });
      }
      return { item: cached.item, gapStart: -1 };
    }

    return { item: null, gapStart: currentGapStart === -1 ? index : currentGapStart };
  }

  private closeGap(gapStart: number, endIndex: number, uncachedRanges: CacheRange[]): void {
    if (gapStart !== -1) {
      uncachedRanges.push({
        start: gapStart,
        count: endIndex - gapStart,
      });
    }
  }

  assignLoadedItems<T>(
    loadedItems: T[],
    rangeStart: number,
    requestStart: number,
    targetArray: (T | null)[]
  ): void {
    for (let j = 0; j < loadedItems.length; j++) {
      const item = loadedItems[j];
      const globalIndex = rangeStart + j;
      const arrayIndex = globalIndex - requestStart;

      if (arrayIndex >= 0 && arrayIndex < targetArray.length) {
        targetArray[arrayIndex] = item;
        this.set(globalIndex, item);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}