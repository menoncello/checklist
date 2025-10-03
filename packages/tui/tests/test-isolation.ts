/**
 * Test isolation helpers - ensures clean state between tests
 */

// Use Node.js process, not Bun process
declare const process: NodeJS.Process;

interface ProcessListeners {
  uncaughtException: ((error: Error) => void)[];
  unhandledRejection: ((reason: unknown, promise: Promise<unknown>) => void)[];
  SIGINT: (() => void)[];
  SIGTERM: (() => void)[];
  SIGUSR1: (() => void)[];
}

/**
 * Manages process event listeners during testing to ensure isolation
 */
export class TestIsolationManager {
  private static instance: TestIsolationManager;
  private originalListeners: ProcessListeners;
  private testListeners: ProcessListeners;

  private constructor() {
    this.originalListeners = {
      uncaughtException: [],
      unhandledRejection: [],
      SIGINT: [],
      SIGTERM: [],
      SIGUSR1: [],
    };
    this.testListeners = {
      uncaughtException: [],
      unhandledRejection: [],
      SIGINT: [],
      SIGTERM: [],
      SIGUSR1: [],
    };
  }

  static getInstance(): TestIsolationManager {
    if (!TestIsolationManager.instance) {
      TestIsolationManager.instance = new TestIsolationManager();
    }
    return TestIsolationManager.instance;
  }

  /**
   * Backup current process listeners before test setup
   */
  backupProcessListeners(): void {
    // Get all listeners for each event type
    this.originalListeners.uncaughtException = process.listeners('uncaughtException') as ((error: Error) => void)[];
    this.originalListeners.unhandledRejection = process.listeners('unhandledRejection') as ((reason: unknown, promise: Promise<unknown>) => void)[];
    this.originalListeners.SIGINT = process.listeners('SIGINT') as (() => void)[];
    this.originalListeners.SIGTERM = process.listeners('SIGTERM') as (() => void)[];
    this.originalListeners.SIGUSR1 = process.listeners('SIGUSR1') as (() => void)[];
  }

  /**
   * Clean up all process listeners after test
   */
  cleanupProcessListeners(): void {
    // Remove all test-added listeners
    const currentListeners: ProcessListeners = {
      uncaughtException: process.listeners('uncaughtException') as ((error: Error) => void)[],
      unhandledRejection: process.listeners('unhandledRejection') as ((reason: unknown, promise: Promise<unknown>) => void)[],
      SIGINT: process.listeners('SIGINT') as (() => void)[],
      SIGTERM: process.listeners('SIGTERM') as (() => void)[],
      SIGUSR1: process.listeners('SIGUSR1') as (() => void)[],
    };

    // Remove listeners that weren't there originally
    Object.keys(currentListeners).forEach(eventType => {
      const eventName = eventType as keyof ProcessListeners;
      const original = this.originalListeners[eventName];
      const current = currentListeners[eventName];

      // Find and remove listeners that were added during tests
      current.forEach((listener) => {
        if (!original.includes(listener as any)) {
          // Type-safe removal based on event type
          switch (eventName) {
            case 'uncaughtException':
              process.off(eventName, listener as (error: Error) => void);
              break;
            case 'unhandledRejection':
              process.off(eventName, listener as (reason: unknown, promise: Promise<unknown>) => void);
              break;
            case 'SIGINT':
            case 'SIGTERM':
            case 'SIGUSR1':
              process.off(eventName, listener as () => void);
              break;
          }
        }
      });
    });
  }

  /**
   * Restore original process listeners
   */
  restoreProcessListeners(): void {
    // First remove all current listeners
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGUSR1');

    // Restore only original listeners
    this.originalListeners.uncaughtException.forEach(listener => {
      process.on('uncaughtException', listener);
    });
    this.originalListeners.unhandledRejection.forEach(listener => {
      process.on('unhandledRejection', listener);
    });
    this.originalListeners.SIGINT.forEach(listener => {
      process.on('SIGINT', listener);
    });
    this.originalListeners.SIGTERM.forEach(listener => {
      process.on('SIGTERM', listener);
    });
    this.originalListeners.SIGUSR1.forEach(listener => {
      process.on('SIGUSR1', listener);
    });
  }

  /**
   * Reset state for a clean test environment
   */
  resetTestState(): void {
    // Reset environment variables
    const testEnvVars = Object.keys(process.env).filter(key =>
      key.startsWith('TEST_') || key.startsWith('CHECKLIST_TEST_')
    );

    testEnvVars.forEach(key => {
      delete process.env[key];
    });
  }
}

/**
 * Hook to isolate tests - automatically manages process listeners
 */
export function isolateTest(): void {
  const isolationManager = TestIsolationManager.getInstance();

  // Setup: backup current state
  isolationManager.backupProcessListeners();
}

/**
 * Hook for complete test isolation including full environment reset
 */
export function isolateCompletely(): void {
  const isolationManager = TestIsolationManager.getInstance();

  // Setup: backup current state
  isolationManager.backupProcessListeners();
}

/**
 * Utility to verify no process listeners remain after test
 */
export function verifyNoProcessListeners(): void {
  const isolationManager = TestIsolationManager.getInstance();
  const listeners = {
    uncaughtException: process.listeners('uncaughtException').length,
    unhandledRejection: process.listeners('unhandledRejection').length,
    SIGINT: process.listeners('SIGINT').length,
    SIGTERM: process.listeners('SIGTERM').length,
    SIGUSR1: process.listeners('SIGUSR1').length,
  };

  // Only count original listeners
  const originalCount = {
    uncaughtException: isolationManager['originalListeners'].uncaughtException.length,
    unhandledRejection: isolationManager['originalListeners'].unhandledRejection.length,
    SIGINT: isolationManager['originalListeners'].SIGINT.length,
    SIGTERM: isolationManager['originalListeners'].SIGTERM.length,
    SIGUSR1: isolationManager['originalListeners'].SIGUSR1.length,
  };

  // Check for leaked listeners
  Object.keys(listeners).forEach(event => {
    const current = listeners[event as keyof typeof listeners];
    const original = originalCount[event as keyof typeof originalCount];

    if (current > original) {
      console.warn(`Warning: ${current - original} leaked process listeners for ${event}`);
    }
  });
}