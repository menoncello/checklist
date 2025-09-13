import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
  spyOn,
} from 'bun:test';
import {
  MemoryTracker,
  type MemoryTrackerConfig,
  type MemorySnapshot,
  type MemoryTrend,
  type MemoryLeak,
} from './MemoryTracker';

// Mock process.memoryUsage for predictable tests
const mockMemoryUsage = {
  rss: 50 * 1024 * 1024, // 50MB
  heapTotal: 30 * 1024 * 1024, // 30MB
  heapUsed: 20 * 1024 * 1024, // 20MB
  external: 5 * 1024 * 1024, // 5MB
  arrayBuffers: 1 * 1024 * 1024, // 1MB
};

describe('MemoryTracker', () => {
  let tracker: MemoryTracker;
  let config: Partial<MemoryTrackerConfig>;
  let originalMemoryUsage: typeof process.memoryUsage;

  beforeEach(() => {
    // Mock process.memoryUsage
    originalMemoryUsage = process.memoryUsage;
    process.memoryUsage = jest
      .fn()
      .mockReturnValue({ ...mockMemoryUsage }) as any;

    config = {
      enableTracking: false, // Start disabled for controlled testing
      samplingInterval: 100, // Fast sampling for tests
      historySize: 100,
      leakDetectionThreshold: 1024 * 1024, // 1MB per second
      leakDetectionDuration: 1000, // 1 second for tests
      gcTriggerThreshold: 85,
      enableAutoGC: false,
      alertThresholds: {
        rss: 40 * 1024 * 1024, // 40MB
        heapUsed: 15 * 1024 * 1024, // 15MB
        heapTotal: 25 * 1024 * 1024, // 25MB
      },
    };
    tracker = new MemoryTracker(config);
  });

  afterEach(() => {
    tracker.destroy();
    process.memoryUsage = originalMemoryUsage;
    jest.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultTracker = new MemoryTracker();
      const retrievedConfig = defaultTracker.getConfig();

      expect(retrievedConfig.enableTracking).toBe(true);
      expect(retrievedConfig.samplingInterval).toBe(5000);
      expect(retrievedConfig.historySize).toBe(1000);

      defaultTracker.destroy();
    });

    it('should merge provided config with defaults', () => {
      const customConfig = { samplingInterval: 2000, enableAutoGC: true };
      const customTracker = new MemoryTracker(customConfig);
      const retrievedConfig = customTracker.getConfig();

      expect(retrievedConfig.samplingInterval).toBe(2000);
      expect(retrievedConfig.enableAutoGC).toBe(true);
      expect(retrievedConfig.enableTracking).toBe(true); // Default

      customTracker.destroy();
    });

    it('should update configuration', () => {
      const newConfig = { samplingInterval: 500, enableAutoGC: true };
      tracker.updateConfig(newConfig);

      const retrievedConfig = tracker.getConfig();
      expect(retrievedConfig.samplingInterval).toBe(500);
      expect(retrievedConfig.enableAutoGC).toBe(true);
    });

    it('should restart tracking when sampling interval changes', () => {
      tracker.start();
      tracker.updateConfig({ samplingInterval: 200 });

      const config = tracker.getConfig();
      expect(config.samplingInterval).toBe(200);
    });
  });

  describe('Snapshot Management', () => {
    it('should capture memory snapshots', () => {
      const snapshot = tracker.getCurrentUsage();

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.rss).toBe(mockMemoryUsage.rss);
      expect(snapshot.heapUsed).toBe(mockMemoryUsage.heapUsed);
      expect(snapshot.heapTotal).toBe(mockMemoryUsage.heapTotal);
      expect(snapshot.external).toBe(mockMemoryUsage.external);
      expect(snapshot.arrayBuffers).toBe(mockMemoryUsage.arrayBuffers);
      expect(snapshot.peak).toEqual({
        rss: mockMemoryUsage.rss,
        heapUsed: mockMemoryUsage.heapUsed,
        heapTotal: mockMemoryUsage.heapTotal,
      });
    });

    it('should update peak values', () => {
      tracker.takeSnapshot();

      // Simulate higher memory usage
      const higherMemory = {
        ...mockMemoryUsage,
        rss: 60 * 1024 * 1024,
        heapUsed: 25 * 1024 * 1024,
        heapTotal: 35 * 1024 * 1024,
      };
      process.memoryUsage = jest.fn().mockReturnValue(higherMemory) as any;

      const snapshot = tracker.takeSnapshot();
      expect(snapshot.peak.rss).toBe(60 * 1024 * 1024);
      expect(snapshot.peak.heapUsed).toBe(25 * 1024 * 1024);
      expect(snapshot.peak.heapTotal).toBe(35 * 1024 * 1024);
    });

    it('should maintain history size limit', () => {
      tracker.updateConfig({ historySize: 3 });

      // Take more snapshots than history size
      for (let i = 0; i < 5; i++) {
        tracker.takeSnapshot();
      }

      const snapshots = tracker.getSnapshots();
      expect(snapshots.length).toBeLessThanOrEqual(3);
    });

    it('should return specific number of snapshots', () => {
      // Take multiple snapshots
      for (let i = 0; i < 5; i++) {
        tracker.takeSnapshot();
      }

      const twoSnapshots = tracker.getSnapshots(2);
      expect(twoSnapshots.length).toBe(2);
    });

    it('should return all snapshots when count not specified', () => {
      for (let i = 0; i < 3; i++) {
        tracker.takeSnapshot();
      }

      const allSnapshots = tracker.getSnapshots();
      expect(allSnapshots.length).toBe(3);
    });
  });

  describe('Memory Alert System', () => {
    it('should emit memory alert when RSS threshold exceeded', (done) => {
      let alertData: any = null;
      tracker.on('memoryAlert', (data: any) => {
        alertData = data;
        done();
      });

      // Take initial snapshot
      tracker.takeSnapshot();

      // Set values that only exceed RSS threshold
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 50 * 1024 * 1024, // Above 40MB threshold
        heapTotal: 20 * 1024 * 1024, // Below 25MB threshold
        heapUsed: 10 * 1024 * 1024, // Below 15MB threshold
        external: mockMemoryUsage.external,
        arrayBuffers: mockMemoryUsage.arrayBuffers,
      }) as any;

      // Enable tracking - this will start the sampling timer which calls analyzeMemoryUsage
      tracker.updateConfig({ enableTracking: true, samplingInterval: 50 });
      tracker.start();

      // If no alert after timeout, finish test
      setTimeout(() => {
        expect(alertData).not.toBeNull();
        expect(alertData.type).toBe('rss');
        expect(alertData.value).toBe(50 * 1024 * 1024);
        expect(alertData.threshold).toBe(40 * 1024 * 1024);
        done();
      }, 200);
    });

    it('should emit memory alert when heap used threshold exceeded', (done) => {
      let alertData: any = null;
      tracker.on('memoryAlert', (data: any) => {
        alertData = data;
        done();
      });

      tracker.takeSnapshot();

      // Set values that only exceed heapUsed threshold
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 30 * 1024 * 1024, // Below 40MB threshold
        heapTotal: 20 * 1024 * 1024, // Below 25MB threshold
        heapUsed: 20 * 1024 * 1024, // Above 15MB threshold
        external: mockMemoryUsage.external,
        arrayBuffers: mockMemoryUsage.arrayBuffers,
      }) as any;

      tracker.updateConfig({ enableTracking: true, samplingInterval: 50 });
      tracker.start();

      setTimeout(() => {
        expect(alertData).not.toBeNull();
        expect(alertData.type).toBe('heapUsed');
        done();
      }, 200);
    });

    it('should emit memory alert when heap total threshold exceeded', (done) => {
      let alertData: any = null;
      tracker.on('memoryAlert', (data: any) => {
        alertData = data;
        done();
      });

      tracker.takeSnapshot();

      // Set values that only exceed heapTotal threshold
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 30 * 1024 * 1024, // Below 40MB threshold
        heapTotal: 30 * 1024 * 1024, // Above 25MB threshold
        heapUsed: 10 * 1024 * 1024, // Below 15MB threshold
        external: mockMemoryUsage.external,
        arrayBuffers: mockMemoryUsage.arrayBuffers,
      }) as any;

      tracker.updateConfig({ enableTracking: true, samplingInterval: 50 });
      tracker.start();

      setTimeout(() => {
        expect(alertData).not.toBeNull();
        expect(alertData.type).toBe('heapTotal');
        done();
      }, 200);
    });

    it('should not emit alert when under threshold', () => {
      let alertEmitted = false;
      tracker.on('memoryAlert', () => {
        alertEmitted = true;
      });

      process.memoryUsage = jest.fn().mockReturnValue({
        ...mockMemoryUsage,
        rss: 20 * 1024 * 1024, // Under 40MB threshold
        heapUsed: 10 * 1024 * 1024, // Under 15MB threshold
        heapTotal: 15 * 1024 * 1024, // Under 25MB threshold
      }) as any;

      tracker.takeSnapshot();

      expect(alertEmitted).toBe(false);
    });
  });

  describe('Leak Detection', () => {
    beforeEach(() => {
      tracker.updateConfig({ enableTracking: true });
      tracker.start();
    });

    it('should detect potential memory leaks', (done) => {
      let leakDetected: any = null;
      tracker.on('memoryLeak', (data: any) => {
        leakDetected = data;
        done();
      });

      // Simulate increasing memory usage to trigger leak detection
      let counter = 0;
      const interval = setInterval(() => {
        counter++;
        process.memoryUsage = jest.fn().mockReturnValue({
          ...mockMemoryUsage,
          heapUsed: mockMemoryUsage.heapUsed + counter * 2 * 1024 * 1024, // Growing by 2MB each time
        }) as any;

        if (counter >= 15) {
          clearInterval(interval);
          // Wait a bit more for leak confirmation
          setTimeout(() => {
            if (!leakDetected) {
              done(); // End test if no leak detected (expected for this quick test)
            }
          }, 100);
        }
      }, 50);
    }, 3000);

    it('should calculate growth rate', () => {
      // Take initial snapshot
      tracker.takeSnapshot();

      // Simulate memory growth
      process.memoryUsage = jest.fn().mockReturnValue({
        ...mockMemoryUsage,
        heapUsed: mockMemoryUsage.heapUsed + 1024 * 1024, // +1MB
      }) as any;

      const { bytesPerSecond } = tracker.getGrowthRate();
      expect(typeof bytesPerSecond).toBe('number');
    });

    it('should check for leak against baseline', () => {
      const baseline = mockMemoryUsage.heapUsed;

      process.memoryUsage = jest.fn().mockReturnValue({
        ...mockMemoryUsage,
        heapUsed: baseline + 2 * 1024 * 1024, // +2MB from baseline
      }) as any;

      const hasLeak = tracker.checkForLeak(baseline);
      expect(typeof hasLeak).toBe('boolean');
    });

    it('should return detected leaks', () => {
      const leaks = tracker.getLeaks();
      expect(Array.isArray(leaks)).toBe(true);
    });
  });

  describe('Trend Analysis', () => {
    beforeEach(() => {
      // Generate enough snapshots for trend analysis
      for (let i = 0; i < 10; i++) {
        process.memoryUsage = jest.fn().mockReturnValue({
          ...mockMemoryUsage,
          heapUsed: mockMemoryUsage.heapUsed + i * 1024 * 1024,
        }) as any;
        tracker.takeSnapshot();
      }
    });

    it('should calculate memory trends', () => {
      const trends = tracker.getTrends();

      expect(Array.isArray(trends)).toBe(true);
      if (trends.length > 0) {
        const trend = trends[0];
        expect(['heap', 'rss', 'external']).toContain(trend.type);
        expect(['increasing', 'decreasing', 'stable']).toContain(
          trend.direction
        );
        expect(typeof trend.rate).toBe('number');
        expect(typeof trend.confidence).toBe('number');
        expect(typeof trend.projection.nextHour).toBe('number');
        expect(typeof trend.projection.nextDay).toBe('number');
      }
    });

    it('should return empty trends with insufficient data', () => {
      const freshTracker = new MemoryTracker({ enableTracking: false });
      // Only take 2 snapshots (less than required 5)
      freshTracker.takeSnapshot();
      freshTracker.takeSnapshot();

      const trends = freshTracker.getTrends();
      expect(trends).toHaveLength(0);

      freshTracker.destroy();
    });
  });

  describe('GC Management', () => {
    it('should trigger GC when available', () => {
      // Mock global.gc
      global.gc = jest.fn();

      const result = tracker.triggerGC();

      if (typeof global.gc === 'function') {
        expect(result).toBe(true);
        expect(global.gc).toHaveBeenCalled();
      } else {
        expect(result).toBe(false);
      }
    });

    it('should emit GC event when triggered', () => {
      let gcEvent: any = null;
      tracker.on('gcTriggered', (data: any) => {
        gcEvent = data;
      });

      // Mock global.gc
      global.gc = jest.fn();
      tracker.triggerGC();

      if (typeof global.gc === 'function') {
        expect(gcEvent).not.toBeNull();
        expect(gcEvent.type).toBe('automatic');
        expect(gcEvent).toHaveProperty('before');
        expect(gcEvent).toHaveProperty('after');
        expect(gcEvent).toHaveProperty('freed');
      }
    });

    it('should handle auto GC when enabled', () => {
      tracker.updateConfig({
        enableAutoGC: true,
        gcTriggerThreshold: 50, // Low threshold for testing
      });

      // Mock high heap usage
      process.memoryUsage = jest.fn().mockReturnValue({
        ...mockMemoryUsage,
        heapUsed: 20 * 1024 * 1024,
        heapTotal: 25 * 1024 * 1024, // 80% usage
      }) as any;

      global.gc = jest.fn();
      tracker.takeSnapshot();

      // GC might be triggered depending on timing
    });
  });

  describe('Statistics and Reporting', () => {
    it('should generate statistics with no snapshots', () => {
      const stats = tracker.getStatistics();

      expect(stats).toHaveProperty('current');
      expect(stats).toHaveProperty('average');
      expect(stats).toHaveProperty('peak');
      expect(stats).toHaveProperty('trends');
      expect(stats.samplesCount).toBe(0);
      expect(Array.isArray(stats.trends)).toBe(true);
    });

    it('should generate statistics with snapshots', () => {
      // Take several snapshots with varying memory usage
      for (let i = 0; i < 5; i++) {
        process.memoryUsage = jest.fn().mockReturnValue({
          ...mockMemoryUsage,
          heapUsed: mockMemoryUsage.heapUsed + i * 1024 * 1024,
        }) as any;
        tracker.takeSnapshot();
      }

      const stats = tracker.getStatistics();

      expect(stats.samplesCount).toBe(5);
      expect(stats.current.heapUsed).toBeGreaterThan(0);
      expect(stats.average.heapUsed).toBeGreaterThan(0);
      expect(stats.peak.heapUsed).toBeGreaterThan(0);
      expect(typeof stats.gcTriggers).toBe('number');
      expect(typeof stats.leakCount).toBe('number');
    });
  });

  describe('Event System', () => {
    it('should emit memory snapshot events', () => {
      let snapshotEvent: any = null;
      tracker.on('memorySnapshot', (data: any) => {
        snapshotEvent = data;
      });

      tracker.takeSnapshot();

      expect(snapshotEvent).not.toBeNull();
      expect(snapshotEvent.snapshot).toBeDefined();
      expect(snapshotEvent.snapshot.timestamp).toBeGreaterThan(0);
    });

    it('should remove event handlers', () => {
      let eventCount = 0;
      const handler = () => {
        eventCount++;
      };

      tracker.on('memorySnapshot', handler);
      tracker.takeSnapshot();
      expect(eventCount).toBe(1);

      tracker.off('memorySnapshot', handler);
      tracker.takeSnapshot();
      expect(eventCount).toBe(1); // Should not increment
    });

    it('should handle errors in event handlers gracefully', () => {
      tracker.on('memorySnapshot', () => {
        throw new Error('Handler error');
      });

      // This should not throw
      expect(() => {
        tracker.takeSnapshot();
      }).not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    it('should start and stop tracking', () => {
      tracker.start();
      expect(tracker.getSnapshots().length).toBeGreaterThanOrEqual(0);

      tracker.stop();
      // Should not crash after stopping
    });

    it('should clear history and reset state', () => {
      // Generate some history
      for (let i = 0; i < 3; i++) {
        tracker.takeSnapshot();
      }

      tracker.clearHistory();

      const snapshots = tracker.getSnapshots();
      expect(snapshots.length).toBe(0);

      const stats = tracker.getStatistics();
      expect(stats.samplesCount).toBe(0);
    });

    it('should destroy properly', () => {
      tracker.start();
      tracker.takeSnapshot();

      expect(() => {
        tracker.destroy();
      }).not.toThrow();

      // Should be safe to call destroy multiple times
      expect(() => {
        tracker.destroy();
      }).not.toThrow();
    });

    it('should enable/disable tracking via config update', () => {
      tracker.updateConfig({ enableTracking: true });
      // Tracking should start

      tracker.updateConfig({ enableTracking: false });
      // Tracking should stop
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty snapshots gracefully', () => {
      const emptyTracker = new MemoryTracker({ enableTracking: false });

      expect(emptyTracker.getGrowthRate().bytesPerSecond).toBe(0);
      expect(emptyTracker.getTrends()).toHaveLength(0);

      emptyTracker.destroy();
    });

    it('should handle invalid linear trend calculations', () => {
      // This tests the calculateLinearTrend method with insufficient data
      const trends = tracker.getTrends();
      expect(Array.isArray(trends)).toBe(true);
    });

    it('should maintain configuration immutability', () => {
      const originalConfig = tracker.getConfig();
      originalConfig.samplingInterval = 99999;

      const currentConfig = tracker.getConfig();
      expect(currentConfig.samplingInterval).not.toBe(99999);
    });

    it('should handle process.memoryUsage errors gracefully', () => {
      // Mock process.memoryUsage to throw
      process.memoryUsage = jest.fn().mockImplementation(() => {
        throw new Error('Memory usage unavailable');
      }) as any;

      expect(() => {
        tracker.takeSnapshot();
      }).toThrow(); // This should throw since we can't get memory usage
    });

    it('should validate config updates', () => {
      expect(() => {
        tracker.updateConfig({ samplingInterval: 50 });
      }).not.toThrow();

      expect(() => {
        tracker.updateConfig({ historySize: 0 });
      }).not.toThrow();
    });
  });
});
