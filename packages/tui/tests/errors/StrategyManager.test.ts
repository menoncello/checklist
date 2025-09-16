import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { StrategyManager } from '../../src/errors/recovery/StrategyManager';
import { RecoveryStrategy, CrashState } from '../../src/errors/recovery/types';

describe('StrategyManager', () => {
  let manager: StrategyManager;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    manager = new StrategyManager();
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default strategies', () => {
      expect(manager.getStrategyCount()).toBeGreaterThan(0);

      // Check for expected default strategies
      expect(manager.hasStrategy('memoryCleanup')).toBe(true);
      expect(manager.hasStrategy('stateRestoration')).toBe(true);
      expect(manager.hasStrategy('componentRestart')).toBe(true);
      expect(manager.hasStrategy('state-reset')).toBe(true);
      expect(manager.hasStrategy('resource-cleanup')).toBe(true);
      expect(manager.hasStrategy('safeMode')).toBe(true);
      expect(manager.hasStrategy('fullRestart')).toBe(true);
    });

    it('should initialize strategies in priority order', () => {
      const strategies = manager.getStrategies();

      // The actual implementation sorts by priority where higher numbers come first
      // Check that strategies are ordered by priority (higher number = higher priority)
      for (let i = 0; i < strategies.length - 1; i++) {
        expect(strategies[i].priority).toBeGreaterThanOrEqual(strategies[i + 1].priority);
      }
    });

    it('should set up default strategy properties correctly', () => {
      const memoryCleanup = manager.getStrategyByName('memoryCleanup');
      expect(memoryCleanup).toBeDefined();
      expect(memoryCleanup?.name).toBe('memoryCleanup');
      expect(memoryCleanup?.priority).toBe(1);
      expect(memoryCleanup?.timeoutMs).toBe(2000);
      expect(memoryCleanup?.description).toBeDefined();
      expect(typeof memoryCleanup?.condition).toBe('function');
      expect(typeof memoryCleanup?.execute).toBe('function');
    });
  });

  describe('Strategy Management', () => {
    it('should add custom strategy in correct priority order', () => {
      const customStrategy: RecoveryStrategy = {
        name: 'custom-high-priority',
        priority: 10, // Higher number = higher priority
        timeoutMs: 1000,
        description: 'Custom high priority strategy',
        condition: () => true,
        execute: async () => true,
      };

      manager.addStrategy(customStrategy);

      const strategies = manager.getStrategies();
      expect(strategies[0].name).toBe('custom-high-priority');
      expect(manager.getStrategyCount()).toBe(8); // 7 default + 1 custom
    });

    it('should add strategy at the end when priority is lowest', () => {
      const lowPriorityStrategy: RecoveryStrategy = {
        name: 'low-priority',
        priority: 0, // Lower number = lower priority
        timeoutMs: 1000,
        description: 'Low priority strategy',
        condition: () => true,
        execute: async () => true,
      };

      manager.addStrategy(lowPriorityStrategy);

      const strategies = manager.getStrategies();
      expect(strategies[strategies.length - 1].name).toBe('low-priority');
    });

    it('should remove strategy by name', () => {
      const initialCount = manager.getStrategyCount();

      const removed = manager.removeStrategy('memoryCleanup');
      expect(removed).toBe(true);
      expect(manager.getStrategyCount()).toBe(initialCount - 1);
      expect(manager.hasStrategy('memoryCleanup')).toBe(false);
    });

    it('should return false when removing non-existent strategy', () => {
      const removed = manager.removeStrategy('non-existent');
      expect(removed).toBe(false);
    });

    it('should update existing strategy', () => {
      const updated = manager.updateStrategy('memoryCleanup', {
        timeoutMs: 5000,
        description: 'Updated description',
      });

      expect(updated).toBe(true);

      const strategy = manager.getStrategyByName('memoryCleanup');
      expect(strategy?.timeoutMs).toBe(5000);
      expect(strategy?.description).toBe('Updated description');
      expect(strategy?.name).toBe('memoryCleanup'); // Should preserve other properties
    });

    it('should return false when updating non-existent strategy', () => {
      const updated = manager.updateStrategy('non-existent', { timeoutMs: 1000 });
      expect(updated).toBe(false);
    });

    it('should clear all strategies', () => {
      manager.clearStrategies();
      expect(manager.getStrategyCount()).toBe(0);
      expect(manager.getStrategies()).toEqual([]);
    });

    it('should get strategy by name', () => {
      const strategy = manager.getStrategyByName('stateRestoration');
      expect(strategy).toBeDefined();
      expect(strategy?.name).toBe('stateRestoration');

      const nonExistent = manager.getStrategyByName('non-existent');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Strategy Conditions', () => {
    it('should filter applicable strategies based on crash state', () => {
      const memoryCrashState: CrashState = {
        crashed: true,
        crashReason: 'Out of memory error',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const applicable = manager.getApplicableStrategies(memoryCrashState);
      const memoryCleanup = applicable.find(s => s.name === 'memoryCleanup');
      const stateRestoration = applicable.find(s => s.name === 'stateRestoration');

      expect(memoryCleanup).toBeDefined();
      expect(stateRestoration).toBeDefined(); // Always applicable
    });

    it('should handle resource-related crash conditions', () => {
      const resourceCrashState: CrashState = {
        crashed: true,
        crashReason: 'EMFILE: too many open files',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const applicable = manager.getApplicableStrategies(resourceCrashState);
      const resourceCleanup = applicable.find(s => s.name === 'resource-cleanup');

      expect(resourceCleanup).toBeDefined();
    });

    it('should include strategies based on recovery attempts', () => {
      const multipleAttemptState: CrashState = {
        crashed: true,
        crashReason: 'Generic error',
        crashTimestamp: Date.now(),
        recoveryAttempts: 2,
        lastRecoveryAttempt: Date.now() - 1000,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const applicable = manager.getApplicableStrategies(multipleAttemptState);
      const componentRestart = applicable.find(s => s.name === 'componentRestart');
      const safeMode = applicable.find(s => s.name === 'safeMode');
      const fullRestart = applicable.find(s => s.name === 'fullRestart');

      expect(componentRestart).toBeDefined();
      expect(safeMode).toBeDefined();
      expect(fullRestart).toBeDefined();
    });

    it('should handle heap-related crashes', () => {
      const heapCrashState: CrashState = {
        crashed: true,
        crashReason: 'JavaScript heap out of memory',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const applicable = manager.getApplicableStrategies(heapCrashState);
      const memoryCleanup = applicable.find(s => s.name === 'memoryCleanup');

      expect(memoryCleanup).toBeDefined();
    });

    it('should handle ECONNREFUSED errors', () => {
      const connectionCrashState: CrashState = {
        crashed: true,
        crashReason: 'ECONNREFUSED: Connection refused',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const applicable = manager.getApplicableStrategies(connectionCrashState);
      const resourceCleanup = applicable.find(s => s.name === 'resource-cleanup');

      expect(resourceCleanup).toBeDefined();
    });
  });

  describe('Strategy Execution', () => {
    it('should execute strategy successfully', async () => {
      const mockStrategy: RecoveryStrategy = {
        name: 'test-strategy',
        priority: 1,
        timeoutMs: 1000,
        condition: () => true,
        execute: mock(async () => true),
      };

      const crashState: CrashState = {
        crashed: true,
        crashReason: 'Test crash',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const result = await manager.executeStrategy(mockStrategy, crashState);

      expect(result).toBe(true);
      expect(mockStrategy.execute).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Executing recovery strategy: test-strategy');
      expect(consoleLogSpy).toHaveBeenCalledWith("Recovery strategy 'test-strategy' succeeded");
    });

    it('should handle strategy execution failure', async () => {
      const mockStrategy: RecoveryStrategy = {
        name: 'failing-strategy',
        priority: 1,
        timeoutMs: 1000,
        condition: () => true,
        execute: mock(async () => false),
      };

      const crashState: CrashState = {
        crashed: true,
        crashReason: 'Test crash',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const result = await manager.executeStrategy(mockStrategy, crashState);

      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith("Recovery strategy 'failing-strategy' failed");
    });

    it('should handle strategy execution timeout', async () => {
      const slowStrategy: RecoveryStrategy = {
        name: 'slow-strategy',
        priority: 1,
        timeoutMs: 100, // Very short timeout
        condition: () => true,
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 200)); // Takes longer than timeout
          return true;
        },
      };

      const crashState: CrashState = {
        crashed: true,
        crashReason: 'Test crash',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const result = await manager.executeStrategy(slowStrategy, crashState);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Recovery strategy 'slow-strategy' threw error:",
        expect.any(Error)
      );
    });

    it('should handle strategy execution with exception', async () => {
      const throwingStrategy: RecoveryStrategy = {
        name: 'throwing-strategy',
        priority: 1,
        timeoutMs: 1000,
        condition: () => true,
        execute: mock(async () => {
          throw new Error('Strategy execution failed');
        }),
      };

      const crashState: CrashState = {
        crashed: true,
        crashReason: 'Test crash',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const result = await manager.executeStrategy(throwingStrategy, crashState);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Recovery strategy 'throwing-strategy' threw error:",
        expect.any(Error)
      );
    });

    it('should use default timeout when not specified', async () => {
      const strategyWithoutTimeout: RecoveryStrategy = {
        name: 'no-timeout-strategy',
        priority: 1,
        condition: () => true,
        execute: mock(async () => true),
      };

      const crashState: CrashState = {
        crashed: true,
        crashReason: 'Test crash',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const result = await manager.executeStrategy(strategyWithoutTimeout, crashState);
      expect(result).toBe(true);
    });
  });

  describe('Recovery Execution', () => {
    it('should execute recovery successfully with first applicable strategy', async () => {
      const crashState: CrashState = {
        crashed: true,
        crashReason: 'Test crash',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const result = await manager.executeRecovery(crashState);

      expect(result).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Found \d+ applicable recovery strategies/)
      );
    });

    it('should return false when no applicable strategies found', async () => {
      // Clear all strategies first
      manager.clearStrategies();

      // Add a strategy that will never be applicable
      const inapplicableStrategy: RecoveryStrategy = {
        name: 'never-applicable',
        priority: 1,
        condition: () => false, // Never applicable
        execute: async () => true,
      };

      manager.addStrategy(inapplicableStrategy);

      const crashState: CrashState = {
        crashed: true,
        crashReason: 'Test crash',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const result = await manager.executeRecovery(crashState);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('No applicable recovery strategies found');
    });

    it('should try all strategies if all fail', async () => {
      // Clear default strategies and add failing ones
      manager.clearStrategies();

      const failingStrategy1: RecoveryStrategy = {
        name: 'failing-1',
        priority: 1,
        condition: () => true,
        execute: mock(async () => false),
      };

      const failingStrategy2: RecoveryStrategy = {
        name: 'failing-2',
        priority: 2,
        condition: () => true,
        execute: mock(async () => false),
      };

      manager.addStrategy(failingStrategy1);
      manager.addStrategy(failingStrategy2);

      const crashState: CrashState = {
        crashed: true,
        crashReason: 'Test crash',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const result = await manager.executeRecovery(crashState);

      expect(result).toBe(false);
      expect(failingStrategy1.execute).toHaveBeenCalled();
      expect(failingStrategy2.execute).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('All recovery strategies failed');
    });
  });

  describe('State Restoration Callback', () => {
    it('should set and call onStateRestored callback', async () => {
      const mockCallback = mock(() => {});
      manager.setOnStateRestored(mockCallback);

      // Execute the stateRestoration strategy specifically
      const stateRestoration = manager.getStrategyByName('stateRestoration');
      expect(stateRestoration).toBeDefined();

      if (stateRestoration) {
        const crashState: CrashState = {
          crashed: true,
          crashReason: 'Test crash',
          crashTimestamp: Date.now(),
          recoveryAttempts: 0,
          lastRecoveryAttempt: 0,
          canRecover: true,
          gracefulShutdownCompleted: false,
        };

        await manager.executeStrategy(stateRestoration, crashState);
        expect(mockCallback).toHaveBeenCalled();
      }
    });

    it('should handle missing callback gracefully', async () => {
      // Don't set any callback
      const stateRestoration = manager.getStrategyByName('stateRestoration');

      if (stateRestoration) {
        const crashState: CrashState = {
          crashed: true,
          crashReason: 'Test crash',
          crashTimestamp: Date.now(),
          recoveryAttempts: 0,
          lastRecoveryAttempt: 0,
          canRecover: true,
          gracefulShutdownCompleted: false,
        };

        const result = await manager.executeStrategy(stateRestoration, crashState);
        expect(result).toBe(true); // Should still succeed
      }
    });
  });

  describe('Global GC Handling', () => {
    it('should handle memory cleanup when global.gc is available', async () => {
      const originalGc = global.gc;
      const mockGc = mock(() => {});
      (global as unknown as { gc: typeof mockGc }).gc = mockGc;

      const memoryCleanup = manager.getStrategyByName('memoryCleanup');

      if (memoryCleanup) {
        const crashState: CrashState = {
          crashed: true,
          crashReason: 'memory leak detected',
          crashTimestamp: Date.now(),
          recoveryAttempts: 0,
          lastRecoveryAttempt: 0,
          canRecover: true,
          gracefulShutdownCompleted: false,
        };

        const result = await manager.executeStrategy(memoryCleanup, crashState);
        expect(result).toBe(true);
        expect(mockGc).toHaveBeenCalled();
      }

      // Restore original
      global.gc = originalGc;
    });

    it('should handle memory cleanup when global.gc is not available', async () => {
      const originalGc = global.gc;
      delete (global as any).gc;

      const memoryCleanup = manager.getStrategyByName('memoryCleanup');

      if (memoryCleanup) {
        const crashState: CrashState = {
          crashed: true,
          crashReason: 'memory issue',
          crashTimestamp: Date.now(),
          recoveryAttempts: 0,
          lastRecoveryAttempt: 0,
          canRecover: true,
          gracefulShutdownCompleted: false,
        };

        const result = await manager.executeStrategy(memoryCleanup, crashState);
        expect(result).toBe(true); // Should still succeed
      }

      // Restore original
      global.gc = originalGc;
    });
  });

  describe('Strategy Information', () => {
    it('should return copy of strategies array', () => {
      const strategies1 = manager.getStrategies();
      const strategies2 = manager.getStrategies();

      expect(strategies1).not.toBe(strategies2); // Different array instances
      expect(strategies1).toEqual(strategies2); // But same content
    });

    it('should return accurate strategy count', () => {
      const initialCount = manager.getStrategyCount();

      manager.addStrategy({
        name: 'test-count',
        priority: 1,
        condition: () => true,
        execute: async () => true,
      });

      expect(manager.getStrategyCount()).toBe(initialCount + 1);

      manager.removeStrategy('test-count');
      expect(manager.getStrategyCount()).toBe(initialCount);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strategy list gracefully', () => {
      manager.clearStrategies();

      expect(manager.getStrategyCount()).toBe(0);
      expect(manager.getStrategies()).toEqual([]);
      expect(manager.getStrategyByName('any')).toBeUndefined();
      expect(manager.hasStrategy('any')).toBe(false);
    });

    it('should handle duplicate strategy names', () => {
      const strategy1: RecoveryStrategy = {
        name: 'duplicate',
        priority: 1,
        condition: () => true,
        execute: async () => true,
      };

      const strategy2: RecoveryStrategy = {
        name: 'duplicate',
        priority: 2,
        condition: () => true,
        execute: async () => false,
      };

      manager.addStrategy(strategy1);
      manager.addStrategy(strategy2);

      // Should have both strategies (no duplicate check in current implementation)
      expect(manager.getStrategyCount()).toBe(9); // 7 default + 2 duplicates

      // getStrategyByName should return the first match (which might be the second one due to priority ordering)
      const found = manager.getStrategyByName('duplicate');
      expect(found?.name).toBe('duplicate'); // Verify it found a strategy with the name
      expect([1, 2]).toContain(found?.priority ?? 0); // Could be either priority
    });

    it('should handle zero recovery attempts correctly', () => {
      const zeroAttemptsState: CrashState = {
        crashed: true,
        crashReason: 'Initial crash',
        crashTimestamp: Date.now(),
        recoveryAttempts: 0,
        lastRecoveryAttempt: 0,
        canRecover: true,
        gracefulShutdownCompleted: false,
      };

      const applicable = manager.getApplicableStrategies(zeroAttemptsState);

      // Should not include strategies that require >= 1 attempts
      const componentRestart = applicable.find(s => s.name === 'componentRestart');
      const safeMode = applicable.find(s => s.name === 'safeMode');

      expect(componentRestart).toBeUndefined();
      expect(safeMode).toBeUndefined();
    });
  });
});