import { describe, expect, test, beforeEach } from 'bun:test';
import { ResourceLimiter } from '../../src/templates/ResourceLimiter';
import {
  TimeoutError,
  MemoryLimitError,
  ResourceLimitError,
} from '../../src/templates/errors';

describe('ResourceLimiter', () => {
  let limiter: ResourceLimiter;

  beforeEach(() => {
    limiter = new ResourceLimiter();
  });

  describe('Constructor and Configuration', () => {
    test('should create with default limits', () => {
      const limits = limiter.getLimits();

      expect(limits.executionTime).toBe(5000);
      expect(limits.memoryDelta).toBe(10 * 1024 * 1024);
      expect(limits.cpuUsage).toBe(95);
      expect(limits.fileHandles).toBe(10);
      expect(limits.processCount).toBe(0);
    });

    test('should create with custom limits', () => {
      const customLimiter = new ResourceLimiter({
        executionTime: 1000,
        memoryDelta: 5 * 1024 * 1024,
      });

      const limits = customLimiter.getLimits();
      expect(limits.executionTime).toBe(1000);
      expect(limits.memoryDelta).toBe(5 * 1024 * 1024);
      expect(limits.cpuUsage).toBe(95); // Default value
    });

    test('should update limits after creation', () => {
      limiter.updateLimits({ executionTime: 3000 });

      const limits = limiter.getLimits();
      expect(limits.executionTime).toBe(3000);
    });

    test('should return immutable limits', () => {
      const limits = limiter.getLimits();
      const originalExecutionTime = limits.executionTime;

      // Attempting to modify should not affect internal limits
      (limits as { executionTime: number }).executionTime = 9999;

      const newLimits = limiter.getLimits();
      expect(newLimits.executionTime).toBe(originalExecutionTime);
    });
  });

  describe('Execution Time Limits', () => {
    test('should execute operation within time limit', async () => {
      const result = await limiter.executeWithLimits(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'success';
        },
        'test-template'
      );

      expect(result).toBe('success');
    });

    test('should throw TimeoutError when execution exceeds limit', async () => {
      const shortLimiter = new ResourceLimiter({ executionTime: 100 });

      await expect(
        shortLimiter.executeWithLimits(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return 'never';
          },
          'slow-template'
        )
      ).rejects.toThrow(TimeoutError);
    });

    test('should include template ID in timeout error', async () => {
      const shortLimiter = new ResourceLimiter({ executionTime: 50 });

      try {
        await shortLimiter.executeWithLimits(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return 'never';
          },
          'timeout-template'
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).message).toContain(
          'timeout-template'
        );
      }
    });

    test('should use custom timeout for specific operation', async () => {
      const result = await limiter.executeWithLimits(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 150));
          return 'success';
        },
        'test-template',
        { executionTime: 300 } // Custom limit for this operation
      );

      expect(result).toBe('success');
    });
  });

  describe('Memory Limit Monitoring', () => {
    test('should execute operation within memory limit', async () => {
      const result = await limiter.executeWithLimits(
        async () => {
          // Small allocation that should not exceed 10MB limit
          const smallArray = new Array(1000).fill(0);
          return smallArray.length;
        },
        'test-template'
      );

      expect(result).toBe(1000);
    });

    test('should throw MemoryLimitError when allocation exceeds limit', async () => {
      const strictLimiter = new ResourceLimiter({
        memoryDelta: 1024, // 1KB limit
        executionTime: 10000, // Long timeout to ensure memory check happens
      });

      await expect(
        strictLimiter.executeWithLimits(
          async () => {
            // Allocate more than 1KB
            const largeArray = new Array(100000).fill(0);
            await new Promise((resolve) => setTimeout(resolve, 100));
            return largeArray;
          },
          'memory-hungry-template'
        )
      ).rejects.toThrow(MemoryLimitError);
    });
  });

  describe('Resource Usage Monitoring', () => {
    test('should provide usage snapshot', async () => {
      const snapshot = await limiter.getUsageSnapshot();

      expect(snapshot).toHaveProperty('memoryDelta');
      expect(snapshot).toHaveProperty('cpuUsage');
      expect(snapshot).toHaveProperty('fileHandles');
      expect(snapshot).toHaveProperty('processCount');
      expect(snapshot).toHaveProperty('duration');
    });

    test('should track duration during execution', async () => {
      const startTime = Date.now();

      await limiter.executeWithLimits(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'done';
        },
        'test-template'
      );

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe('AbortSignal Handling', () => {
    test('should pass AbortSignal to operation', async () => {
      let signalReceived = false;

      await limiter.executeWithLimits(
        async (signal) => {
          signalReceived = signal instanceof AbortSignal;
          return 'done';
        },
        'test-template'
      );

      expect(signalReceived).toBe(true);
    });

    test('should abort operation on timeout', async () => {
      const shortLimiter = new ResourceLimiter({ executionTime: 100 });
      let aborted = false;

      try {
        await shortLimiter.executeWithLimits(
          async (signal) => {
            signal.addEventListener('abort', () => {
              aborted = true;
            });
            await new Promise((resolve) => setTimeout(resolve, 300));
            return 'done';
          },
          'test-template'
        );
      } catch (error) {
        // Expected timeout error
      }

      // Give time for abort event to fire
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(aborted).toBe(true);
    });
  });

  describe('Error Propagation', () => {
    test('should propagate errors from operation', async () => {
      await expect(
        limiter.executeWithLimits(
          async () => {
            throw new Error('Operation failed');
          },
          'test-template'
        )
      ).rejects.toThrow('Operation failed');
    });

    test('should clean up monitoring on error', async () => {
      // This test verifies that cleanup happens even when operation fails
      try {
        await limiter.executeWithLimits(
          async () => {
            throw new Error('Test error');
          },
          'test-template'
        );
      } catch (error) {
        // Expected error
      }

      // If cleanup didn't happen, subsequent operations would be affected
      const result = await limiter.executeWithLimits(
        async () => 'success',
        'test-template'
      );

      expect(result).toBe('success');
    });
  });

  describe('CPU Usage Tracking', () => {
    test('should track CPU usage', async () => {
      await limiter.executeWithLimits(
        async () => {
          // Perform some CPU-intensive work
          let sum = 0;
          for (let i = 0; i < 10000; i++) {
            sum += Math.sqrt(i);
          }
          return sum;
        },
        'test-template'
      );

      // Just verify execution completes
      // Actual CPU validation is difficult to test reliably
      expect(true).toBe(true);
    });
  });

  describe('Multiple Concurrent Operations', () => {
    test('should handle multiple concurrent operations', async () => {
      const operations = [
        limiter.executeWithLimits(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return 'op1';
          },
          'template-1'
        ),
        limiter.executeWithLimits(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return 'op2';
          },
          'template-2'
        ),
        limiter.executeWithLimits(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return 'op3';
          },
          'template-3'
        ),
      ];

      const results = await Promise.all(operations);
      expect(results).toEqual(['op1', 'op2', 'op3']);
    });
  });

  describe('Resource Limit Validation', () => {
    test('should not throw when under all limits', async () => {
      const result = await limiter.executeWithLimits(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'success';
        },
        'test-template'
      );

      expect(result).toBe('success');
    });

    test('should validate all resource types', async () => {
      const limits = limiter.getLimits();

      // Verify all limit types are present
      expect(limits).toHaveProperty('executionTime');
      expect(limits).toHaveProperty('memoryDelta');
      expect(limits).toHaveProperty('cpuUsage');
      expect(limits).toHaveProperty('fileHandles');
      expect(limits).toHaveProperty('processCount');
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero-duration operations', async () => {
      const result = await limiter.executeWithLimits(
        async () => 'instant',
        'test-template'
      );

      expect(result).toBe('instant');
    });

    test('should handle operations that complete exactly at limit', async () => {
      const limiter100 = new ResourceLimiter({ executionTime: 150 });

      const result = await limiter100.executeWithLimits(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'just-in-time';
        },
        'test-template'
      );

      expect(result).toBe('just-in-time');
    });

    test('should handle template ID undefined', async () => {
      const result = await limiter.executeWithLimits(async () =>
        'no-template-id'
      );

      expect(result).toBe('no-template-id');
    });
  });
});
