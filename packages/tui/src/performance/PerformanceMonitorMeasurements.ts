import { MeasurementMethods } from './MeasurementMethods';

export class PerformanceMonitorMeasurements {
  constructor(private measurementMethods: MeasurementMethods) {}

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name?: string,
    category: string = 'functions'
  ): T {
    return this.measurementMethods.measureFunction(fn, name, category);
  }

  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async-ops'
  ): Promise<T> {
    return this.measurementMethods.measureAsync(promise, name, category);
  }
}
