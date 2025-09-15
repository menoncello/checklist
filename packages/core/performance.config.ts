/**
 * Performance Budget Configuration for BMAD Checklist Manager
 *
 * These budgets define performance thresholds for critical operations.
 * Tests will fail if these budgets are exceeded.
 */

export interface PerformanceBudget {
  target: number; // Target value (should aim for this)
  max: number;    // Maximum allowed value (hard limit)
}

export interface PerformanceBudgets {
  startup: PerformanceBudget;     // Application startup time (ms)
  memory: PerformanceBudget;      // Memory usage (MB)
  operation: PerformanceBudget;   // Operation response time (ms)
  binarySize: PerformanceBudget;  // Compiled binary size (MB)
}

/**
 * Performance budgets for the BMAD Checklist Manager
 *
 * All values are in their respective units:
 * - startup: milliseconds
 * - memory: megabytes
 * - operation: milliseconds
 * - binarySize: megabytes
 */
export const PERFORMANCE_BUDGET: PerformanceBudgets = {
  startup: {
    target: 50,   // 50ms target startup time
    max: 100      // 100ms maximum startup time
  },
  memory: {
    target: 30,   // 30MB target memory usage
    max: 50       // 50MB maximum memory usage
  },
  operation: {
    target: 10,   // 10ms target operation time
    max: 100      // 100ms maximum operation time
  },
  binarySize: {
    target: 15,   // 15MB target binary size
    max: 20       // 20MB maximum binary size
  }
};

/**
 * Performance monitoring configuration
 */
export const PERFORMANCE_CONFIG = {
  // Enable performance monitoring in development
  enabled: process.env.NODE_ENV === 'development' || process.env.ENABLE_PERFORMANCE_MONITORING === 'true',

  // Performance sampling rate (0-1)
  sampleRate: 0.1,

  // Performance data retention (days)
  retentionDays: 30,

  // Alert thresholds (as percentage of budget max)
  alertThresholds: {
    warning: 0.8,  // 80% of max budget
    critical: 0.95 // 95% of max budget
  }
};

export default PERFORMANCE_BUDGET;