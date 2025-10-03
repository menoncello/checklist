export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface MetricFilter {
  name?: string;
  tags?: Record<string, string>;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export class MetricsTracker {
  private metrics: PerformanceMetric[] = [];
  private marks = new Map<string, number>();

  constructor(private bufferSize: number = 10000) {}

  public mark(name: string): number {
    const timestamp = performance.now();
    this.marks.set(name, timestamp);
    return timestamp;
  }

  public measure(name: string, startMark: string, endMark: string): number {
    const startTime = this.marks.get(startMark);
    const endTime = this.marks.get(endMark);

    if (startTime == null || endTime == null) {
      throw new Error(`Invalid marks: ${startMark} or ${endMark} not found`);
    }

    const duration = endTime - startTime;
    this.recordMetric({
      id: `measure-${Date.now()}-${Math.random()}`,
      name,
      value: duration,
      timestamp: Date.now(),
      metadata: { type: 'measure', startMark, endMark },
    });

    return duration;
  }

  public recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    if (this.metrics.length > this.bufferSize) {
      this.metrics = this.metrics.slice(-this.bufferSize);
    }
  }

  public recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    this.recordMetric({
      id: `metric-${Date.now()}-${Math.random()}`,
      name,
      value,
      timestamp: Date.now(),
      tags,
      metadata,
    });
  }

  public getMetrics(filter?: MetricFilter): PerformanceMetric[] {
    let result = this.metrics;

    if (filter != null) {
      if (filter.name != null) {
        result = result.filter((m) => m.name === filter.name);
      }

      if (filter.startTime != null) {
        const startTime = filter.startTime;
        result = result.filter((m) => m.timestamp >= startTime);
      }

      if (filter.endTime != null) {
        const endTime = filter.endTime;
        result = result.filter((m) => m.timestamp <= endTime);
      }

      if (filter.tags != null) {
        const filterTags = filter.tags;
        result = result.filter((m) => {
          if (m.tags == null) return false;
          return Object.entries(filterTags).every(
            ([key, value]) => m.tags?.[key] === value
          );
        });
      }

      if (filter.limit != null) {
        result = result.slice(-filter.limit);
      }
    }

    return result;
  }

  public getStatistics(metricName: string): {
    count: number;
    min: number;
    max: number;
    average: number;
    median: number;
    p95: number;
  } {
    const values = this.metrics
      .filter((m) => m.name === metricName)
      .map((m) => m.value)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, average: 0, median: 0, p95: 0 };
    }

    const sum = values.reduce((acc, val) => acc + val, 0);
    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      average: sum / values.length,
      median: this.percentile(values, 50),
      p95: this.percentile(values, 95),
    };
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((values.length * p) / 100) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }

  public clear(): void {
    this.metrics = [];
    this.marks.clear();
  }

  public count(): number {
    return this.metrics.length;
  }

  public getMarks(): Map<string, number> {
    return this.marks;
  }
}
