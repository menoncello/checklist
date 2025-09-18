import { MetricSeries, MetricQuery } from './types';

export class MetricsQueryEngine {
  query(series: Map<string, MetricSeries>, query: MetricQuery): MetricSeries[] {
    let results = Array.from(series.values());

    // Filter by name
    if (typeof query.name === 'string' && query.name !== '') {
      const name = query.name;
      results = results.filter((s) => s.name.includes(name));
    }

    // Filter by tags
    if (query.tags) {
      results = this.filterByTags(results, query.tags);
    }

    // Filter by time range
    if (query.timeRange) {
      results = this.filterByTimeRange(results, query.timeRange);
    }

    // Apply limit to points
    if (typeof query.limit === 'number' && query.limit > 0) {
      results = this.applyLimit(results, query.limit);
    }

    return results;
  }

  private filterByTags(
    series: MetricSeries[],
    tags: Record<string, string>
  ): MetricSeries[] {
    return series.filter((s) => {
      for (const [key, value] of Object.entries(tags)) {
        if (s.tags[key] !== value) return false;
      }
      return true;
    });
  }

  private filterByTimeRange(
    series: MetricSeries[],
    timeRange: { start: number; end: number }
  ): MetricSeries[] {
    return series
      .map((s) => ({
        ...s,
        points: s.points.filter(
          (p) => p.timestamp >= timeRange.start && p.timestamp <= timeRange.end
        ),
      }))
      .filter((s) => s.points.length > 0);
  }

  private applyLimit(series: MetricSeries[], limit: number): MetricSeries[] {
    return series.map((s) => ({
      ...s,
      points: s.points.slice(-limit),
    }));
  }

  extractCommonTags(
    points: { tags?: Record<string, string> }[]
  ): Record<string, string> {
    if (points.length === 0) return {};

    const firstTags = points[0].tags ?? {};
    const commonTags: Record<string, string> = {};

    for (const [key, value] of Object.entries(firstTags)) {
      if (points.every((p) => p.tags?.[key] === value)) {
        commonTags[key] = value;
      }
    }

    return commonTags;
  }
}
