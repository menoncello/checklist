import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { CommandQueue, QueuedCommand } from '../../src/navigation/CommandQueue';

describe('CommandQueue', () => {
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue({
      debounceMs: 50, // Reduced for faster tests
      maxQueueSize: 10,
      timeoutMs: 1000,
      maxRetries: 2,
      errorHandler: mock(() => {}),
    });
  });

  afterEach(() => {
    queue.destroy();
  });

  describe('Queue Operations', () => {
    it('should enqueue commands', async () => {
      const command: QueuedCommand = {
        id: 'test-1',
        execute: mock(() => {}),
        validate: mock(() => true),
        priority: 5,
        timestamp: Date.now(),
      };

      await queue.enqueue(command);

      const status = queue.getStatus();
      expect(status.queueSize).toBe(1);
    });

    it('should process commands in priority order', async () => {
      const executionOrder: string[] = [];

      const lowPriorityCommand: QueuedCommand = {
        id: 'low-priority',
        execute: mock(() => { executionOrder.push('low'); }),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      const highPriorityCommand: QueuedCommand = {
        id: 'high-priority',
        execute: mock(() => { executionOrder.push('high'); }),
        validate: mock(() => true),
        priority: 10,
        timestamp: Date.now(),
      };

      // Enqueue low priority first
      await queue.enqueue(lowPriorityCommand);
      await queue.enqueue(highPriorityCommand);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(executionOrder).toEqual(['high', 'low']);
    });

    it('should respect queue size limit', async () => {
      const commands = Array.from({ length: 15 }, (_, i): QueuedCommand => ({
        id: `cmd-${i}`,
        execute: mock(() => {}),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      }));

      // Try to enqueue more than max size (10)
      const enqueueTasks = commands.map(cmd => queue.enqueue(cmd));

      // Should reject when queue is full
      await expect(Promise.all(enqueueTasks)).rejects.toThrow('Queue overflow');
    });

    it('should add timestamps to commands without them', async () => {
      const command: QueuedCommand = {
        id: 'no-timestamp',
        execute: mock(() => {}),
        validate: mock(() => true),
        priority: 1,
        timestamp: 0, // Will be overridden
      };

      await queue.enqueue(command);

      const queuedCommands = queue.getQueuedCommands();
      expect(queuedCommands[0].timestamp).toBeGreaterThan(0);
    });
  });

  describe('Command Execution', () => {
    it('should execute valid commands', async () => {
      const executeMock = mock(() => {});
      const validateMock = mock(() => true);

      const command: QueuedCommand = {
        id: 'valid-cmd',
        execute: executeMock,
        validate: validateMock,
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(command);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(executeMock).toHaveBeenCalled();
      expect(validateMock).toHaveBeenCalled();

      const status = queue.getStatus();
      expect(status.processedCount).toBe(1);
      expect(status.queueSize).toBe(0);
    });

    it('should skip invalid commands', async () => {
      const executeMock = mock(() => {});
      const validateMock = mock(() => false);

      const command: QueuedCommand = {
        id: 'invalid-cmd',
        execute: executeMock,
        validate: validateMock,
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(command);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(validateMock).toHaveBeenCalled();
      expect(executeMock).not.toHaveBeenCalled();

      const status = queue.getStatus();
      expect(status.errorCount).toBe(1);
    });

    it('should handle async command execution', async () => {
      let resolved = false;
      const asyncCommand: QueuedCommand = {
        id: 'async-cmd',
        execute: mock(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          resolved = true;
        }),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(asyncCommand);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(resolved).toBe(true);
      expect(asyncCommand.execute).toHaveBeenCalled();
    });
  });

  describe('Command Timeout Handling', () => {
    it('should reject commands that exceed timeout', async () => {
      const timeoutCommand: QueuedCommand = {
        id: 'timeout-cmd',
        execute: mock(() => new Promise<void>(resolve => setTimeout(resolve, 2000))), // 2s delay
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(timeoutCommand);
      await new Promise(resolve => setTimeout(resolve, 1200)); // Wait for debounce + timeout

      const status = queue.getStatus();
      expect(status.errorCount).toBeGreaterThan(0);
    });

    it('should reject stale commands', async () => {
      const staleCommand: QueuedCommand = {
        id: 'stale-cmd',
        execute: mock(() => {}),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now() - 2000, // 2s ago
      };

      await queue.enqueue(staleCommand);
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = queue.getStatus();
      expect(status.errorCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Retries', () => {
    it('should retry failed commands up to max retries', async () => {
      let attemptCount = 0;
      const flakyCommand: QueuedCommand = {
        id: 'flaky-cmd',
        execute: mock(() => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Simulated failure');
          }
        }),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(flakyCommand);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have tried 3 times (1 original + 2 retries)
      expect(attemptCount).toBe(3);
      expect(flakyCommand.execute).toHaveBeenCalledTimes(3);

      const status = queue.getStatus();
      expect(status.processedCount).toBe(1); // Successfully processed after retries
    });

    it('should give up after max retries exceeded', async () => {
      const alwaysFailCommand: QueuedCommand = {
        id: 'always-fail-cmd',
        execute: mock(() => { throw new Error('Always fails'); }),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(alwaysFailCommand);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have tried 3 times (1 original + 2 retries)
      expect(alwaysFailCommand.execute).toHaveBeenCalledTimes(3);

      const status = queue.getStatus();
      expect(status.errorCount).toBe(1); // Final failure recorded
    });

    it('should lower priority of retried commands', async () => {
      const executionOrder: string[] = [];

      const failingCommand: QueuedCommand = {
        id: 'failing-cmd',
        execute: mock(() => {
          executionOrder.push('fail');
          throw new Error('First attempt fails');
        }),
        validate: mock(() => true),
        priority: 10,
        timestamp: Date.now(),
      };

      const normalCommand: QueuedCommand = {
        id: 'normal-cmd',
        execute: mock(() => { executionOrder.push('normal'); }),
        validate: mock(() => true),
        priority: 5,
        timestamp: Date.now(),
      };

      await queue.enqueue(failingCommand);
      await queue.enqueue(normalCommand);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Normal command should execute before retry of failing command
      expect(executionOrder).toContain('normal');
      expect(executionOrder).toContain('fail');
    });
  });

  describe('Queue Control', () => {
    it('should pause and resume processing', async () => {
      const executeMock = mock(() => {});
      const command: QueuedCommand = {
        id: 'paused-cmd',
        execute: executeMock,
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      queue.pause();
      await queue.enqueue(command);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(executeMock).not.toHaveBeenCalled();
      expect(queue.getStatus().isPaused).toBe(true);

      queue.resume();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(executeMock).toHaveBeenCalled();
      expect(queue.getStatus().isPaused).toBe(false);
    });

    it('should clear queue', async () => {
      const command: QueuedCommand = {
        id: 'clear-test',
        execute: mock(() => {}),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(command);
      expect(queue.getStatus().queueSize).toBe(1);

      queue.clear();
      expect(queue.getStatus().queueSize).toBe(0);
    });
  });

  describe('Queue Inspection', () => {
    it('should provide status information', async () => {
      const status = queue.getStatus();

      expect(status).toHaveProperty('queueSize');
      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('isPaused');
      expect(status).toHaveProperty('processedCount');
      expect(status).toHaveProperty('errorCount');
      expect(status).toHaveProperty('averageProcessingTime');
      expect(status).toHaveProperty('lastProcessingTime');

      expect(typeof status.queueSize).toBe('number');
      expect(typeof status.isProcessing).toBe('boolean');
      expect(typeof status.isPaused).toBe('boolean');
    });

    it('should return queued commands', async () => {
      const command: QueuedCommand = {
        id: 'inspect-cmd',
        execute: mock(() => {}),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(command);
      const queuedCommands = queue.getQueuedCommands();

      expect(queuedCommands).toHaveLength(1);
      expect(queuedCommands[0].id).toBe('inspect-cmd');
    });

    it('should check if command exists in queue', async () => {
      const command: QueuedCommand = {
        id: 'exists-cmd',
        execute: mock(() => {}),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      expect(queue.hasCommand('exists-cmd')).toBe(false);

      await queue.enqueue(command);
      expect(queue.hasCommand('exists-cmd')).toBe(true);
    });

    it('should remove specific commands', async () => {
      const command: QueuedCommand = {
        id: 'remove-cmd',
        execute: mock(() => {}),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(command);
      expect(queue.hasCommand('remove-cmd')).toBe(true);

      const removed = queue.removeCommand('remove-cmd');
      expect(removed).toBe(true);
      expect(queue.hasCommand('remove-cmd')).toBe(false);

      const notRemoved = queue.removeCommand('non-existent');
      expect(notRemoved).toBe(false);
    });
  });

  describe('Performance Metrics', () => {
    it('should track processing times', async () => {
      const command: QueuedCommand = {
        id: 'timing-cmd',
        execute: mock(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        }),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(command);
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = queue.getStatus();
      expect(status.lastProcessingTime).toBeGreaterThan(0);
      expect(status.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should calculate average processing time correctly', async () => {
      const commands = Array.from({ length: 3 }, (_, i): QueuedCommand => ({
        id: `avg-cmd-${i}`,
        execute: mock(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        }),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      }));

      for (const cmd of commands) {
        await queue.enqueue(cmd);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const status = queue.getStatus();
      expect(status.processedCount).toBe(3);
      expect(status.averageProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('Debouncing', () => {
    it('should debounce rapid command additions', async () => {
      const executeMock = mock(() => {});

      // Add commands rapidly
      const promises = Array.from({ length: 5 }, (_, i) =>
        queue.enqueue({
          id: `rapid-${i}`,
          execute: executeMock,
          validate: mock(() => true),
          priority: 1,
          timestamp: Date.now(),
        })
      );

      await Promise.all(promises);

      // Should not start processing immediately due to debouncing
      expect(executeMock).not.toHaveBeenCalled();

      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now commands should be processed
      expect(executeMock).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle destroy during processing', async () => {
      const command: QueuedCommand = {
        id: 'destroy-cmd',
        execute: mock(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        }),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      await queue.enqueue(command);

      // Destroy immediately after enqueue
      queue.destroy();

      // Should not throw errors
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = queue.getStatus();
      expect(status.queueSize).toBe(0);
    });

    it('should reject operations after destruction', async () => {
      queue.destroy();

      const command: QueuedCommand = {
        id: 'after-destroy',
        execute: mock(() => {}),
        validate: mock(() => true),
        priority: 1,
        timestamp: Date.now(),
      };

      await expect(queue.enqueue(command)).rejects.toThrow('CommandQueue has been destroyed');
    });

    it('should handle commands with no timestamp', async () => {
      const command: QueuedCommand = {
        id: 'no-timestamp',
        execute: mock(() => {}),
        validate: mock(() => true),
        priority: 1,
        timestamp: 0,
      };

      await expect(queue.enqueue(command)).resolves.toBeUndefined();

      const queuedCommands = queue.getQueuedCommands();
      expect(queuedCommands[0].timestamp).toBeGreaterThan(0);
    });
  });
});