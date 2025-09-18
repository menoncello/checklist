import { beforeEach, describe, expect, test } from 'bun:test';
import { MetricsAggregator } from '../../../src/performance/metrics/MetricsAggregator';
import { MetricPoint, MetricSeries, MetricQuery } from '../../../src/performance/metrics/types';

describe('MetricsAggregator', () => {
  let aggregator: MetricsAggregator;

  beforeEach(() => {
    aggregator = new MetricsAggregator();
  });

  describe('calculateAggregations', () => {
    test('should return empty aggregations for empty array', () => {
      const result = aggregator.calculateAggregations([]);

      expect(result).toEqual({
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        latest: 0,
      });
    });

    test('should calculate aggregations for single point', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 42, tags: {}, metadata: {} }
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result).toEqual({
        count: 1,
        sum: 42,
        avg: 42,
        min: 42,
        max: 42,
        p50: 42,
        p95: 42,
        p99: 42,
        latest: 42,
      });
    });

    test('should calculate aggregations for multiple points', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10, tags: {}, metadata: {} },
        { timestamp: 2000, value: 20, tags: {}, metadata: {} },
        { timestamp: 3000, value: 30, tags: {}, metadata: {} },
        { timestamp: 4000, value: 40, tags: {}, metadata: {} },
        { timestamp: 5000, value: 50, tags: {}, metadata: {} },
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result).toEqual({
        count: 5,
        sum: 150,
        avg: 30,
        min: 10,
        max: 50,
        p50: 30,
        p95: 48,
        p99: 49.6,
        latest: 50,
      });
    });

    test('should sort values correctly for aggregations', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 50, tags: {}, metadata: {} },
        { timestamp: 2000, value: 10, tags: {}, metadata: {} },
        { timestamp: 3000, value: 30, tags: {}, metadata: {} },
        { timestamp: 4000, value: 20, tags: {}, metadata: {} },
        { timestamp: 5000, value: 40, tags: {}, metadata: {} },
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result.min).toBe(10);
      expect(result.max).toBe(50);
      expect(result.p50).toBe(30);
      expect(result.latest).toBe(40); // Last in original order
    });

    test('should handle negative values', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: -10, tags: {}, metadata: {} },
        { timestamp: 2000, value: 0, tags: {}, metadata: {} },
        { timestamp: 3000, value: 10, tags: {}, metadata: {} },
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result.sum).toBe(0);
      expect(result.avg).toBe(0);
      expect(result.min).toBe(-10);
      expect(result.max).toBe(10);
    });

    test('should handle decimal values', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 1.5, tags: {}, metadata: {} },
        { timestamp: 2000, value: 2.5, tags: {}, metadata: {} },
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result.sum).toBe(4);
      expect(result.avg).toBe(2);
      expect(result.min).toBe(1.5);
      expect(result.max).toBe(2.5);
    });

    test('should return latest value as 0 when no points have values', () => {
      const points: MetricPoint[] = [];
      const result = aggregator.calculateAggregations(points);

      expect(result.latest).toBe(0);
    });

    test('should handle points without tags or metadata', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 100 },
        { timestamp: 2000, value: 200 },
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result.count).toBe(2);
      expect(result.sum).toBe(300);
      expect(result.avg).toBe(150);
    });
  });

  describe('calculatePercentile', () => {
    test('should calculate percentiles correctly for odd-length array', () => {
      // Using direct method call for testing percentile calculation
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 1 },
        { timestamp: 2000, value: 2 },
        { timestamp: 3000, value: 3 },
        { timestamp: 4000, value: 4 },
        { timestamp: 5000, value: 5 },
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result.p50).toBe(3); // Median
      expect(result.p95).toBe(4.8); // 95th percentile
    });

    test('should calculate percentiles correctly for even-length array', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 1 },
        { timestamp: 2000, value: 2 },
        { timestamp: 3000, value: 3 },
        { timestamp: 4000, value: 4 },
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result.p50).toBe(2.5); // Average of 2 and 3
    });

    test('should handle percentiles for large datasets', () => {
      const points: MetricPoint[] = [];
      for (let i = 1; i <= 100; i++) {
        points.push({ timestamp: i * 1000, value: i });
      }

      const result = aggregator.calculateAggregations(points);

      expect(result.p50).toBe(50.5);
      expect(result.p95).toBe(95.05);
      expect(result.p99).toBe(99.01);
    });
  });

  describe('querySeries', () => {
    let testSeries: Map<string, MetricSeries>;

    beforeEach(() => {
      testSeries = new Map([
        ['cpu-usage', {
          name: 'cpu-usage',
          points: [
            { timestamp: 1000, value: 50 },
            { timestamp: 2000, value: 60 },
          ],
          aggregations: {
            count: 2,
            sum: 110,
            avg: 55,
            min: 50,
            max: 60,
            p50: 55,
            p95: 60,
            p99: 60,
            latest: 60,
          },
          tags: { service: 'web', environment: 'prod' },
        }],
        ['memory-usage', {
          name: 'memory-usage',
          points: [
            { timestamp: 1000, value: 1024 },
            { timestamp: 3000, value: 2048 },
          ],
          aggregations: {
            count: 2,
            sum: 3072,
            avg: 1536,
            min: 1024,
            max: 2048,
            p50: 1536,
            p95: 2048,
            p99: 2048,
            latest: 2048,
          },
          tags: { service: 'web', environment: 'dev' },
        }],
        ['disk-usage', {
          name: 'disk-usage',
          points: [
            { timestamp: 5000, value: 80 },
          ],
          aggregations: {
            count: 1,
            sum: 80,
            avg: 80,
            min: 80,
            max: 80,
            p50: 80,
            p95: 80,
            p99: 80,
            latest: 80,
          },
          tags: { service: 'database', environment: 'prod' },
        }],
      ]);
    });

    test('should return all series when no filters applied', () => {
      const query: MetricQuery = {};
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(3);
    });

    test('should filter by name', () => {
      const query: MetricQuery = { name: 'cpu' };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('cpu-usage');
    });

    test('should filter by exact name match', () => {
      const query: MetricQuery = { name: 'cpu-usage' };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('cpu-usage');
    });

    test('should return empty result for non-matching name', () => {
      const query: MetricQuery = { name: 'nonexistent' };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(0);
    });

    test('should not filter when name is empty string', () => {
      const query: MetricQuery = { name: '' };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(3);
    });

    test('should filter by tags', () => {
      const query: MetricQuery = { tags: { environment: 'prod' } };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(2);
      expect(result.map(s => s.name)).toContain('cpu-usage');
      expect(result.map(s => s.name)).toContain('disk-usage');
    });

    test('should filter by multiple tags', () => {
      const query: MetricQuery = {
        tags: { service: 'web', environment: 'prod' }
      };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('cpu-usage');
    });

    test('should return empty result for non-matching tags', () => {
      const query: MetricQuery = { tags: { nonexistent: 'value' } };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(0);
    });

    test('should filter by time range', () => {
      const query: MetricQuery = {
        timeRange: { start: 1500, end: 4000 }
      };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(3);

      // cpu-usage should have one point (2000)
      const cpuSeries = result.find(s => s.name === 'cpu-usage');
      expect(cpuSeries?.points).toHaveLength(1);
      expect(cpuSeries?.points[0].timestamp).toBe(2000);

      // memory-usage should have one point (3000)
      const memorySeries = result.find(s => s.name === 'memory-usage');
      expect(memorySeries?.points).toHaveLength(1);
      expect(memorySeries?.points[0].timestamp).toBe(3000);

      // disk-usage should have no points (5000 is outside range)
      const diskSeries = result.find(s => s.name === 'disk-usage');
      expect(diskSeries?.points).toHaveLength(0);
    });

    test('should apply limit', () => {
      const query: MetricQuery = { limit: 2 };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(2);
    });

    test('should ignore limit when 0', () => {
      const query: MetricQuery = { limit: 0 };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(3);
    });

    test('should ignore negative limit', () => {
      const query: MetricQuery = { limit: -1 };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(3);
    });

    test('should apply multiple filters together', () => {
      const query: MetricQuery = {
        name: 'usage',
        tags: { environment: 'prod' },
        timeRange: { start: 0, end: 3000 },
        limit: 1
      };
      const result = aggregator.querySeries(testSeries, query);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('cpu-usage');
    });

    test('should handle empty series map', () => {
      const emptySeries = new Map<string, MetricSeries>();
      const query: MetricQuery = {};
      const result = aggregator.querySeries(emptySeries, query);

      expect(result).toHaveLength(0);
    });
  });

  describe('aggregateByTime', () => {
    test('should return empty array for empty points', () => {
      const result = aggregator.aggregateByTime([], 1000);
      expect(result).toEqual([]);
    });

    test('should aggregate points into time buckets', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10, tags: { service: 'a' } },
        { timestamp: 1500, value: 20, tags: { service: 'a' } },
        { timestamp: 2000, value: 30, tags: { service: 'b' } },
        { timestamp: 2500, value: 40, tags: { service: 'b' } },
      ];

      const result = aggregator.aggregateByTime(points, 1000);

      expect(result).toHaveLength(2);

      // First bucket (1000-1999)
      const bucket1 = result.find(p => p.timestamp === 1000);
      expect(bucket1).toBeDefined();
      expect(bucket1?.value).toBe(15); // (10 + 20) / 2
      expect(bucket1?.metadata).toEqual({ aggregated: true, count: 2 });

      // Second bucket (2000-2999)
      const bucket2 = result.find(p => p.timestamp === 2000);
      expect(bucket2).toBeDefined();
      expect(bucket2?.value).toBe(35); // (30 + 40) / 2
      expect(bucket2?.metadata).toEqual({ aggregated: true, count: 2 });
    });

    test('should handle single point in bucket', () => {
      const points: MetricPoint[] = [
        { timestamp: 1500, value: 100, tags: { test: 'value' } },
      ];

      const result = aggregator.aggregateByTime(points, 1000);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        timestamp: 1000,
        value: 100,
        tags: { test: 'value' },
        metadata: { aggregated: true, count: 1 },
      });
    });

    test('should use tags from first point in bucket', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10, tags: { service: 'first' } },
        { timestamp: 1500, value: 20, tags: { service: 'second' } },
      ];

      const result = aggregator.aggregateByTime(points, 1000);

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual({ service: 'first' });
    });

    test('should handle points without tags', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10 },
        { timestamp: 1500, value: 20 },
      ];

      const result = aggregator.aggregateByTime(points, 1000);

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual({});
    });

    test('should handle different interval sizes', () => {
      const points: MetricPoint[] = [
        { timestamp: 0, value: 10 },
        { timestamp: 5000, value: 20 },
        { timestamp: 10000, value: 30 },
      ];

      const result = aggregator.aggregateByTime(points, 5000);

      expect(result).toHaveLength(3);
      expect(result.map(p => p.timestamp)).toEqual([0, 5000, 10000]);
    });

    test('should handle very small intervals', () => {
      const points: MetricPoint[] = [
        { timestamp: 100, value: 10 },
        { timestamp: 150, value: 20 },
        { timestamp: 200, value: 30 },
      ];

      const result = aggregator.aggregateByTime(points, 100);

      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toBe(100);
      expect(result[1].timestamp).toBe(200);
    });

    test('should handle edge case with zero timestamp', () => {
      const points: MetricPoint[] = [
        { timestamp: 0, value: 10 },
        { timestamp: 500, value: 20 },
      ];

      const result = aggregator.aggregateByTime(points, 1000);

      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe(0);
      expect(result[0].value).toBe(15);
    });
  });

  describe('aggregateByTags', () => {
    test('should group points by tags', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10, tags: { service: 'web', env: 'prod' } },
        { timestamp: 2000, value: 20, tags: { service: 'web', env: 'prod' } },
        { timestamp: 3000, value: 30, tags: { service: 'api', env: 'prod' } },
        { timestamp: 4000, value: 40, tags: { service: 'web', env: 'dev' } },
      ];

      const result = aggregator.aggregateByTags(points);

      expect(result.size).toBe(3);

      const webProdKey = JSON.stringify({ service: 'web', env: 'prod' });
      const apiProdKey = JSON.stringify({ service: 'api', env: 'prod' });
      const webDevKey = JSON.stringify({ service: 'web', env: 'dev' });

      expect(result.get(webProdKey)).toHaveLength(2);
      expect(result.get(apiProdKey)).toHaveLength(1);
      expect(result.get(webDevKey)).toHaveLength(1);
    });

    test('should handle points without tags', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10 },
        { timestamp: 2000, value: 20 },
      ];

      const result = aggregator.aggregateByTags(points);

      expect(result.size).toBe(1);
      const emptyTagsKey = JSON.stringify({});
      expect(result.get(emptyTagsKey)).toHaveLength(2);
    });

    test('should handle points with undefined tags', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10, tags: undefined },
        { timestamp: 2000, value: 20, tags: undefined },
      ];

      const result = aggregator.aggregateByTags(points);

      expect(result.size).toBe(1);
      const emptyTagsKey = JSON.stringify({});
      expect(result.get(emptyTagsKey)).toHaveLength(2);
    });

    test('should handle mixed tag scenarios', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10, tags: { a: '1' } },
        { timestamp: 2000, value: 20, tags: undefined },
        { timestamp: 3000, value: 30 },
        { timestamp: 4000, value: 40, tags: { a: '1' } },
      ];

      const result = aggregator.aggregateByTags(points);

      expect(result.size).toBe(2);

      const aKey = JSON.stringify({ a: '1' });
      const emptyKey = JSON.stringify({});

      expect(result.get(aKey)).toHaveLength(2);
      expect(result.get(emptyKey)).toHaveLength(2);
    });

    test('should handle empty points array', () => {
      const result = aggregator.aggregateByTags([]);

      expect(result.size).toBe(0);
    });

    test('should handle complex tag objects', () => {
      const points: MetricPoint[] = [
        {
          timestamp: 1000,
          value: 10,
          tags: { service: 'web', region: 'us-east', version: '1.0.0' }
        },
        {
          timestamp: 2000,
          value: 20,
          tags: { service: 'web', region: 'us-east', version: '1.0.0' }
        },
        {
          timestamp: 3000,
          value: 30,
          tags: { service: 'web', region: 'us-west', version: '1.0.0' }
        },
      ];

      const result = aggregator.aggregateByTags(points);

      expect(result.size).toBe(2);
    });

    test('should distinguish between similar tag sets', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10, tags: { a: '1', b: '2' } },
        { timestamp: 2000, value: 20, tags: { b: '2', a: '1' } }, // Same tags, different order
        { timestamp: 3000, value: 30, tags: { a: '1', b: '3' } }, // Different value
      ];

      const result = aggregator.aggregateByTags(points);

      // JSON.stringify creates different keys for different orders and values
      expect(result.size).toBe(3); // Each point creates a unique tag signature
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle very large numbers', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: Number.MAX_SAFE_INTEGER },
        { timestamp: 2000, value: Number.MAX_SAFE_INTEGER - 1 },
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result.count).toBe(2);
      expect(result.max).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.min).toBe(Number.MAX_SAFE_INTEGER - 1);
    });

    test('should handle very small numbers', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: Number.MIN_SAFE_INTEGER },
        { timestamp: 2000, value: Number.MIN_SAFE_INTEGER + 1 },
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result.count).toBe(2);
      expect(result.min).toBe(Number.MIN_SAFE_INTEGER);
      expect(result.max).toBe(Number.MIN_SAFE_INTEGER + 1);
    });

    test('should handle Infinity values', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: Infinity },
        { timestamp: 2000, value: 100 },
      ];

      const result = aggregator.calculateAggregations(points);

      expect(result.max).toBe(Infinity);
      expect(result.min).toBe(100);
    });

    test('should handle NaN values', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: NaN },
        { timestamp: 2000, value: 100 },
      ];

      const result = aggregator.calculateAggregations(points);

      // NaN behavior in sorting and calculations
      expect(result.count).toBe(2);
      expect(result.sum).toBeNaN();
      expect(result.avg).toBeNaN();
    });

    test('should handle duplicate timestamps in time aggregation', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10 },
        { timestamp: 1000, value: 20 },
        { timestamp: 1000, value: 30 },
      ];

      const result = aggregator.aggregateByTime(points, 1000);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(20); // (10 + 20 + 30) / 3
    });

    test('should handle zero interval in time aggregation', () => {
      const points: MetricPoint[] = [
        { timestamp: 1000, value: 10 },
        { timestamp: 2000, value: 20 },
      ];

      // This might cause division by zero or infinite buckets
      // The implementation should handle this gracefully
      expect(() => {
        aggregator.aggregateByTime(points, 0);
      }).not.toThrow();
    });
  });
});