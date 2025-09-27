import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CircularBuffer } from '../../src/performance/CircularBuffer';
import { MetricsBuffer } from '../../src/performance/MetricsBuffer';

describe('CircularBuffer', () => {
  let buffer: CircularBuffer<string>;

  beforeEach(() => {
    buffer = new CircularBuffer({
      capacity: 5,
      autoCleanup: false,
    });
  });

  afterEach(() => {
    buffer.destroy();
  });

  describe('basic operations', () => {
    it('should push items correctly', () => {
      expect(buffer.push('item1')).toBe(true);
      expect(buffer.push('item2')).toBe(true);
      expect(buffer.getSize()).toBe(2);
    });

    it('should overwrite oldest items when full', () => {
      for (let i = 1; i <= 7; i++) {
        buffer.push(`item${i}`);
      }

      expect(buffer.getSize()).toBe(5);
      expect(buffer.get(0)).toBe('item3'); // Oldest
      expect(buffer.get(4)).toBe('item7'); // Newest
    });

    it('should pop items correctly', () => {
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');

      expect(buffer.pop()).toBe('item3');
      expect(buffer.pop()).toBe('item2');
      expect(buffer.pop()).toBe('item1');
      expect(buffer.pop()).toBeNull();
    });

    it('should shift items correctly', () => {
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');

      expect(buffer.shift()).toBe('item1');
      expect(buffer.shift()).toBe('item2');
      expect(buffer.shift()).toBe('item3');
      expect(buffer.shift()).toBeNull();
    });

    it('should get items by index', () => {
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');

      expect(buffer.get(0)).toBe('item1');
      expect(buffer.get(1)).toBe('item2');
      expect(buffer.get(2)).toBe('item3');
      expect(buffer.get(3)).toBeNull();
    });
  });

  describe('array conversion', () => {
    it('should convert to array in correct order', () => {
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');

      const array = buffer.toArray();
      expect(array).toEqual(['item1', 'item2', 'item3']);
    });

    it('should handle empty buffer', () => {
      const array = buffer.toArray();
      expect(array).toEqual([]);
    });

    it('should handle wrapped buffer', () => {
      for (let i = 1; i <= 7; i++) {
        buffer.push(`item${i}`);
      }

      const array = buffer.toArray();
      expect(array).toEqual(['item3', 'item4', 'item5', 'item6', 'item7']);
    });
  });

  describe('filtering', () => {
    it('should filter items correctly', () => {
      buffer.push('item1');
      buffer.push('special');
      buffer.push('item3');
      buffer.push('special');

      const filtered = buffer.filter(item => item === 'special');
      expect(filtered).toEqual(['special', 'special']);
    });

    it('should return empty array for no matches', () => {
      buffer.push('item1');
      buffer.push('item2');

      const filtered = buffer.filter(item => item === 'nonexistent');
      expect(filtered).toEqual([]);
    });
  });

  describe('recent items', () => {
    it('should get recent items correctly', () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push(`item${i}`);
      }

      const recent = buffer.getRecent(3);
      expect(recent).toEqual(['item3', 'item4', 'item5']);
    });

    it('should handle count larger than buffer size', () => {
      buffer.push('item1');
      buffer.push('item2');

      const recent = buffer.getRecent(5);
      expect(recent).toEqual(['item1', 'item2']);
    });
  });

  describe('state methods', () => {
    it('should report correct size and capacity', () => {
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.isFull()).toBe(false);

      buffer.push('item1');
      expect(buffer.isEmpty()).toBe(false);
      expect(buffer.isFull()).toBe(false);

      for (let i = 2; i <= 5; i++) {
        buffer.push(`item${i}`);
      }
      expect(buffer.isFull()).toBe(true);
    });

    it('should get oldest and newest items', () => {
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');

      expect(buffer.getOldest()).toBe('item1');
      expect(buffer.getNewest()).toBe('item3');
    });

    it('return null for oldest/newest when empty', () => {
      expect(buffer.getOldest()).toBeNull();
      expect(buffer.getNewest()).toBeNull();
    });
  });

  describe('clearing', () => {
    it('should clear all items', () => {
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');

      buffer.clear();
      expect(buffer.getSize()).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
    });
  });

  describe('timestamps', () => {
    it('should track timestamps correctly', () => {
      const before = Date.now();
      buffer.push('item1');
      const after = Date.now();

      const timestamp = buffer.getTimestamp(0);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('return null for invalid index timestamp', () => {
      expect(buffer.getTimestamp(0)).toBeNull();
    });
  });

  describe('configuration updates', () => {
    it('should update capacity correctly', () => {
      buffer.push('item1');
      buffer.push('item2');
      buffer.push('item3');

      buffer.updateConfig({ capacity: 10 });

      expect(buffer.getCapacity()).toBe(10);
      expect(buffer.getSize()).toBe(3);
      expect(buffer.toArray()).toEqual(['item1', 'item2', 'item3']);
    });

    it('should reduce capacity and keep newest items', () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push(`item${i}`);
      }

      buffer.updateConfig({ capacity: 3 });

      expect(buffer.getCapacity()).toBe(3);
      expect(buffer.toArray()).toEqual(['item3', 'item4', 'item5']);
    });

    it('should handle cleanup timer changes', () => {
      buffer.updateConfig({ autoCleanup: true, cleanupInterval: 1000, maxAge: 5000 });
      expect(buffer.getConfig().autoCleanup).toBe(true);

      buffer.updateConfig({ autoCleanup: false });
      expect(buffer.getConfig().autoCleanup).toBe(false);
    });
  });

  describe('memory usage', () => {
    it('should report memory usage', () => {
      const usage = buffer.getMemoryUsage();
      expect(typeof usage.bufferSize).toBe('number');
      expect(typeof usage.timestampsSize).toBe('number');
      expect(typeof usage.totalSize).toBe('number');
      expect(typeof usage.overhead).toBe('number');
    });
  });

  describe('MetricsBuffer specialization', () => {
    let metricsBuffer: MetricsBuffer;

    beforeEach(() => {
      metricsBuffer = new MetricsBuffer({
        capacity: 10,
        autoCleanup: false,
      });
    });

    afterEach(() => {
      metricsBuffer.destroy();
    });

    it('should handle metric objects', () => {
      const metric = {
        id: 'test-1',
        name: 'render-time',
        value: 42,
        timestamp: Date.now(),
      };

      metricsBuffer.push(metric);
      expect(metricsBuffer.getSize()).toBe(1);
    });

    it('should filter metrics by name', () => {
      metricsBuffer.push({
        id: '1',
        name: 'render-time',
        value: 10,
        timestamp: Date.now(),
      });

      metricsBuffer.push({
        id: '2',
        name: 'memory-usage',
        value: 20,
        timestamp: Date.now(),
      });

      metricsBuffer.push({
        id: '3',
        name: 'render-time',
        value: 30,
        timestamp: Date.now(),
      });

      const renderMetrics = metricsBuffer.getMetricsByName('render-time');
      expect(renderMetrics).toHaveLength(2);
      expect(renderMetrics[0].name).toBe('render-time');
      expect(renderMetrics[1].name).toBe('render-time');
    });

    it('should filter metrics by timestamp', () => {
      const now = Date.now();
      const old = now - 10000;

      metricsBuffer.push({
        id: '1',
        name: 'test',
        value: 10,
        timestamp: old,
      });

      metricsBuffer.push({
        id: '2',
        name: 'test',
        value: 20,
        timestamp: now,
      });

      const recentMetrics = metricsBuffer.getMetricsSince(now - 5000);
      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0].value).toBe(20);
    });

    it('should calculate statistics correctly', () => {
      metricsBuffer.push({
        id: '1',
        name: 'test-metric',
        value: 10,
        timestamp: Date.now(),
      });

      metricsBuffer.push({
        id: '2',
        name: 'test-metric',
        value: 20,
        timestamp: Date.now(),
      });

      metricsBuffer.push({
        id: '3',
        name: 'test-metric',
        value: 30,
        timestamp: Date.now(),
      });

      expect(metricsBuffer.getAverageValue('test-metric')).toBe(20);
      expect(metricsBuffer.getMaxValue('test-metric')).toBe(30);
      expect(metricsBuffer.getMinValue('test-metric')).toBe(10);
    });

    it('should return zero for non-existent metrics', () => {
      expect(metricsBuffer.getAverageValue('non-existent')).toBe(0);
      expect(metricsBuffer.getMaxValue('non-existent')).toBe(0);
      expect(metricsBuffer.getMinValue('non-existent')).toBe(0);
    });
  });

  describe('cleanup functionality', () => {
    beforeEach(() => {
      // Configure maxAge for cleanup tests
      buffer.updateConfig({ maxAge: 60000 }); // 1 minute
    });

    it('should cleanup old items based on age', () => {
      const now = Date.now();
      const old = now - 100000; // Very old

      buffer.push('old-item');
      // Manually set timestamp for old item
      const oldIndex = buffer.getSize() - 1;
      // @ts-expect-error - Accessing private for testing
      buffer.timestamps[oldIndex] = old;

      buffer.push('new-item'); // This should be kept

      buffer.cleanup();

      expect(buffer.getSize()).toBe(1);
      expect(buffer.get(0)).toBe('new-item');
    });

    it('should clear all items if all are expired', () => {
      const now = Date.now();
      const old = now - 100000;

      buffer.push('item1');
      buffer.push('item2');

      // Set all timestamps to old
      // @ts-expect-error - Accessing private for testing
      buffer.timestamps.fill(old);

      buffer.cleanup();

      expect(buffer.getSize()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should throw error for zero capacity', () => {
      expect(() => new CircularBuffer({ capacity: 0 })).toThrow(RangeError);
    });

    it('should throw error for negative capacity', () => {
      expect(() => new CircularBuffer({ capacity: -1 })).toThrow(RangeError);
    });
  });
});