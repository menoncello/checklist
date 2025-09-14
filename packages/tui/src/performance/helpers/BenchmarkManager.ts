export interface PerformanceBenchmark {
  id: string;
  name: string;
  category: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface BenchmarkFilter {
  name?: string;
  category?: string;
  completed?: boolean;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export class BenchmarkManager {
  private benchmarks: PerformanceBenchmark[] = [];
  private activeBenchmarks = new Map<string, PerformanceBenchmark>();

  constructor(private bufferSize: number = 5000) {}

  public startBenchmark(
    name: string,
    category: string = 'general',
    metadata?: Record<string, unknown>
  ): string {
    const id = `bench-${Date.now()}-${Math.random()}`;
    const benchmark: PerformanceBenchmark = {
      id,
      name,
      category,
      startTime: performance.now(),
      metadata
    };

    this.activeBenchmarks.set(id, benchmark);
    return id;
  }

  public endBenchmark(id: string): PerformanceBenchmark | null {
    const benchmark = this.activeBenchmarks.get(id);
    if (benchmark == null) {
      return null;
    }

    const endTime = performance.now();
    const completedBenchmark: PerformanceBenchmark = {
      ...benchmark,
      endTime,
      duration: endTime - benchmark.startTime
    };

    this.activeBenchmarks.delete(id);
    this.benchmarks.push(completedBenchmark);

    if (this.benchmarks.length > this.bufferSize) {
      this.benchmarks = this.benchmarks.slice(-this.bufferSize);
    }

    return completedBenchmark;
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    category: string = 'function'
  ): T {
    return ((...args: Parameters<T>): ReturnType<T> => {
      const benchmarkId = this.startBenchmark(name, category, {
        type: 'function',
        functionName: fn.name || 'anonymous'
      });

      try {
        const result = fn(...args) as ReturnType<T>;
        this.endBenchmark(benchmarkId);
        return result;
      } catch (error) {
        const benchmark = this.endBenchmark(benchmarkId);
        if (benchmark != null) {
          benchmark.metadata = {
            ...benchmark.metadata,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
        throw error;
      }
    }) as T;
  }

  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async'
  ): Promise<T> {
    const benchmarkId = this.startBenchmark(name, category, { type: 'async' });

    try {
      const result = await promise;
      this.endBenchmark(benchmarkId);
      return result;
    } catch (error) {
      const benchmark = this.endBenchmark(benchmarkId);
      if (benchmark != null) {
        benchmark.metadata = {
          ...benchmark.metadata,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      throw error;
    }
  }

  public getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[] {
    let result = this.benchmarks;

    if (filter != null) {
      if (filter.name != null) {
        result = result.filter(b => b.name === filter.name);
      }

      if (filter.category != null) {
        result = result.filter(b => b.category === filter.category);
      }

      if (filter.completed != null) {
        result = result.filter(b => {
          const isCompleted = b.endTime != null;
          return filter.completed === isCompleted;
        });
      }

      if (filter.startTime != null) {
        result = result.filter(b => b.startTime >= filter.startTime!);
      }

      if (filter.endTime != null) {
        result = result.filter(b =>
          b.endTime != null && b.endTime <= filter.endTime!
        );
      }

      if (filter.limit != null) {
        result = result.slice(-filter.limit);
      }
    }

    return result;
  }

  public getActiveBenchmarks(): PerformanceBenchmark[] {
    return Array.from(this.activeBenchmarks.values());
  }

  public cancelBenchmark(id: string): boolean {
    return this.activeBenchmarks.delete(id);
  }

  public clear(): void {
    this.benchmarks = [];
    this.activeBenchmarks.clear();
  }

  public count(): number {
    return this.benchmarks.length;
  }

  public getActiveCount(): number {
    return this.activeBenchmarks.size;
  }
}