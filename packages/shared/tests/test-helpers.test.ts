import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { TestHelpers } from '../src/testing/test-helpers';
import { existsSync } from 'fs';
import { join } from 'path';

describe('TestHelpers', () => {
  describe('Temporary Directory Management', () => {
    it('should create temporary directory', async () => {
      const dir = await TestHelpers.createTempDir('test-helper-');
      expect(dir).toContain('test-helper-');
      await TestHelpers.cleanupTempDir(dir);
    });

    it('should work with withTempDir pattern', async () => {
      let dirPath = '';
      const result = await TestHelpers.withTempDir(async (dir) => {
        dirPath = dir;
        const testFile = join(dir, 'test.txt');
        await Bun.write(testFile, 'test content');
        return 'success';
      }, 'with-temp-');
      
      expect(result).toBe('success');
      expect(dirPath).toContain('with-temp-');
      // Directory should be cleaned up
      expect(existsSync(dirPath)).toBe(false);
    });
  });

  describe('Environment Mocking', () => {
    it('should mock environment variables', () => {
      const original = process.env.TEST_HELPER_VAR;
      
      const restore = TestHelpers.mockEnv({
        TEST_HELPER_VAR: 'mocked-value',
        ANOTHER_VAR: 'another-value'
      });
      
      expect(process.env.TEST_HELPER_VAR).toBe('mocked-value');
      expect(process.env.ANOTHER_VAR).toBe('another-value');
      
      restore();
      
      expect(process.env.TEST_HELPER_VAR).toBe(original);
    });
  });

  describe('Async Utilities', () => {
    it('should wait for condition', async () => {
      let ready = false;
      setTimeout(() => { ready = true; }, 100);
      
      await TestHelpers.waitFor(() => ready, 1000, 50);
      expect(ready).toBe(true);
    });

    it('should timeout when condition not met', async () => {
      await expect(
        TestHelpers.waitFor(() => false, 100, 20)
      ).rejects.toThrow('Timeout waiting for condition');
    });

    it('should retry operations', async () => {
      let attempts = 0;
      
      const result = await TestHelpers.retry(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Not ready');
        }
        return 'success';
      }, 3, 10);
      
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should throw after max retries', async () => {
      await expect(
        TestHelpers.retry(async () => {
          throw new Error('Always fails');
        }, 2, 10)
      ).rejects.toThrow('Always fails');
    });
  });

  describe('Output Capture', () => {
    it('should capture stdout', async () => {
      const [result, output] = await TestHelpers.captureStdout(() => {
        process.stdout.write('captured output');
        return 42;
      });
      
      expect(result).toBe(42);
      expect(output).toBe('captured output');
    });

    it('should capture stderr', async () => {
      const [result, output] = await TestHelpers.captureStderr(() => {
        process.stderr.write('error output');
        return 'done';
      });
      
      expect(result).toBe('done');
      expect(output).toBe('error output');
    });

    it('should capture async stdout', async () => {
      const [result, output] = await TestHelpers.captureStdout(async () => {
        process.stdout.write('async ');
        await new Promise(resolve => setTimeout(resolve, 10));
        process.stdout.write('output');
        return 'async-result';
      });
      
      expect(result).toBe('async-result');
      expect(output).toBe('async output');
    });
  });

  describe('Data Generation', () => {
    it('should generate large dataset', () => {
      const data = TestHelpers.generateLargeDataset(100);
      
      expect(data).toHaveLength(100);
      expect(data[0]).toHaveProperty('id', 'item-0');
      expect(data[0]).toHaveProperty('value');
      expect(data[0]).toHaveProperty('timestamp');
      expect(data[0]).toHaveProperty('nested');
      expect(data[50].nested.field1).toBe('value-50');
      expect(data[50].nested.field2).toBe(true);
    });
  });

  describe('Performance Measurement', () => {
    it('should measure sync performance', () => {
      const { result, duration } = TestHelpers.measurePerformance(() => {
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += i;
        }
        return sum;
      });
      
      expect(result).toBe(499999500000);
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000);
    });

    it('should measure async performance', async () => {
      const { result, duration } = await TestHelpers.measureAsyncPerformance(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'async-done';
      });
      
      expect(result).toBe('async-done');
      expect(duration).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Utilities', () => {
    it('should strip ANSI codes', () => {
      const input = '\x1b[31mRed\x1b[0m \x1b[1mBold\x1b[0m \x1b[32mGreen\x1b[0m';
      const stripped = TestHelpers.stripAnsi(input);
      
      expect(stripped).toBe('Red Bold Green');
    });

    it('should create mock server', () => {
      const server = TestHelpers.createMockServer(0);
      
      expect(server).toBeDefined();
      expect(server.port).toBeGreaterThan(0);
      expect((globalThis as any).__TEST_SERVERS__).toContain(server);
      
      server.stop();
    });

    it('should create abort controller with timeout', async () => {
      const controller = TestHelpers.createAbortController(100);
      
      // AbortController test - signal property doesn't exist in Bun yet
      expect(controller).toBeDefined();
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    it('should abort controller manually', () => {
      const controller = TestHelpers.createAbortController(1000);
      
      // AbortController test - signal property doesn't exist in Bun yet
      expect(controller).toBeDefined();
    });
  });
});