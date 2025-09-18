import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { BusMetrics, EventBusMetrics } from '../../../src/events/helpers/BusMetrics';

describe('BusMetrics', () => {
  let busMetrics: BusMetrics;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    originalDateNow = Date.now;
    busMetrics = new BusMetrics();
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('constructor', () => {
    test('should initialize with zero metrics', () => {
      const metrics = busMetrics.getMetrics();

      expect(metrics.totalMessages).toBe(0);
      expect(metrics.messagesProcessed).toBe(0);
      expect(metrics.messagesDropped).toBe(0);
      expect(metrics.averageProcessingTime).toBe(0);
      expect(metrics.totalProcessingTime).toBe(0);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.peakQueueSize).toBe(0);
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });

    test('should set start time on creation', () => {
      const startTime = Date.now();
      const metrics = new BusMetrics();
      const endTime = Date.now();

      const currentMetrics = metrics.getMetrics();
      expect(currentMetrics.uptime).toBeGreaterThanOrEqual(0);
      expect(currentMetrics.uptime).toBeLessThanOrEqual(endTime - startTime);
    });
  });

  describe('recordMessage', () => {
    test('should increment total messages', () => {
      busMetrics.recordMessage();
      expect(busMetrics.getMetrics().totalMessages).toBe(1);

      busMetrics.recordMessage();
      expect(busMetrics.getMetrics().totalMessages).toBe(2);
    });

    test('should handle multiple message recordings', () => {
      for (let i = 0; i < 10; i++) {
        busMetrics.recordMessage();
      }
      expect(busMetrics.getMetrics().totalMessages).toBe(10);
    });
  });

  describe('recordProcessedMessage', () => {
    test('should increment processed messages and update processing time', () => {
      busMetrics.recordProcessedMessage(100);

      const metrics = busMetrics.getMetrics();
      expect(metrics.messagesProcessed).toBe(1);
      expect(metrics.totalProcessingTime).toBe(100);
      expect(metrics.averageProcessingTime).toBe(100);
    });

    test('should calculate correct average processing time', () => {
      busMetrics.recordProcessedMessage(100);
      busMetrics.recordProcessedMessage(200);
      busMetrics.recordProcessedMessage(300);

      const metrics = busMetrics.getMetrics();
      expect(metrics.messagesProcessed).toBe(3);
      expect(metrics.totalProcessingTime).toBe(600);
      expect(metrics.averageProcessingTime).toBe(200);
    });

    test('should handle zero processing time', () => {
      busMetrics.recordProcessedMessage(0);

      const metrics = busMetrics.getMetrics();
      expect(metrics.messagesProcessed).toBe(1);
      expect(metrics.totalProcessingTime).toBe(0);
      expect(metrics.averageProcessingTime).toBe(0);
    });

    test('should handle fractional processing times', () => {
      busMetrics.recordProcessedMessage(10.5);
      busMetrics.recordProcessedMessage(20.3);

      const metrics = busMetrics.getMetrics();
      expect(metrics.messagesProcessed).toBe(2);
      expect(metrics.totalProcessingTime).toBe(30.8);
      expect(metrics.averageProcessingTime).toBe(15.4);
    });

    test('should handle large processing times', () => {
      busMetrics.recordProcessedMessage(1000000);

      const metrics = busMetrics.getMetrics();
      expect(metrics.messagesProcessed).toBe(1);
      expect(metrics.totalProcessingTime).toBe(1000000);
      expect(metrics.averageProcessingTime).toBe(1000000);
    });
  });

  describe('recordDroppedMessage', () => {
    test('should increment dropped messages', () => {
      busMetrics.recordDroppedMessage();
      expect(busMetrics.getMetrics().messagesDropped).toBe(1);

      busMetrics.recordDroppedMessage();
      expect(busMetrics.getMetrics().messagesDropped).toBe(2);
    });

    test('should handle multiple dropped messages', () => {
      for (let i = 0; i < 5; i++) {
        busMetrics.recordDroppedMessage();
      }
      expect(busMetrics.getMetrics().messagesDropped).toBe(5);
    });
  });

  describe('recordError', () => {
    test('should increment error count', () => {
      busMetrics.recordError();
      expect(busMetrics.getMetrics().errorCount).toBe(1);

      busMetrics.recordError();
      expect(busMetrics.getMetrics().errorCount).toBe(2);
    });

    test('should handle multiple errors', () => {
      for (let i = 0; i < 3; i++) {
        busMetrics.recordError();
      }
      expect(busMetrics.getMetrics().errorCount).toBe(3);
    });
  });

  describe('updatePeakQueueSize', () => {
    test('should update peak queue size when current size is larger', () => {
      busMetrics.updatePeakQueueSize(10);
      expect(busMetrics.getMetrics().peakQueueSize).toBe(10);

      busMetrics.updatePeakQueueSize(15);
      expect(busMetrics.getMetrics().peakQueueSize).toBe(15);
    });

    test('should not update peak queue size when current size is smaller', () => {
      busMetrics.updatePeakQueueSize(20);
      expect(busMetrics.getMetrics().peakQueueSize).toBe(20);

      busMetrics.updatePeakQueueSize(15);
      expect(busMetrics.getMetrics().peakQueueSize).toBe(20);

      busMetrics.updatePeakQueueSize(0);
      expect(busMetrics.getMetrics().peakQueueSize).toBe(20);
    });

    test('should handle zero queue size', () => {
      busMetrics.updatePeakQueueSize(0);
      expect(busMetrics.getMetrics().peakQueueSize).toBe(0);
    });

    test('should handle negative queue size', () => {
      busMetrics.updatePeakQueueSize(-5);
      expect(busMetrics.getMetrics().peakQueueSize).toBe(0);

      busMetrics.updatePeakQueueSize(10);
      busMetrics.updatePeakQueueSize(-1);
      expect(busMetrics.getMetrics().peakQueueSize).toBe(10);
    });

    test('should handle large queue sizes', () => {
      busMetrics.updatePeakQueueSize(1000000);
      expect(busMetrics.getMetrics().peakQueueSize).toBe(1000000);
    });
  });

  describe('getMetrics', () => {
    test('should return metrics with current uptime', () => {
      const mockStartTime = 1000;
      const mockCurrentTime = 5000;

      Date.now = mock(() => mockStartTime);
      const metrics = new BusMetrics();

      Date.now = mock(() => mockCurrentTime);
      const result = metrics.getMetrics();

      expect(result.uptime).toBe(4000);
    });

    test('should return a copy of metrics (not reference)', () => {
      const metrics1 = busMetrics.getMetrics();
      const metrics2 = busMetrics.getMetrics();

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });

    test('should include all expected properties', () => {
      const metrics = busMetrics.getMetrics();

      expect(metrics).toHaveProperty('totalMessages');
      expect(metrics).toHaveProperty('messagesProcessed');
      expect(metrics).toHaveProperty('messagesDropped');
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('totalProcessingTime');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('peakQueueSize');
      expect(metrics).toHaveProperty('uptime');
    });
  });

  describe('getProcessingRate', () => {
    test('should return zero when no time has passed', () => {
      const mockTime = 1000;
      Date.now = mock(() => mockTime);

      const metrics = new BusMetrics();
      metrics.recordProcessedMessage(100);

      expect(metrics.getProcessingRate()).toBe(0);
    });

    test('should calculate correct processing rate', () => {
      const mockStartTime = 1000;
      const mockCurrentTime = 6000; // 5 seconds later

      Date.now = mock(() => mockStartTime);
      const metrics = new BusMetrics();

      // Process 10 messages
      for (let i = 0; i < 10; i++) {
        metrics.recordProcessedMessage(100);
      }

      Date.now = mock(() => mockCurrentTime);
      const rate = metrics.getProcessingRate();

      expect(rate).toBe(2); // 10 messages / 5 seconds = 2 msg/sec
    });

    test('should handle fractional rates', () => {
      const mockStartTime = 1000;
      const mockCurrentTime = 4000; // 3 seconds later

      Date.now = mock(() => mockStartTime);
      const metrics = new BusMetrics();

      metrics.recordProcessedMessage(100);
      metrics.recordProcessedMessage(200);

      Date.now = mock(() => mockCurrentTime);
      const rate = metrics.getProcessingRate();

      expect(rate).toBeCloseTo(0.6667, 3); // 2 messages / 3 seconds
    });

    test('should return zero when no messages processed', () => {
      const mockStartTime = 1000;
      const mockCurrentTime = 5000;

      Date.now = mock(() => mockStartTime);
      const metrics = new BusMetrics();

      Date.now = mock(() => mockCurrentTime);
      expect(metrics.getProcessingRate()).toBe(0);
    });
  });

  describe('getErrorRate', () => {
    test('should return zero when no messages recorded', () => {
      expect(busMetrics.getErrorRate()).toBe(0);
    });

    test('should return zero when no errors recorded', () => {
      busMetrics.recordMessage();
      busMetrics.recordMessage();
      expect(busMetrics.getErrorRate()).toBe(0);
    });

    test('should calculate correct error rate', () => {
      busMetrics.recordMessage();
      busMetrics.recordMessage();
      busMetrics.recordMessage();
      busMetrics.recordMessage();

      busMetrics.recordError();

      expect(busMetrics.getErrorRate()).toBe(25); // 1 error out of 4 messages = 25%
    });

    test('should handle 100% error rate', () => {
      busMetrics.recordMessage();
      busMetrics.recordError();

      expect(busMetrics.getErrorRate()).toBe(100);
    });

    test('should handle fractional error rates', () => {
      for (let i = 0; i < 3; i++) {
        busMetrics.recordMessage();
      }
      busMetrics.recordError();

      expect(busMetrics.getErrorRate()).toBeCloseTo(33.3333, 3);
    });

    test('should handle multiple errors', () => {
      for (let i = 0; i < 10; i++) {
        busMetrics.recordMessage();
      }
      for (let i = 0; i < 3; i++) {
        busMetrics.recordError();
      }

      expect(busMetrics.getErrorRate()).toBe(30);
    });
  });

  describe('getDropRate', () => {
    test('should return zero when no messages recorded', () => {
      expect(busMetrics.getDropRate()).toBe(0);
    });

    test('should return zero when no messages dropped', () => {
      busMetrics.recordMessage();
      busMetrics.recordMessage();
      expect(busMetrics.getDropRate()).toBe(0);
    });

    test('should calculate correct drop rate', () => {
      busMetrics.recordMessage();
      busMetrics.recordMessage();
      busMetrics.recordMessage();
      busMetrics.recordMessage();

      busMetrics.recordDroppedMessage();

      expect(busMetrics.getDropRate()).toBe(25); // 1 dropped out of 4 messages = 25%
    });

    test('should handle 100% drop rate', () => {
      busMetrics.recordMessage();
      busMetrics.recordDroppedMessage();

      expect(busMetrics.getDropRate()).toBe(100);
    });

    test('should handle fractional drop rates', () => {
      for (let i = 0; i < 7; i++) {
        busMetrics.recordMessage();
      }
      busMetrics.recordDroppedMessage();

      expect(busMetrics.getDropRate()).toBeCloseTo(14.2857, 3);
    });

    test('should handle multiple dropped messages', () => {
      for (let i = 0; i < 20; i++) {
        busMetrics.recordMessage();
      }
      for (let i = 0; i < 5; i++) {
        busMetrics.recordDroppedMessage();
      }

      expect(busMetrics.getDropRate()).toBe(25);
    });
  });

  describe('getHealthScore', () => {
    test('should return 100 when no errors or drops', () => {
      busMetrics.recordMessage();
      busMetrics.recordProcessedMessage(100);

      expect(busMetrics.getHealthScore()).toBe(100);
    });

    test('should calculate health score with errors', () => {
      for (let i = 0; i < 10; i++) {
        busMetrics.recordMessage();
      }
      busMetrics.recordError(); // 10% error rate

      const expectedScore = 100 - 10 * 2; // 10% error rate * 2 = -20
      expect(busMetrics.getHealthScore()).toBe(expectedScore);
    });

    test('should calculate health score with drops', () => {
      for (let i = 0; i < 10; i++) {
        busMetrics.recordMessage();
      }
      busMetrics.recordDroppedMessage(); // 10% drop rate

      const expectedScore = 100 - 10 * 1.5; // 10% drop rate * 1.5 = -15
      expect(busMetrics.getHealthScore()).toBe(85);
    });

    test('should calculate health score with both errors and drops', () => {
      for (let i = 0; i < 10; i++) {
        busMetrics.recordMessage();
      }
      busMetrics.recordError(); // 10% error rate
      busMetrics.recordDroppedMessage(); // 10% drop rate

      const expectedScore = 100 - 10 * 2 - 10 * 1.5; // -20 - 15 = -35
      expect(busMetrics.getHealthScore()).toBe(65);
    });

    test('should not return negative health score', () => {
      busMetrics.recordMessage();
      for (let i = 0; i < 10; i++) {
        busMetrics.recordError();
      }

      expect(busMetrics.getHealthScore()).toBe(0);
    });

    test('should round health score to integer', () => {
      for (let i = 0; i < 3; i++) {
        busMetrics.recordMessage();
      }
      busMetrics.recordError(); // 33.33% error rate

      const healthScore = busMetrics.getHealthScore();
      expect(Number.isInteger(healthScore)).toBe(true);
    });

    test('should handle perfect health score', () => {
      for (let i = 0; i < 100; i++) {
        busMetrics.recordMessage();
        busMetrics.recordProcessedMessage(50);
      }

      expect(busMetrics.getHealthScore()).toBe(100);
    });
  });

  describe('reset', () => {
    test('should reset all metrics to zero', () => {
      // Add some data
      busMetrics.recordMessage();
      busMetrics.recordProcessedMessage(100);
      busMetrics.recordDroppedMessage();
      busMetrics.recordError();
      busMetrics.updatePeakQueueSize(50);

      busMetrics.reset();

      const metrics = busMetrics.getMetrics();
      expect(metrics.totalMessages).toBe(0);
      expect(metrics.messagesProcessed).toBe(0);
      expect(metrics.messagesDropped).toBe(0);
      expect(metrics.averageProcessingTime).toBe(0);
      expect(metrics.totalProcessingTime).toBe(0);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.peakQueueSize).toBe(0);
    });

    test('should reset start time', () => {
      const mockTime1 = 1000;
      const mockTime2 = 5000;

      Date.now = mock(() => mockTime1);
      const metrics = new BusMetrics();

      Date.now = mock(() => mockTime2);
      metrics.reset();

      const uptime = metrics.getMetrics().uptime;
      expect(uptime).toBe(0);
    });

    test('should allow recording new metrics after reset', () => {
      busMetrics.recordMessage();
      busMetrics.reset();

      busMetrics.recordMessage();
      busMetrics.recordProcessedMessage(200);

      const metrics = busMetrics.getMetrics();
      expect(metrics.totalMessages).toBe(1);
      expect(metrics.messagesProcessed).toBe(1);
      expect(metrics.averageProcessingTime).toBe(200);
    });
  });

  describe('getSummary', () => {
    test('should return summary with all calculated values', () => {
      const mockStartTime = 1000;
      const mockCurrentTime = 6000;

      Date.now = mock(() => mockStartTime);
      const metrics = new BusMetrics();

      // Add some test data
      for (let i = 0; i < 10; i++) {
        metrics.recordMessage();
      }
      for (let i = 0; i < 8; i++) {
        metrics.recordProcessedMessage(100);
      }
      metrics.recordDroppedMessage();
      metrics.recordError();

      Date.now = mock(() => mockCurrentTime);

      const summary = metrics.getSummary();

      expect(summary).toHaveProperty('throughput');
      expect(summary).toHaveProperty('errorRate');
      expect(summary).toHaveProperty('dropRate');
      expect(summary).toHaveProperty('healthScore');
      expect(summary).toHaveProperty('averageProcessingTime');
      expect(summary).toHaveProperty('uptime');

      expect(summary.throughput).toBe(1.6); // 8 processed / 5 seconds
      expect(summary.errorRate).toBe(10); // 1 error / 10 messages
      expect(summary.dropRate).toBe(10); // 1 drop / 10 messages
      expect(summary.averageProcessingTime).toBe(100);
      expect(summary.uptime).toBe(5000);
    });

    test('should handle zero values in summary', () => {
      const summary = busMetrics.getSummary();

      expect(summary.throughput).toBe(0);
      expect(summary.errorRate).toBe(0);
      expect(summary.dropRate).toBe(0);
      expect(summary.healthScore).toBe(100);
      expect(summary.averageProcessingTime).toBe(0);
      expect(summary.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('export', () => {
    test('should export all metrics and calculated values', () => {
      const mockStartTime = 1000;
      const mockCurrentTime = 4000;

      Date.now = mock(() => mockStartTime);
      const metrics = new BusMetrics();

      // Add test data
      for (let i = 0; i < 6; i++) {
        metrics.recordMessage();
      }
      for (let i = 0; i < 3; i++) {
        metrics.recordProcessedMessage(150);
      }
      metrics.recordDroppedMessage();
      metrics.recordError();
      metrics.updatePeakQueueSize(25);

      Date.now = mock(() => mockCurrentTime);

      const exported = metrics.export();

      // Check base metrics
      expect(exported.totalMessages).toBe(6);
      expect(exported.messagesProcessed).toBe(3);
      expect(exported.messagesDropped).toBe(1);
      expect(exported.errorCount).toBe(1);
      expect(exported.peakQueueSize).toBe(25);
      expect(exported.averageProcessingTime).toBe(150);
      expect(exported.totalProcessingTime).toBe(450);
      expect(exported.uptime).toBe(3000);

      // Check calculated values
      expect(exported.processingRate).toBe(1); // 3 processed / 3 seconds
      expect(exported.errorRate).toBeCloseTo(16.6667, 3); // 1 error / 6 messages
      expect(exported.dropRate).toBeCloseTo(16.6667, 3); // 1 drop / 6 messages
      expect(exported.healthScore).toBe(42); // 100 - 16.67*2 - 16.67*1.5 = ~42
    });

    test('should export complete data structure', () => {
      const exported = busMetrics.export();

      // Base EventBusMetrics properties
      expect(exported).toHaveProperty('totalMessages');
      expect(exported).toHaveProperty('messagesProcessed');
      expect(exported).toHaveProperty('messagesDropped');
      expect(exported).toHaveProperty('averageProcessingTime');
      expect(exported).toHaveProperty('totalProcessingTime');
      expect(exported).toHaveProperty('errorCount');
      expect(exported).toHaveProperty('peakQueueSize');
      expect(exported).toHaveProperty('uptime');

      // Additional calculated properties
      expect(exported).toHaveProperty('processingRate');
      expect(exported).toHaveProperty('errorRate');
      expect(exported).toHaveProperty('dropRate');
      expect(exported).toHaveProperty('healthScore');
    });
  });

  describe('integration tests', () => {
    test('should handle realistic event bus scenario', () => {
      const mockStartTime = 1000;
      Date.now = mock(() => mockStartTime);

      const metrics = new BusMetrics();

      // Simulate 1 minute of event processing
      Date.now = mock(() => mockStartTime + 60000);

      // Process 1000 messages
      for (let i = 0; i < 1000; i++) {
        metrics.recordMessage();

        // 95% successfully processed
        if (i < 950) {
          metrics.recordProcessedMessage(Math.random() * 100 + 50);
        }
        // 3% dropped
        else if (i < 980) {
          metrics.recordDroppedMessage();
        }
        // 2% errors
        else {
          metrics.recordError();
        }

        // Simulate varying queue sizes
        metrics.updatePeakQueueSize(Math.floor(Math.random() * 50));
      }

      const summary = metrics.getSummary();
      const exported = metrics.export();

      expect(summary.throughput).toBeCloseTo(15.83, 1); // ~950 processed / 60 seconds
      expect(summary.errorRate).toBe(2);
      expect(summary.dropRate).toBe(3);
      expect(summary.healthScore).toBe(92); // 100 - 2*2 - 3*1.5 = 91.5 -> 92

      expect(exported.totalMessages).toBe(1000);
      expect(exported.messagesProcessed).toBe(950);
      expect(exported.messagesDropped).toBe(30);
      expect(exported.errorCount).toBe(20);
    });

    test('should handle edge case with extreme values', () => {
      // Test with very large processing times
      busMetrics.recordMessage();
      busMetrics.recordProcessedMessage(Number.MAX_SAFE_INTEGER);

      const metrics = busMetrics.getMetrics();
      expect(metrics.averageProcessingTime).toBe(Number.MAX_SAFE_INTEGER);
      expect(metrics.totalProcessingTime).toBe(Number.MAX_SAFE_INTEGER);
    });

    test('should maintain consistency across operations', () => {
      // Record various metrics and ensure consistency
      for (let i = 0; i < 50; i++) {
        busMetrics.recordMessage();
      }

      for (let i = 0; i < 40; i++) {
        busMetrics.recordProcessedMessage(100);
      }

      for (let i = 0; i < 5; i++) {
        busMetrics.recordDroppedMessage();
      }

      for (let i = 0; i < 3; i++) {
        busMetrics.recordError();
      }

      busMetrics.updatePeakQueueSize(75);

      const metrics = busMetrics.getMetrics();
      const summary = busMetrics.getSummary();

      // Verify consistency
      expect(metrics.totalMessages).toBe(50);
      expect(metrics.messagesProcessed).toBe(40);
      expect(metrics.messagesDropped).toBe(5);
      expect(metrics.errorCount).toBe(3);
      expect(summary.errorRate).toBe(6); // 3/50 = 6%
      expect(summary.dropRate).toBe(10); // 5/50 = 10%
    });
  });

  describe('EventBusMetrics interface', () => {
    test('should have all required properties with correct types', () => {
      const metrics: EventBusMetrics = {
        totalMessages: 0,
        messagesProcessed: 0,
        messagesDropped: 0,
        averageProcessingTime: 0,
        totalProcessingTime: 0,
        errorCount: 0,
        peakQueueSize: 0,
        uptime: 0,
      };

      expect(typeof metrics.totalMessages).toBe('number');
      expect(typeof metrics.messagesProcessed).toBe('number');
      expect(typeof metrics.messagesDropped).toBe('number');
      expect(typeof metrics.averageProcessingTime).toBe('number');
      expect(typeof metrics.totalProcessingTime).toBe('number');
      expect(typeof metrics.errorCount).toBe('number');
      expect(typeof metrics.peakQueueSize).toBe('number');
      expect(typeof metrics.uptime).toBe('number');
    });

    test('should be compatible with BusMetrics output', () => {
      const busMetrics = new BusMetrics();
      const metrics: EventBusMetrics = busMetrics.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalMessages).toBe('number');
    });
  });
});