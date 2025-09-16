import { describe, it, expect, beforeEach } from 'bun:test';
import { MetricsBuffer } from '../../../src/performance/metrics/MetricsBuffer';
import { MetricPoint, MetricSeries } from '../../../src/performance/metrics/types';

describe('MetricsBuffer', () => {
  let metricsBuffer: MetricsBuffer;

  beforeEach(() => {
    metricsBuffer = new MetricsBuffer();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const buffer = new MetricsBuffer();
      expect(buffer.getBufferSize()).toBe(0);
      expect(buffer.getMetricNames()).toEqual([]);
    });

    it('should initialize with custom values', () => {
      const buffer = new MetricsBuffer(500, 1800000); // 30 minutes
      expect(buffer.getBufferSize()).toBe(0);
      expect(buffer.getMetricNames()).toEqual([]);
    });
  });

  describe('addPoint', () => {
    it('should add a point to a new metric', () => {
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 42.5,
        tags: { environment: 'test' },
        metadata: { source: 'unit-test' }
      };

      metricsBuffer.addPoint('cpu.usage', point);

      expect(metricsBuffer.hasMetric('cpu.usage')).toBe(true);
      expect(metricsBuffer.getBufferSize()).toBe(1);

      const buffer = metricsBuffer.getBuffer('cpu.usage');
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toEqual(point);
    });

    it('should add multiple points to the same metric', () => {
      const point1: MetricPoint = { timestamp: 1000, value: 10 };
      const point2: MetricPoint = { timestamp: 2000, value: 20 };
      const point3: MetricPoint = { timestamp: 3000, value: 30 };

      metricsBuffer.addPoint('memory.usage', point1);
      metricsBuffer.addPoint('memory.usage', point2);
      metricsBuffer.addPoint('memory.usage', point3);

      expect(metricsBuffer.getBufferSize()).toBe(3);

      const buffer = metricsBuffer.getBuffer('memory.usage');
      expect(buffer).toHaveLength(3);
      expect(buffer).toEqual([point1, point2, point3]);
    });

    it('should add points to different metrics', () => {
      const cpuPoint: MetricPoint = { timestamp: 1000, value: 50 };
      const memoryPoint: MetricPoint = { timestamp: 1001, value: 80 };

      metricsBuffer.addPoint('cpu.usage', cpuPoint);
      metricsBuffer.addPoint('memory.usage', memoryPoint);

      expect(metricsBuffer.hasMetric('cpu.usage')).toBe(true);
      expect(metricsBuffer.hasMetric('memory.usage')).toBe(true);
      expect(metricsBuffer.getBufferSize()).toBe(2);
      expect(metricsBuffer.getMetricNames()).toEqual(['cpu.usage', 'memory.usage']);
    });

    it('should create empty series when adding first point', () => {
      const point: MetricPoint = { timestamp: 1000, value: 42 };

      metricsBuffer.addPoint('test.metric', point);

      const series = metricsBuffer.getSeries('test.metric');
      expect(series).toBeDefined();
      expect(series?.name).toBe('test.metric');
      expect(series?.points).toEqual([]);
      expect(series?.aggregations).toEqual({
        count: 0,
        sum: 0,
        avg: 0,
        min: Number.MAX_VALUE,
        max: Number.MIN_VALUE,
        p50: 0,
        p95: 0,
        p99: 0,
        latest: 0,
      });
      expect(series?.tags).toEqual({});
    });
  });

  describe('buffer trimming', () => {
    it('should trim buffer when exceeding size limit', () => {
      const smallBuffer = new MetricsBuffer(3); // Small buffer size

      // Add 5 points to exceed buffer size
      for (let i = 0; i < 5; i++) {
        smallBuffer.addPoint('test.metric', {
          timestamp: 1000 + i,
          value: i
        });
      }

      const buffer = smallBuffer.getBuffer('test.metric');
      expect(buffer).toHaveLength(3); // Should be trimmed to buffer size

      // Should keep the latest points
      expect(buffer[0].value).toBe(2); // Original point at index 2
      expect(buffer[1].value).toBe(3); // Original point at index 3
      expect(buffer[2].value).toBe(4); // Original point at index 4
    });

    it('should not trim when buffer is within size limit', () => {
      const buffer = new MetricsBuffer(5);

      for (let i = 0; i < 3; i++) {
        buffer.addPoint('test.metric', {
          timestamp: 1000 + i,
          value: i
        });
      }

      const points = buffer.getBuffer('test.metric');
      expect(points).toHaveLength(3);
    });
  });

  describe('getBuffer', () => {
    it('should return buffer for existing metric', () => {
      const point: MetricPoint = { timestamp: 1000, value: 42 };
      metricsBuffer.addPoint('test.metric', point);

      const buffer = metricsBuffer.getBuffer('test.metric');
      expect(buffer).toEqual([point]);
    });

    it('should return empty array for non-existent metric', () => {
      const buffer = metricsBuffer.getBuffer('non.existent');
      expect(buffer).toEqual([]);
    });
  });

  describe('getAllBuffers', () => {
    it('should return all buffers', () => {
      const point1: MetricPoint = { timestamp: 1000, value: 10 };
      const point2: MetricPoint = { timestamp: 2000, value: 20 };

      metricsBuffer.addPoint('metric1', point1);
      metricsBuffer.addPoint('metric2', point2);

      const allBuffers = metricsBuffer.getAllBuffers();
      expect(allBuffers.size).toBe(2);
      expect(allBuffers.get('metric1')).toEqual([point1]);
      expect(allBuffers.get('metric2')).toEqual([point2]);
    });

    it('should return empty map when no metrics exist', () => {
      const allBuffers = metricsBuffer.getAllBuffers();
      expect(allBuffers.size).toBe(0);
    });

    it('should return a copy of the internal buffer map', () => {
      const point: MetricPoint = { timestamp: 1000, value: 42 };
      metricsBuffer.addPoint('test.metric', point);

      const allBuffers = metricsBuffer.getAllBuffers();
      allBuffers.set('external.metric', []);

      // Should not affect internal buffer
      expect(metricsBuffer.hasMetric('external.metric')).toBe(false);
    });
  });

  describe('getSeries', () => {
    it('should return series for existing metric', () => {
      const point: MetricPoint = { timestamp: 1000, value: 42 };
      metricsBuffer.addPoint('test.metric', point);

      const series = metricsBuffer.getSeries('test.metric');
      expect(series).toBeDefined();
      expect(series?.name).toBe('test.metric');
    });

    it('should return undefined for non-existent metric', () => {
      const series = metricsBuffer.getSeries('non.existent');
      expect(series).toBeUndefined();
    });
  });

  describe('getAllSeries', () => {
    it('should return all series', () => {
      metricsBuffer.addPoint('metric1', { timestamp: 1000, value: 10 });
      metricsBuffer.addPoint('metric2', { timestamp: 2000, value: 20 });

      const allSeries = metricsBuffer.getAllSeries();
      expect(allSeries.size).toBe(2);
      expect(allSeries.get('metric1')?.name).toBe('metric1');
      expect(allSeries.get('metric2')?.name).toBe('metric2');
    });

    it('should return empty map when no metrics exist', () => {
      const allSeries = metricsBuffer.getAllSeries();
      expect(allSeries.size).toBe(0);
    });

    it('should return a copy of the internal series map', () => {
      metricsBuffer.addPoint('test.metric', { timestamp: 1000, value: 42 });

      const allSeries = metricsBuffer.getAllSeries();
      const newSeries: MetricSeries = {
        name: 'external.metric',
        points: [],
        aggregations: {
          count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, latest: 0
        },
        tags: {}
      };
      allSeries.set('external.metric', newSeries);

      // Should not affect internal series
      expect(metricsBuffer.getSeries('external.metric')).toBeUndefined();
    });
  });

  describe('updateSeries', () => {
    it('should update existing series', () => {
      metricsBuffer.addPoint('test.metric', { timestamp: 1000, value: 42 });

      const updatedSeries: MetricSeries = {
        name: 'test.metric',
        points: [{ timestamp: 1000, value: 42 }],
        aggregations: {
          count: 1,
          sum: 42,
          avg: 42,
          min: 42,
          max: 42,
          p50: 42,
          p95: 42,
          p99: 42,
          latest: 42
        },
        tags: { environment: 'test' }
      };

      metricsBuffer.updateSeries('test.metric', updatedSeries);

      const series = metricsBuffer.getSeries('test.metric');
      expect(series).toEqual(updatedSeries);
    });

    it('should create new series if it does not exist', () => {
      const newSeries: MetricSeries = {
        name: 'new.metric',
        points: [],
        aggregations: {
          count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, latest: 0
        },
        tags: {}
      };

      metricsBuffer.updateSeries('new.metric', newSeries);

      const series = metricsBuffer.getSeries('new.metric');
      expect(series).toEqual(newSeries);
    });
  });

  describe('getBufferSize', () => {
    it('should return total number of points across all buffers', () => {
      expect(metricsBuffer.getBufferSize()).toBe(0);

      metricsBuffer.addPoint('metric1', { timestamp: 1000, value: 10 });
      expect(metricsBuffer.getBufferSize()).toBe(1);

      metricsBuffer.addPoint('metric1', { timestamp: 1001, value: 11 });
      expect(metricsBuffer.getBufferSize()).toBe(2);

      metricsBuffer.addPoint('metric2', { timestamp: 1002, value: 12 });
      expect(metricsBuffer.getBufferSize()).toBe(3);
    });

    it('should update size correctly after buffer operations', () => {
      const smallBuffer = new MetricsBuffer(2);

      smallBuffer.addPoint('test', { timestamp: 1000, value: 1 });
      smallBuffer.addPoint('test', { timestamp: 1001, value: 2 });
      smallBuffer.addPoint('test', { timestamp: 1002, value: 3 });

      // Should be trimmed to 2 points
      expect(smallBuffer.getBufferSize()).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should remove old points based on retention period', () => {
      const buffer = new MetricsBuffer(10000, 1000); // 1 second retention

      const oldPoint: MetricPoint = {
        timestamp: Date.now() - 2000, // 2 seconds ago
        value: 10
      };
      const recentPoint: MetricPoint = {
        timestamp: Date.now() - 500, // 0.5 seconds ago
        value: 20
      };

      buffer.addPoint('test.metric', oldPoint);
      buffer.addPoint('test.metric', recentPoint);

      expect(buffer.getBufferSize()).toBe(2);

      buffer.cleanup();

      expect(buffer.getBufferSize()).toBe(1);
      const remainingPoints = buffer.getBuffer('test.metric');
      expect(remainingPoints).toEqual([recentPoint]);
    });

    it('should remove entire metric if no points remain after cleanup', () => {
      const buffer = new MetricsBuffer(10000, 1000); // 1 second retention

      const oldPoint: MetricPoint = {
        timestamp: Date.now() - 2000, // 2 seconds ago
        value: 10
      };

      buffer.addPoint('old.metric', oldPoint);
      expect(buffer.hasMetric('old.metric')).toBe(true);

      buffer.cleanup();

      expect(buffer.hasMetric('old.metric')).toBe(false);
      expect(buffer.getSeries('old.metric')).toBeUndefined();
    });

    it('should handle multiple metrics during cleanup', () => {
      const buffer = new MetricsBuffer(10000, 1000); // 1 second retention

      const oldPoint: MetricPoint = { timestamp: Date.now() - 2000, value: 10 };
      const recentPoint: MetricPoint = { timestamp: Date.now() - 500, value: 20 };

      buffer.addPoint('old.metric', oldPoint);
      buffer.addPoint('recent.metric', recentPoint);

      buffer.cleanup();

      expect(buffer.hasMetric('old.metric')).toBe(false);
      expect(buffer.hasMetric('recent.metric')).toBe(true);
    });

    it('should not affect metrics with all recent points', () => {
      const buffer = new MetricsBuffer(10000, 10000); // 10 second retention

      const point1: MetricPoint = { timestamp: Date.now() - 1000, value: 10 };
      const point2: MetricPoint = { timestamp: Date.now() - 500, value: 20 };

      buffer.addPoint('test.metric', point1);
      buffer.addPoint('test.metric', point2);

      buffer.cleanup();

      expect(buffer.getBufferSize()).toBe(2);
      expect(buffer.hasMetric('test.metric')).toBe(true);
    });
  });

  describe('getMetricNames', () => {
    it('should return empty array when no metrics exist', () => {
      expect(metricsBuffer.getMetricNames()).toEqual([]);
    });

    it('should return all metric names', () => {
      metricsBuffer.addPoint('cpu.usage', { timestamp: 1000, value: 50 });
      metricsBuffer.addPoint('memory.usage', { timestamp: 1001, value: 80 });
      metricsBuffer.addPoint('disk.io', { timestamp: 1002, value: 100 });

      const names = metricsBuffer.getMetricNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('cpu.usage');
      expect(names).toContain('memory.usage');
      expect(names).toContain('disk.io');
    });

    it('should update metric names after cleanup', () => {
      const buffer = new MetricsBuffer(10000, 1000); // 1 second retention

      buffer.addPoint('old.metric', { timestamp: Date.now() - 2000, value: 10 });
      buffer.addPoint('recent.metric', { timestamp: Date.now() - 500, value: 20 });

      expect(buffer.getMetricNames()).toHaveLength(2);

      buffer.cleanup();

      const names = buffer.getMetricNames();
      expect(names).toHaveLength(1);
      expect(names).toEqual(['recent.metric']);
    });
  });

  describe('hasMetric', () => {
    it('should return false for non-existent metric', () => {
      expect(metricsBuffer.hasMetric('non.existent')).toBe(false);
    });

    it('should return true for existing metric', () => {
      metricsBuffer.addPoint('test.metric', { timestamp: 1000, value: 42 });
      expect(metricsBuffer.hasMetric('test.metric')).toBe(true);
    });

    it('should return false after metric is removed during cleanup', () => {
      const buffer = new MetricsBuffer(10000, 1000); // 1 second retention

      buffer.addPoint('old.metric', { timestamp: Date.now() - 2000, value: 10 });
      expect(buffer.hasMetric('old.metric')).toBe(true);

      buffer.cleanup();
      expect(buffer.hasMetric('old.metric')).toBe(false);
    });
  });

  describe('flush', () => {
    it('should return all buffers and clear them', () => {
      const point1: MetricPoint = { timestamp: 1000, value: 10 };
      const point2: MetricPoint = { timestamp: 2000, value: 20 };

      metricsBuffer.addPoint('metric1', point1);
      metricsBuffer.addPoint('metric2', point2);

      const flushed = metricsBuffer.flush();

      expect(flushed.size).toBe(2);
      expect(flushed.get('metric1')).toEqual([point1]);
      expect(flushed.get('metric2')).toEqual([point2]);

      // Buffer should be empty after flush
      expect(metricsBuffer.getBufferSize()).toBe(0);
      expect(metricsBuffer.getMetricNames()).toEqual([]);
    });

    it('should return empty map when no metrics exist', () => {
      const flushed = metricsBuffer.flush();
      expect(flushed.size).toBe(0);
    });

    it('should not affect series when flushing buffers', () => {
      metricsBuffer.addPoint('test.metric', { timestamp: 1000, value: 42 });

      const seriesBeforeFlush = metricsBuffer.getSeries('test.metric');

      metricsBuffer.flush();

      const seriesAfterFlush = metricsBuffer.getSeries('test.metric');
      expect(seriesAfterFlush).toEqual(seriesBeforeFlush);
    });
  });

  describe('clear', () => {
    it('should clear all buffers and series', () => {
      metricsBuffer.addPoint('metric1', { timestamp: 1000, value: 10 });
      metricsBuffer.addPoint('metric2', { timestamp: 2000, value: 20 });

      expect(metricsBuffer.getBufferSize()).toBe(2);
      expect(metricsBuffer.getAllSeries().size).toBe(2);

      metricsBuffer.clear();

      expect(metricsBuffer.getBufferSize()).toBe(0);
      expect(metricsBuffer.getMetricNames()).toEqual([]);
      expect(metricsBuffer.getAllSeries().size).toBe(0);
      expect(metricsBuffer.getAllBuffers().size).toBe(0);
    });

    it('should handle clearing empty buffer', () => {
      expect(() => metricsBuffer.clear()).not.toThrow();
      expect(metricsBuffer.getBufferSize()).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle high volume of points', () => {
      const buffer = new MetricsBuffer(1000, 3600000); // 1000 points, 1 hour retention

      // Add 1500 points to test trimming
      for (let i = 0; i < 1500; i++) {
        buffer.addPoint('high.volume', {
          timestamp: Date.now() + i,
          value: Math.random() * 100
        });
      }

      expect(buffer.getBufferSize()).toBe(1000); // Should be trimmed
      expect(buffer.hasMetric('high.volume')).toBe(true);
    });

    it('should handle complex metric operations workflow', () => {
      // Add initial metrics
      metricsBuffer.addPoint('cpu', { timestamp: 1000, value: 25 });
      metricsBuffer.addPoint('memory', { timestamp: 1001, value: 60 });

      // Update series
      const cpuSeries: MetricSeries = {
        name: 'cpu',
        points: [{ timestamp: 1000, value: 25 }],
        aggregations: {
          count: 1, sum: 25, avg: 25, min: 25, max: 25,
          p50: 25, p95: 25, p99: 25, latest: 25
        },
        tags: { host: 'server1' }
      };
      metricsBuffer.updateSeries('cpu', cpuSeries);

      // Verify state
      expect(metricsBuffer.getBufferSize()).toBe(2);
      expect(metricsBuffer.getSeries('cpu')?.tags.host).toBe('server1');

      // Flush and verify
      const flushed = metricsBuffer.flush();
      expect(flushed.size).toBe(2);
      expect(metricsBuffer.getBufferSize()).toBe(0);

      // Series should still exist
      expect(metricsBuffer.getSeries('cpu')).toBeDefined();
    });

    it('should handle edge cases with zero values', () => {
      const zeroPoint: MetricPoint = { timestamp: 1000, value: 0 };
      metricsBuffer.addPoint('zero.metric', zeroPoint);

      expect(metricsBuffer.getBuffer('zero.metric')).toEqual([zeroPoint]);
      expect(metricsBuffer.getBufferSize()).toBe(1);
    });

    it('should handle negative values', () => {
      const negativePoint: MetricPoint = { timestamp: 1000, value: -42.5 };
      metricsBuffer.addPoint('negative.metric', negativePoint);

      expect(metricsBuffer.getBuffer('negative.metric')).toEqual([negativePoint]);
    });

    it('should handle metrics with special characters in names', () => {
      const specialNames = [
        'metric.with.dots',
        'metric-with-dashes',
        'metric_with_underscores',
        'metric/with/slashes',
        'metric:with:colons'
      ];

      specialNames.forEach((name, index) => {
        metricsBuffer.addPoint(name, { timestamp: 1000 + index, value: index });
      });

      expect(metricsBuffer.getMetricNames()).toHaveLength(specialNames.length);
      specialNames.forEach(name => {
        expect(metricsBuffer.hasMetric(name)).toBe(true);
      });
    });
  });
});