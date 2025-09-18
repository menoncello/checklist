import { MetricPoint, MetricSeries, MetricQuery } from './types';

export class MetricsAggregator {
  public calculateAggregations(
    points: MetricPoint[]
  ): MetricSeries['aggregations'] {
    if (points.length === 0) {
      return this.getEmptyAggregations();
    }

    const values = points.map((p) => p.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p50: this.calculatePercentile(values, 50),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99),
      latest: points[points.length - 1]?.value || 0,
    };
  }

  private getEmptyAggregations(): MetricSeries['aggregations'] {
    return {
      count: 0,
      sum: 0,
      avg: 0,
      min: 0,
      max: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      latest: 0,
    };
  }

  private calculatePercentile(
    sortedValues: number[],
    percentile: number
  ): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  public querySeries(
    series: Map<string, MetricSeries>,
    query: MetricQuery
  ): MetricSeries[] {
    let results = Array.from(series.values());

    results = this.filterByName(results, query.name);
    results = this.filterByTags(results, query.tags);
    results = this.filterByTimeRange(results, query.timeRange);
    results = this.applyLimit(results, query.limit);

    return results;
  }

  private filterByName(series: MetricSeries[], name?: string): MetricSeries[] {
    return name != null && name !== ''
      ? series.filter((s) => s.name.includes(name))
      : series;
  }

  private filterByTags(
    series: MetricSeries[],
    tags?: Record<string, string>
  ): MetricSeries[] {
    if (!tags) return series;

    return series.filter((s) => {
      return Object.entries(tags).every(
        ([key, value]) => s.tags[key] === value
      );
    });
  }

  private filterByTimeRange(
    series: MetricSeries[],
    timeRange?: { start: number; end: number }
  ): MetricSeries[] {
    if (!timeRange) return series;

    return series.map((s) => ({
      ...s,
      points: s.points.filter(
        (p) => p.timestamp >= timeRange.start && p.timestamp <= timeRange.end
      ),
    }));
  }

  private applyLimit(series: MetricSeries[], limit?: number): MetricSeries[] {
    return limit != null && limit > 0 ? series.slice(0, limit) : series;
  }

  public aggregateByTime(
    points: MetricPoint[],
    interval: number
  ): MetricPoint[] {
    if (points.length === 0) return [];

    const buckets = new Map<number, MetricPoint[]>();

    for (const point of points) {
      const bucketTime = Math.floor(point.timestamp / interval) * interval;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      const bucket = buckets.get(bucketTime);
      if (bucket != null) {
        bucket.push(point);
      }
    }

    return Array.from(buckets.entries()).map(([timestamp, bucketPoints]) => ({
      timestamp,
      value:
        bucketPoints.reduce((sum, p) => sum + p.value, 0) / bucketPoints.length,
      tags: bucketPoints[0]?.tags ?? {},
      metadata: { aggregated: true, count: bucketPoints.length },
    }));
  }

  public aggregateByTags(points: MetricPoint[]): Map<string, MetricPoint[]> {
    const groups = new Map<string, MetricPoint[]>();

    for (const point of points) {
      const tagKey = JSON.stringify(point.tags ?? {});
      if (!groups.has(tagKey)) {
        groups.set(tagKey, []);
      }
      const group = groups.get(tagKey);
      if (group != null) {
        group.push(point);
      }
    }

    return groups;
  }
}
