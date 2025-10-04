export class MeasurementMethods {
  private startBenchmark: (name: string, category?: string) => string;
  private endBenchmark: (benchmarkId: string) => void;
  private config: { enableBenchmarks: boolean };

  constructor(
    startBenchmark: (name: string, category?: string) => string,
    endBenchmark: (benchmarkId: string) => void,
    config: { enableBenchmarks: boolean }
  ) {
    this.startBenchmark = startBenchmark;
    this.endBenchmark = endBenchmark;
    this.config = config;
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name?: string,
    category: string = 'functions'
  ): T {
    if (!this.config.enableBenchmarks) {
      return fn;
    }

    return ((...args: Parameters<T>) => {
      const benchmarkId = this.startBenchmark(
        name ?? fn.name ?? 'anonymous',
        category
      );
      try {
        const result = fn(...args);
        this.endBenchmark(benchmarkId);
        return result;
      } catch (error) {
        this.endBenchmark(benchmarkId);
        throw error;
      }
    }) as T;
  }

  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async-ops'
  ): Promise<T> {
    if (!this.config.enableBenchmarks) {
      return promise;
    }

    const benchmarkId = this.startBenchmark(name, category);
    try {
      const result = await promise;
      this.endBenchmark(benchmarkId);
      return result;
    } catch (error) {
      this.endBenchmark(benchmarkId);
      throw error;
    }
  }
}
