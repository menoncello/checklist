import { test, expect, beforeEach, afterEach, mock, spyOn, describe } from 'bun:test';
import { PerformanceDashboard, createDevelopmentDashboard } from '../../src/monitoring/PerformanceDashboard';
import type {
  IPerformanceMonitor,
  PerformanceReport,
  PerformanceMetric,
  BudgetViolation,
} from '../../src/interfaces/IPerformanceMonitor';
import { createLogger } from '../../src/utils/logger';
import type { Logger } from '../../src/utils/logger';

describe('Performance Dashboard Tests', () => {
  let mockPerformanceMonitor: IPerformanceMonitor;
  let logger: Logger;
  let dashboard: PerformanceDashboard;

  // Sample test data
  const sampleMetrics: Record<string, PerformanceMetric> = {
    'command-execution': {
      count: 5,
      total: 450,
      min: 80,
      max: 120,
      average: 90,
      p95: 115,
    },
    'state-save': {
      count: 3,
      total: 120,
      min: 35,
      max: 50,
      average: 40,
      p95: 48,
    },
    'template-parsing': {
      count: 2,
      total: 180,
      min: 85,
      max: 95,
      average: 90,
      p95: 94,
    },
  };

  const sampleViolations: BudgetViolation[] = [
    {
      operation: 'command-execution',
      budget: 100,
      actual: 120,
      exceedance: 20,
      severity: 'warning',
    },
  ];

  const sampleReport: PerformanceReport = {
    metrics: sampleMetrics,
    violations: sampleViolations,
    summary: {
      totalOperations: 10,
      budgetViolations: 1,
      overallHealth: 'DEGRADED',
      measurementPeriod: {
        start: Date.now() - 10000,
        end: Date.now(),
        duration: 10000,
      },
    },
  };

  beforeEach(() => {
    logger = createLogger('test-dashboard');
    
    // Mock logger methods to prevent console output during tests
    spyOn(logger, 'info').mockImplementation(() => {});
    spyOn(logger, 'debug').mockImplementation(() => {});
    spyOn(logger, 'warn').mockImplementation(() => {});
    spyOn(logger, 'error').mockImplementation(() => {});

    // Create mock performance monitor
    mockPerformanceMonitor = {
      startTimer: mock(() => mock(() => {})),
      recordMetric: mock(),
      setBudget: mock(),
      generateReport: mock(() => sampleReport),
      clear: mock(),
      getMetrics: mock(() => undefined),
      getBudgetViolations: mock(() => sampleViolations),
      setEnabled: mock(),
      isEnabled: mock(() => true),
    };
  });

  afterEach(() => {
    if (dashboard) {
      dashboard[Symbol.dispose]();
    }
  });

  describe('Dashboard Initialization and Configuration (AC4.1)', () => {
    test('should initialize dashboard with default configuration', () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger);

      expect(dashboard).toBeInstanceOf(PerformanceDashboard);
    });

    test('should initialize dashboard with custom configuration', () => {
      const customConfig = {
        enabled: true,
        refreshInterval: 2000,
        displayMode: 'table' as const,
        showTrends: true,
        maxDisplayItems: 10,
        alertOnViolations: true,
      };

      dashboard = new PerformanceDashboard(
        mockPerformanceMonitor,
        logger,
        customConfig
      );

      expect(dashboard).toBeInstanceOf(PerformanceDashboard);
    });

    test('should respect environment variable configuration', () => {
      // Mock environment variables
      const originalEnv = {
        PERFORMANCE_DASHBOARD: Bun.env.PERFORMANCE_DASHBOARD,
        DASHBOARD_REFRESH_INTERVAL: Bun.env.DASHBOARD_REFRESH_INTERVAL,
        DASHBOARD_DISPLAY_MODE: Bun.env.DASHBOARD_DISPLAY_MODE,
      };

      try {
        Bun.env.PERFORMANCE_DASHBOARD = 'true';
        Bun.env.DASHBOARD_REFRESH_INTERVAL = '3000';
        Bun.env.DASHBOARD_DISPLAY_MODE = 'json';

        dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger);

        expect(dashboard).toBeInstanceOf(PerformanceDashboard);
      } finally {
        // Restore environment variables
        Object.entries(originalEnv).forEach(([key, value]) => {
          if (value !== undefined) {
            Bun.env[key] = value;
          } else {
            delete Bun.env[key];
          }
        });
      }
    });

    test('should handle disabled dashboard gracefully', () => {
      mockPerformanceMonitor.isEnabled = mock(() => false);

      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: false,
      });

      dashboard.start();

      expect(logger.debug).toHaveBeenCalledWith({
        msg: 'Performance dashboard disabled',
      });
    });
  });

  describe('Dashboard Display Modes (AC4.1)', () => {
    beforeEach(() => {
      // Mock console methods to capture output
      spyOn(console, 'clear').mockImplementation(() => {});
      spyOn(console, 'log').mockImplementation(() => {});
      spyOn(console, 'table').mockImplementation(() => {});
    });

    test('should display console mode correctly', () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        displayMode: 'console',
      });

      dashboard.displayReport();

      expect(mockPerformanceMonitor.generateReport).toHaveBeenCalled();
      expect(console.clear).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('🎯 Performance Dashboard');
    });

    test('should display table mode correctly', () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        displayMode: 'table',
      });

      dashboard.displayReport();

      expect(mockPerformanceMonitor.generateReport).toHaveBeenCalled();
      expect(console.clear).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('🎯 Performance Dashboard - Table View');
      expect(console.table).toHaveBeenCalled();
    });

    test('should display JSON mode correctly', () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        displayMode: 'json',
      });

      dashboard.displayReport();

      expect(mockPerformanceMonitor.generateReport).toHaveBeenCalled();
      expect(console.clear).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('🎯 Performance Dashboard - JSON View');
    });

    test('should handle empty metrics gracefully', () => {
      const emptyReport: PerformanceReport = {
        metrics: {},
        violations: [],
        summary: {
          totalOperations: 0,
          budgetViolations: 0,
          overallHealth: 'HEALTHY',
          measurementPeriod: {
            start: Date.now(),
            end: Date.now(),
            duration: 0,
          },
        },
      };

      mockPerformanceMonitor.generateReport = mock(() => emptyReport);

      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        displayMode: 'console',
      });

      dashboard.displayReport();

      // Should handle empty metrics without throwing
      expect(mockPerformanceMonitor.generateReport).toHaveBeenCalled();
    });
  });

  describe('Real-time Metrics Updates (AC4.1)', () => {
    test('should start and stop dashboard with refresh timer', async () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        refreshInterval: 100, // Fast refresh for testing
      });

      // Mock console to prevent output
      spyOn(console, 'clear').mockImplementation(() => {});
      spyOn(console, 'log').mockImplementation(() => {});

      dashboard.start();

      expect(logger.info).toHaveBeenCalledWith({
        msg: 'Starting performance dashboard',
        refreshInterval: 100,
        displayMode: 'console',
      });

      // Wait for at least one refresh cycle
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have called generateReport multiple times (initial + refresh)
      expect(mockPerformanceMonitor.generateReport).toHaveBeenCalledTimes(2);

      dashboard.stop();

      expect(logger.debug).toHaveBeenCalledWith({
        msg: 'Performance dashboard stopped',
      });
    });

    test('should update metrics in real-time during operations', async () => {
      let reportCallCount = 0;
      const dynamicReport = () => {
        reportCallCount++;
        return {
          ...sampleReport,
          summary: {
            ...sampleReport.summary,
            totalOperations: reportCallCount * 2, // Simulate growing operations
          },
        };
      };

      mockPerformanceMonitor.generateReport = mock(() => dynamicReport());

      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        refreshInterval: 50,
      });

      spyOn(console, 'clear').mockImplementation(() => {});
      spyOn(console, 'log').mockImplementation(() => {});

      dashboard.start();

      // Wait for multiple refresh cycles
      await new Promise(resolve => setTimeout(resolve, 200));

      dashboard.stop();

      // Should have updated multiple times
      expect(mockPerformanceMonitor.generateReport).toHaveBeenCalledTimes(4); // Initial + refreshes (timing may vary)
    });

    test('should handle performance monitor disable during operation', () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
      });

      // Start with enabled monitor
      dashboard.start();

      // Disable monitor during operation
      mockPerformanceMonitor.isEnabled = mock(() => false);

      // Should handle disabled state gracefully
      dashboard.displayReport();

      expect(mockPerformanceMonitor.isEnabled).toHaveBeenCalled();
    });
  });

  describe('Alert System (AC4.1)', () => {
    test('should alert on budget violations when enabled', () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        alertOnViolations: true,
      });

      spyOn(console, 'clear').mockImplementation(() => {});
      spyOn(console, 'log').mockImplementation(() => {});

      dashboard.displayReport();

      expect(logger.warn).toHaveBeenCalledWith({
        msg: 'Performance budget violation detected',
        operation: 'command-execution',
        budget: 100,
        actual: 120,
        exceedance: 20,
        severity: 'warning',
      });
    });

    test('should detect new violations correctly', () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        alertOnViolations: true,
      });

      spyOn(console, 'clear').mockImplementation(() => {});
      spyOn(console, 'log').mockImplementation(() => {});

      // First report with one violation
      dashboard.displayReport();

      expect(logger.warn).toHaveBeenCalledTimes(1);

      // Second report with same violation - should not alert again
      dashboard.displayReport();

      expect(logger.warn).toHaveBeenCalledTimes(1); // Still only 1

      // Third report with additional violation
      const reportWithMoreViolations: PerformanceReport = {
        ...sampleReport,
        violations: [
          ...sampleViolations,
          {
            operation: 'template-parsing',
            budget: 80,
            actual: 95,
            exceedance: 18.75,
            severity: 'warning',
          },
        ],
        summary: {
          ...sampleReport.summary,
          budgetViolations: 2,
        },
      };

      mockPerformanceMonitor.generateReport = mock(() => reportWithMoreViolations);

      dashboard.displayReport();

      expect(logger.warn).toHaveBeenCalledTimes(3); // Original + 2 new violations
    });

    test('should handle critical violations with error level', () => {
      const criticalReport: PerformanceReport = {
        ...sampleReport,
        violations: [
          {
            operation: 'critical-operation',
            budget: 50,
            actual: 200,
            exceedance: 300,
            severity: 'critical',
          },
        ],
        summary: {
          ...sampleReport.summary,
          overallHealth: 'CRITICAL',
        },
      };

      mockPerformanceMonitor.generateReport = mock(() => criticalReport);

      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        alertOnViolations: true,
      });

      spyOn(console, 'clear').mockImplementation(() => {});
      spyOn(console, 'log').mockImplementation(() => {});

      dashboard.displayReport();

      expect(logger.error).toHaveBeenCalledWith({
        msg: 'Performance budget violation detected',
        operation: 'critical-operation',
        budget: 50,
        actual: 200,
        exceedance: 300,
        severity: 'critical',
      });
    });

    test('should disable alerts when alertOnViolations is false', () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        alertOnViolations: false,
      });

      spyOn(console, 'clear').mockImplementation(() => {});
      spyOn(console, 'log').mockImplementation(() => {});

      dashboard.displayReport();

      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('Dashboard Utility Functions (AC4.1)', () => {
    test('should create formatted performance summary', () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger);

      const summary = dashboard.createSummary();

      expect(typeof summary).toBe('string');
      expect(summary).toContain('Performance Summary (DEGRADED)');
      expect(summary).toContain('Total Operations: 10');
      expect(summary).toContain('Budget Violations: 1');
      expect(summary).toContain('command-execution: 120.00ms (budget: 100ms)');
      expect(summary).toContain('Top Operations (by avg duration):');
    });

    test('should handle empty metrics in summary', () => {
      const emptyReport: PerformanceReport = {
        metrics: {},
        violations: [],
        summary: {
          totalOperations: 0,
          budgetViolations: 0,
          overallHealth: 'HEALTHY',
          measurementPeriod: {
            start: Date.now(),
            end: Date.now(),
            duration: 0,
          },
        },
      };

      mockPerformanceMonitor.generateReport = mock(() => emptyReport);

      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger);

      const summary = dashboard.createSummary();

      expect(summary).toBe('No performance metrics available');
    });

    test('should limit top operations display correctly', () => {
      const manyMetrics: Record<string, PerformanceMetric> = {};
      for (let i = 0; i < 20; i++) {
        manyMetrics[`operation-${i}`] = {
          count: 1,
          total: i * 10,
          min: i * 10,
          max: i * 10,
          average: i * 10,
        };
      }

      const reportWithManyMetrics: PerformanceReport = {
        ...sampleReport,
        metrics: manyMetrics,
      };

      mockPerformanceMonitor.generateReport = mock(() => reportWithManyMetrics);

      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        maxDisplayItems: 5,
      });

      const summary = dashboard.createSummary();

      // Should only show top 5 operations
      const operationLines = summary.split('\n').filter(line => line.includes('operation-'));
      expect(operationLines.length).toBe(5);
    });
  });

  describe('createDevelopmentDashboard utility function', () => {
    test('should create dashboard with development defaults', () => {
      const devDashboard = createDevelopmentDashboard(mockPerformanceMonitor, logger);

      expect(devDashboard).toBeInstanceOf(PerformanceDashboard);

      // Cleanup
      devDashboard[Symbol.dispose]();
    });

    test('should respect NODE_ENV for development mode', () => {
      const originalNodeEnv = Bun.env.NODE_ENV;

      try {
        Bun.env.NODE_ENV = 'development';

        const devDashboard = createDevelopmentDashboard(mockPerformanceMonitor, logger);

        expect(devDashboard).toBeInstanceOf(PerformanceDashboard);

        devDashboard[Symbol.dispose]();
      } finally {
        if (originalNodeEnv !== undefined) {
          Bun.env.NODE_ENV = originalNodeEnv;
        } else {
          delete Bun.env.NODE_ENV;
        }
      }
    });

    test('should override default configuration', () => {
      const customConfig = {
        displayMode: 'json' as const,
        refreshInterval: 5000,
      };

      const devDashboard = createDevelopmentDashboard(
        mockPerformanceMonitor,
        logger,
        customConfig
      );

      expect(devDashboard).toBeInstanceOf(PerformanceDashboard);

      devDashboard[Symbol.dispose]();
    });

    test('should handle production environment', () => {
      const originalNodeEnv = Bun.env.NODE_ENV;

      try {
        Bun.env.NODE_ENV = 'production';

        const devDashboard = createDevelopmentDashboard(mockPerformanceMonitor, logger);

        expect(devDashboard).toBeInstanceOf(PerformanceDashboard);

        devDashboard[Symbol.dispose]();
      } finally {
        if (originalNodeEnv !== undefined) {
          Bun.env.NODE_ENV = originalNodeEnv;
        } else {
          delete Bun.env.NODE_ENV;
        }
      }
    });
  });

  describe('Dashboard Lifecycle Management', () => {
    test('should dispose resources properly', async () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        refreshInterval: 100,
      });

      spyOn(console, 'clear').mockImplementation(() => {});
      spyOn(console, 'log').mockImplementation(() => {});

      dashboard.start();

      // Wait for timer to be established
      await new Promise(resolve => setTimeout(resolve, 50));

      dashboard[Symbol.dispose]();

      expect(logger.debug).toHaveBeenCalledWith({
        msg: 'Performance dashboard stopped',
      });
    });

    test('should handle multiple start/stop cycles', () => {
      dashboard = new PerformanceDashboard(mockPerformanceMonitor, logger, {
        enabled: true,
        refreshInterval: 1000,
      });

      spyOn(console, 'clear').mockImplementation(() => {});
      spyOn(console, 'log').mockImplementation(() => {});

      dashboard.start();
      dashboard.stop();
      dashboard.start();
      dashboard.stop();

      expect(logger.info).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledTimes(2);
    });
  });
});