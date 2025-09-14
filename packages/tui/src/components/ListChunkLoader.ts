export interface LoadingChunk {
  start: number;
  end: number;
  promise: Promise<unknown>;
  requestTime: number;
}

export interface ChunkLoadMetrics {
  activeLoaders: number;
  averageLoadTime: number;
  totalLoadTime: number;
  loadCount: number;
}

export class ListChunkLoader {
  private loadingChunks = new Map<string, LoadingChunk>();
  private loadTimes: number[] = [];
  private maxLoadTimeHistory = 100;

  getLoadingChunk(key: string): LoadingChunk | undefined {
    return this.loadingChunks.get(key);
  }

  registerChunk(
    key: string,
    start: number,
    end: number,
    promise: Promise<unknown>
  ): void {
    this.loadingChunks.set(key, {
      start,
      end,
      promise,
      requestTime: performance.now(),
    });
  }

  unregisterChunk(key: string): void {
    const chunk = this.loadingChunks.get(key);
    if (chunk) {
      const loadTime = performance.now() - chunk.requestTime;
      this.recordLoadTime(loadTime);
      this.loadingChunks.delete(key);
    }
  }

  private recordLoadTime(time: number): void {
    this.loadTimes.push(time);
    if (this.loadTimes.length > this.maxLoadTimeHistory) {
      this.loadTimes.shift();
    }
  }

  getMetrics(): ChunkLoadMetrics {
    const activeLoaders = this.loadingChunks.size;
    const totalLoadTime = this.loadTimes.reduce((sum, t) => sum + t, 0);
    const loadCount = this.loadTimes.length;
    const averageLoadTime = loadCount > 0 ? totalLoadTime / loadCount : 0;

    return {
      activeLoaders,
      averageLoadTime,
      totalLoadTime,
      loadCount,
    };
  }

  isLoading(key: string): boolean {
    return this.loadingChunks.has(key);
  }

  clearAll(): void {
    this.loadingChunks.clear();
    this.loadTimes = [];
  }

  getActiveChunkKeys(): string[] {
    return Array.from(this.loadingChunks.keys());
  }
}