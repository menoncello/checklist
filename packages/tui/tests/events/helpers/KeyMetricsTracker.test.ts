import { beforeEach, describe, expect, test, jest } from 'bun:test';
import { KeyMetricsTracker, KeyMetrics, KeySequenceMetrics } from '../../../src/events/helpers/KeyMetricsTracker';
import { KeyEvent } from '../../../src/events/helpers/KeyBindingManager';

describe('KeyMetricsTracker', () => {
  let tracker: KeyMetricsTracker;

  beforeEach(() => {
    tracker = new KeyMetricsTracker();
  });

  describe('constructor', () => {
    test('should initialize with default max history size', () => {
      const defaultTracker = new KeyMetricsTracker();
      expect(defaultTracker).toBeInstanceOf(KeyMetricsTracker);
    });

    test('should initialize with custom max history size', () => {
      const customTracker = new KeyMetricsTracker(50);
      expect(customTracker).toBeInstanceOf(KeyMetricsTracker);
    });

    test('should start with empty history and metrics', () => {
      expect(tracker.getKeyHistory()).toHaveLength(0);
      expect(tracker.getAllKeyMetrics().size).toBe(0);
      expect(tracker.getActiveSequence()).toBeNull();
    });
  });

  describe('recordKeyEvent', () => {
    test('should record key event in history', () => {
      const keyEvent: KeyEvent = {
        key: 'a',
        modifiers: {},
        timestamp: Date.now(),
      };

      tracker.recordKeyEvent(keyEvent);

      const history = tracker.getKeyHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(keyEvent);
    });

    test('should update key metrics when recording event', () => {
      const keyEvent: KeyEvent = {
        key: 'a',
        modifiers: {},
        timestamp: Date.now(),
      };

      tracker.recordKeyEvent(keyEvent);

      const metrics = tracker.getKeyMetrics('a');
      expect(metrics).not.toBeNull();
      expect(metrics?.count).toBe(1);
      expect(metrics?.lastPressed).toBe(keyEvent.timestamp);
    });

    test('should trim history when exceeding max size', () => {
      const smallTracker = new KeyMetricsTracker(3);

      for (let i = 0; i < 5; i++) {
        smallTracker.recordKeyEvent({
          key: `key${i}`,
          modifiers: {},
          timestamp: Date.now() + i,
        });
      }

      const history = smallTracker.getKeyHistory();
      expect(history).toHaveLength(3);
      expect(history[0].key).toBe('key2'); // First two should be trimmed
      expect(history[2].key).toBe('key4');
    });

    test('should handle multiple events for same key', () => {
      const timestamp1 = Date.now();
      const timestamp2 = timestamp1 + 100;

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: timestamp1,
      });

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: timestamp2,
      });

      const metrics = tracker.getKeyMetrics('a');
      expect(metrics?.count).toBe(2);
      expect(metrics?.averageInterval).toBe(100);
      expect(metrics?.totalTime).toBe(100);
    });

    test('should handle undefined key', () => {
      const keyEvent: KeyEvent = {
        key: undefined as any,
        modifiers: {},
        timestamp: Date.now(),
      };

      tracker.recordKeyEvent(keyEvent);

      const metrics = tracker.getKeyMetrics('unknown');
      expect(metrics?.count).toBe(1);
    });

    test('should handle null key', () => {
      const keyEvent: KeyEvent = {
        key: null as any,
        modifiers: {},
        timestamp: Date.now(),
      };

      tracker.recordKeyEvent(keyEvent);

      const metrics = tracker.getKeyMetrics('unknown');
      expect(metrics?.count).toBe(1);
    });
  });

  describe('updateKeyMetrics', () => {
    test('should create new metrics for new key', () => {
      const keyEvent: KeyEvent = {
        key: 'x',
        modifiers: {},
        timestamp: 1000,
      };

      tracker.recordKeyEvent(keyEvent);

      const metrics = tracker.getKeyMetrics('x');
      expect(metrics).toEqual({
        count: 1,
        lastPressed: 1000,
        averageInterval: 0,
        totalTime: 0,
      });
    });

    test('should calculate average interval correctly', () => {
      const baseTime = Date.now();

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: baseTime,
      });

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: baseTime + 200,
      });

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: baseTime + 500,
      });

      const metrics = tracker.getKeyMetrics('a');
      expect(metrics?.count).toBe(3);
      expect(metrics?.totalTime).toBe(500); // 200 + 300
      expect(metrics?.averageInterval).toBe(250); // 500 / 2
    });

    test('should handle first key press correctly', () => {
      const keyEvent: KeyEvent = {
        key: 'first',
        modifiers: {},
        timestamp: 5000,
      };

      tracker.recordKeyEvent(keyEvent);

      const metrics = tracker.getKeyMetrics('first');
      expect(metrics?.count).toBe(1);
      expect(metrics?.averageInterval).toBe(0);
      expect(metrics?.totalTime).toBe(0);
    });
  });

  describe('sequence management', () => {
    test('should start sequence', () => {
      tracker.startSequence('ctrl+k');

      const sequence = tracker.getActiveSequence();
      expect(sequence).not.toBeNull();
      expect(sequence?.sequence).toBe('ctrl+k');
      expect(sequence?.keyCount).toBe(0);
      expect(sequence?.completed).toBe(false);
      expect(sequence?.startTime).toBeGreaterThan(0);
    });

    test('should add to sequence', () => {
      tracker.startSequence('test-sequence');
      tracker.addToSequence();
      tracker.addToSequence();

      const sequence = tracker.getActiveSequence();
      expect(sequence?.keyCount).toBe(2);
    });

    test('should not add to sequence when none active', () => {
      tracker.addToSequence(); // Should not throw

      const sequence = tracker.getActiveSequence();
      expect(sequence).toBeNull();
    });

    test('should complete sequence', () => {
      tracker.startSequence('test-sequence');
      tracker.addToSequence();
      tracker.completeSequence();

      const sequence = tracker.getActiveSequence();
      expect(sequence).toBeNull(); // Should be cleared after completion
    });

    test('should not complete sequence when none active', () => {
      tracker.completeSequence(); // Should not throw

      const sequence = tracker.getActiveSequence();
      expect(sequence).toBeNull();
    });

    test('should cancel sequence', () => {
      tracker.startSequence('test-sequence');
      tracker.addToSequence();
      tracker.cancelSequence();

      const sequence = tracker.getActiveSequence();
      expect(sequence).toBeNull();
    });

    test('should handle canceling when no sequence active', () => {
      tracker.cancelSequence(); // Should not throw

      const sequence = tracker.getActiveSequence();
      expect(sequence).toBeNull();
    });

    test('should return copy of active sequence', () => {
      tracker.startSequence('test');
      const sequence1 = tracker.getActiveSequence();
      const sequence2 = tracker.getActiveSequence();

      expect(sequence1).toEqual(sequence2);
      expect(sequence1).not.toBe(sequence2); // Different objects
    });
  });

  describe('getKeyMetrics', () => {
    test('should return metrics for existing key', () => {
      tracker.recordKeyEvent({
        key: 'test',
        modifiers: {},
        timestamp: Date.now(),
      });

      const metrics = tracker.getKeyMetrics('test');
      expect(metrics).not.toBeNull();
      expect(metrics?.count).toBe(1);
    });

    test('should return null for non-existent key', () => {
      const metrics = tracker.getKeyMetrics('nonexistent');
      expect(metrics).toBeNull();
    });
  });

  describe('getAllKeyMetrics', () => {
    test('should return copy of all metrics', () => {
      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: Date.now(),
      });

      tracker.recordKeyEvent({
        key: 'b',
        modifiers: {},
        timestamp: Date.now(),
      });

      const allMetrics = tracker.getAllKeyMetrics();
      expect(allMetrics.size).toBe(2);
      expect(allMetrics.has('a')).toBe(true);
      expect(allMetrics.has('b')).toBe(true);

      // Should be a copy
      const allMetrics2 = tracker.getAllKeyMetrics();
      expect(allMetrics).toEqual(allMetrics2);
      expect(allMetrics).not.toBe(allMetrics2);
    });

    test('should return empty map when no metrics', () => {
      const allMetrics = tracker.getAllKeyMetrics();
      expect(allMetrics.size).toBe(0);
    });
  });

  describe('getKeyHistory', () => {
    test('should return copy of key history', () => {
      const event1: KeyEvent = {
        key: 'a',
        modifiers: {},
        timestamp: Date.now(),
      };

      const event2: KeyEvent = {
        key: 'b',
        modifiers: {},
        timestamp: Date.now() + 100,
      };

      tracker.recordKeyEvent(event1);
      tracker.recordKeyEvent(event2);

      const history1 = tracker.getKeyHistory();
      const history2 = tracker.getKeyHistory();

      expect(history1).toEqual(history2);
      expect(history1).not.toBe(history2); // Different arrays
      expect(history1).toHaveLength(2);
    });

    test('should return empty array when no history', () => {
      const history = tracker.getKeyHistory();
      expect(history).toEqual([]);
    });
  });

  describe('getMostUsedKeys', () => {
    test('should return most used keys in descending order', () => {
      // Record different amounts for different keys
      for (let i = 0; i < 5; i++) {
        tracker.recordKeyEvent({
          key: 'a',
          modifiers: {},
          timestamp: Date.now() + i,
        });
      }

      for (let i = 0; i < 3; i++) {
        tracker.recordKeyEvent({
          key: 'b',
          modifiers: {},
          timestamp: Date.now() + i,
        });
      }

      for (let i = 0; i < 7; i++) {
        tracker.recordKeyEvent({
          key: 'c',
          modifiers: {},
          timestamp: Date.now() + i,
        });
      }

      const mostUsed = tracker.getMostUsedKeys();
      expect(mostUsed).toHaveLength(3);
      expect(mostUsed[0]).toEqual({ key: 'c', count: 7 });
      expect(mostUsed[1]).toEqual({ key: 'a', count: 5 });
      expect(mostUsed[2]).toEqual({ key: 'b', count: 3 });
    });

    test('should respect limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        tracker.recordKeyEvent({
          key: `key${i}`,
          modifiers: {},
          timestamp: Date.now() + i,
        });
      }

      const mostUsed = tracker.getMostUsedKeys(2);
      expect(mostUsed).toHaveLength(2);
    });

    test('should return empty array when no keys recorded', () => {
      const mostUsed = tracker.getMostUsedKeys();
      expect(mostUsed).toEqual([]);
    });

    test('should use default limit of 10', () => {
      for (let i = 0; i < 15; i++) {
        tracker.recordKeyEvent({
          key: `key${i}`,
          modifiers: {},
          timestamp: Date.now() + i,
        });
      }

      const mostUsed = tracker.getMostUsedKeys();
      expect(mostUsed).toHaveLength(10);
    });
  });

  describe('getTypingSpeed', () => {
    test('should return 0 for less than 2 events', () => {
      expect(tracker.getTypingSpeed()).toBe(0);

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: Date.now(),
      });

      expect(tracker.getTypingSpeed()).toBe(0);
    });

    test('should calculate typing speed correctly', () => {
      const baseTime = Date.now();

      // Record 5 keys over 1 minute (60000ms)
      for (let i = 0; i < 5; i++) {
        tracker.recordKeyEvent({
          key: `key${i}`,
          modifiers: {},
          timestamp: baseTime + (i * 15000), // 15 seconds apart
        });
      }

      const speed = tracker.getTypingSpeed();
      // (5-1) keys over 60 seconds = 4 keys per minute
      expect(speed).toBe(4);
    });

    test('should use last 20 keys for calculation', () => {
      const baseTime = Date.now();

      // Record 25 keys
      for (let i = 0; i < 25; i++) {
        tracker.recordKeyEvent({
          key: `key${i}`,
          modifiers: {},
          timestamp: baseTime + (i * 1000), // 1 second apart
        });
      }

      const speed = tracker.getTypingSpeed();
      // Should use last 20 keys: (20-1) keys over 19 seconds = 60 keys per minute
      expect(speed).toBe(60);
    });

    test('should return 0 for zero time span', () => {
      const timestamp = Date.now();

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp,
      });

      tracker.recordKeyEvent({
        key: 'b',
        modifiers: {},
        timestamp, // Same timestamp
      });

      expect(tracker.getTypingSpeed()).toBe(0);
    });

    test('should return 0 for negative time span', () => {
      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: Date.now() + 1000,
      });

      tracker.recordKeyEvent({
        key: 'b',
        modifiers: {},
        timestamp: Date.now(), // Earlier timestamp
      });

      expect(tracker.getTypingSpeed()).toBe(0);
    });
  });

  describe('getAverageKeyInterval', () => {
    test('should return 0 for less than 2 events', () => {
      expect(tracker.getAverageKeyInterval()).toBe(0);

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: Date.now(),
      });

      expect(tracker.getAverageKeyInterval()).toBe(0);
    });

    test('should calculate average interval correctly', () => {
      const baseTime = Date.now();

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: baseTime,
      });

      tracker.recordKeyEvent({
        key: 'b',
        modifiers: {},
        timestamp: baseTime + 100,
      });

      tracker.recordKeyEvent({
        key: 'c',
        modifiers: {},
        timestamp: baseTime + 300,
      });

      const averageInterval = tracker.getAverageKeyInterval();
      // Intervals: 100, 200 -> average = 150
      expect(averageInterval).toBe(150);
    });

    test('should handle single interval', () => {
      const baseTime = Date.now();

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: baseTime,
      });

      tracker.recordKeyEvent({
        key: 'b',
        modifiers: {},
        timestamp: baseTime + 500,
      });

      const averageInterval = tracker.getAverageKeyInterval();
      expect(averageInterval).toBe(500);
    });
  });

  describe('getSessionMetrics', () => {
    test('should return empty metrics for no data', () => {
      const metrics = tracker.getSessionMetrics();

      expect(metrics).toEqual({
        totalKeys: 0,
        uniqueKeys: 0,
        sessionDuration: 0,
        averageKeysPerMinute: 0,
        mostUsedKey: null,
      });
    });

    test('should calculate session metrics correctly', () => {
      const baseTime = Date.now();

      // Record some events
      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: baseTime,
      });

      tracker.recordKeyEvent({
        key: 'b',
        modifiers: {},
        timestamp: baseTime + 30000, // 30 seconds later
      });

      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: baseTime + 60000, // 60 seconds later
      });

      const metrics = tracker.getSessionMetrics();

      expect(metrics.totalKeys).toBe(3);
      expect(metrics.uniqueKeys).toBe(2);
      expect(metrics.sessionDuration).toBe(60000);
      expect(metrics.averageKeysPerMinute).toBe(3); // 3 keys per minute
      expect(metrics.mostUsedKey).toBe('a'); // 2 presses vs 1 for 'b'
    });

    test('should handle single event correctly', () => {
      tracker.recordKeyEvent({
        key: 'single',
        modifiers: {},
        timestamp: Date.now(),
      });

      const metrics = tracker.getSessionMetrics();

      expect(metrics.totalKeys).toBe(1);
      expect(metrics.uniqueKeys).toBe(1);
      expect(metrics.sessionDuration).toBe(0);
      expect(metrics.averageKeysPerMinute).toBe(0);
      expect(metrics.mostUsedKey).toBe('single');
    });

    test('should find most used key correctly', () => {
      // Record different counts for different keys
      for (let i = 0; i < 3; i++) {
        tracker.recordKeyEvent({
          key: 'common',
          modifiers: {},
          timestamp: Date.now() + i,
        });
      }

      tracker.recordKeyEvent({
        key: 'rare',
        modifiers: {},
        timestamp: Date.now(),
      });

      const metrics = tracker.getSessionMetrics();
      expect(metrics.mostUsedKey).toBe('common');
    });
  });

  describe('clear', () => {
    test('should clear all data', () => {
      // Add some data
      tracker.recordKeyEvent({
        key: 'a',
        modifiers: {},
        timestamp: Date.now(),
      });

      tracker.startSequence('test');

      // Verify data exists
      expect(tracker.getKeyHistory()).toHaveLength(1);
      expect(tracker.getAllKeyMetrics().size).toBe(1);
      expect(tracker.getActiveSequence()).not.toBeNull();

      // Clear
      tracker.clear();

      // Verify data is cleared
      expect(tracker.getKeyHistory()).toHaveLength(0);
      expect(tracker.getAllKeyMetrics().size).toBe(0);
      expect(tracker.getActiveSequence()).toBeNull();
    });
  });

  describe('pruneOldData', () => {
    test('should remove old events', () => {
      const now = Date.now();

      // Add old events
      tracker.recordKeyEvent({
        key: 'old1',
        modifiers: {},
        timestamp: now - 10000, // 10 seconds ago
      });

      tracker.recordKeyEvent({
        key: 'old2',
        modifiers: {},
        timestamp: now - 5000, // 5 seconds ago
      });

      // Add recent event
      tracker.recordKeyEvent({
        key: 'recent',
        modifiers: {},
        timestamp: now - 1000, // 1 second ago
      });

      // Prune events older than 3 seconds
      const removedCount = tracker.pruneOldData(3000);

      expect(removedCount).toBe(2);
      const history = tracker.getKeyHistory();
      expect(history).toHaveLength(1);
      expect(history[0].key).toBe('recent');
    });

    test('should return 0 when no old data', () => {
      tracker.recordKeyEvent({
        key: 'recent',
        modifiers: {},
        timestamp: Date.now(),
      });

      const removedCount = tracker.pruneOldData(10000);

      expect(removedCount).toBe(0);
      expect(tracker.getKeyHistory()).toHaveLength(1);
    });

    test('should handle empty history', () => {
      const removedCount = tracker.pruneOldData(5000);

      expect(removedCount).toBe(0);
      expect(tracker.getKeyHistory()).toHaveLength(0);
    });

    test('should remove all events if all are old', () => {
      const oldTime = Date.now() - 10000;

      tracker.recordKeyEvent({
        key: 'old1',
        modifiers: {},
        timestamp: oldTime,
      });

      tracker.recordKeyEvent({
        key: 'old2',
        modifiers: {},
        timestamp: oldTime + 100,
      });

      const removedCount = tracker.pruneOldData(5000);

      expect(removedCount).toBe(2);
      expect(tracker.getKeyHistory()).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('should handle very large timestamps', () => {
      const largeTimestamp = Number.MAX_SAFE_INTEGER;

      tracker.recordKeyEvent({
        key: 'large',
        modifiers: {},
        timestamp: largeTimestamp,
      });

      const metrics = tracker.getKeyMetrics('large');
      expect(metrics?.lastPressed).toBe(largeTimestamp);
    });

    test('should handle zero timestamps', () => {
      tracker.recordKeyEvent({
        key: 'zero1',
        modifiers: {},
        timestamp: 0,
      });

      tracker.recordKeyEvent({
        key: 'zero2',
        modifiers: {},
        timestamp: 0,
      });

      expect(tracker.getTypingSpeed()).toBe(0);
      expect(tracker.getAverageKeyInterval()).toBe(0);
    });

    test('should handle special characters in keys', () => {
      const specialKeys = ['@', '#', '$', '%', '^', '&', '*', '(', ')', 'Enter', 'Escape', 'ArrowUp'];

      specialKeys.forEach((key, index) => {
        tracker.recordKeyEvent({
          key,
          modifiers: {},
          timestamp: Date.now() + index,
        });
      });

      expect(tracker.getAllKeyMetrics().size).toBe(specialKeys.length);
      specialKeys.forEach(key => {
        expect(tracker.getKeyMetrics(key)).not.toBeNull();
      });
    });

    test('should handle empty string key', () => {
      tracker.recordKeyEvent({
        key: '',
        modifiers: {},
        timestamp: Date.now(),
      });

      const metrics = tracker.getKeyMetrics('');
      expect(metrics?.count).toBe(1);
    });

    test('should handle modifiers in key events', () => {
      tracker.recordKeyEvent({
        key: 'a',
        modifiers: { ctrl: true, shift: true },
        timestamp: Date.now(),
      });

      const metrics = tracker.getKeyMetrics('a');
      expect(metrics?.count).toBe(1);
    });

    test('should handle sequence operations with performance.now() timing', () => {
      const mockPerformanceNow = jest.spyOn(performance, 'now').mockReturnValue(12345);

      tracker.startSequence('perf-test');
      const sequence = tracker.getActiveSequence();

      expect(sequence?.startTime).toBe(12345);

      mockPerformanceNow.mockRestore();
    });
  });
});