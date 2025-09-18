import { MetricSeries, MetricPoint } from './types';

export class MetricsSeriesManager {
  private series = new Map<string, MetricSeries>();

  ensureSeries(name: string, tags?: Record<string, string>): MetricSeries {
    let series = this.series.get(name);
    if (!series) {
      series = this.createNewSeries(name, tags);
      this.series.set(name, series);
    }
    return series;
  }

  private createNewSeries(
    name: string,
    tags?: Record<string, string>
  ): MetricSeries {
    return {
      name,
      points: [],
      aggregations: {
        count: 0,
        sum: 0,
        avg: 0,
        min: Infinity,
        max: -Infinity,
        p50: 0,
        p95: 0,
        p99: 0,
        latest: 0,
      },
      tags: tags ?? {},
    };
  }

  updateSeriesAggregations(series: MetricSeries): void {
    const values = series.points.map((p) => p.value);
    if (values.length === 0) return;

    const sorted = [...values].sort((a, b) => a - b);

    series.aggregations = {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1],
      p50: this.getPercentile(sorted, 0.5),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99),
    };
  }

  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.floor(sorted.length * percentile);
    return sorted[Math.min(index, sorted.length - 1)] ?? 0;
  }

  getSeries(): Map<string, MetricSeries> {
    return this.series;
  }

  clear(): void {
    this.series.clear();
  }

  getSeriesArray(): MetricSeries[] {
    return Array.from(this.series.values());
  }

  addPointToSeries(
    name: string,
    point: MetricPoint,
    tags?: Record<string, string>
  ): void {
    const series = this.ensureSeries(name, tags);
    series.points.push(point);
    this.updateSeriesAggregations(series);
  }
}
