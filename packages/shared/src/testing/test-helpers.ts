import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Server } from 'bun';

export class TestHelpers {
  static async createTempDir(prefix: string = 'test-'): Promise<string> {
    const tempDir = await mkdtemp(join(tmpdir(), prefix));
    if ((globalThis as any).__TEST_TEMP_DIRS__ !== undefined) {
      (globalThis as any).__TEST_TEMP_DIRS__.push(tempDir);
    }
    return tempDir;
  }

  static async cleanupTempDir(dir: string): Promise<void> {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp dir ${dir}:`, error);
    }
  }

  static async withTempDir<T>(
    fn: (dir: string) => Promise<T>,
    prefix?: string
  ): Promise<T> {
    const dir = await this.createTempDir(prefix);
    try {
      return await fn(dir);
    } finally {
      await this.cleanupTempDir(dir);
    }
  }

  static mockEnv(overrides: Record<string, string>): () => void {
    const original = { ...process.env };
    Object.assign(process.env, overrides);

    return () => {
      process.env = original;
    };
  }

  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  }

  static async retry<T>(
    fn: () => Promise<T>,
    attempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('Retry failed');
  }

  static createMockServer(port: number = 0): Server {
    const server = Bun.serve({
      port,
      fetch() {
        return new Response('Mock server response');
      },
    });

    // Initialize the array if it doesn't exist
    if ((globalThis as any).__TEST_SERVERS__ === undefined) {
      (globalThis as any).__TEST_SERVERS__ = [];
    }
    (globalThis as any).__TEST_SERVERS__.push(server);

    return server;
  }

  static stripAnsi(str: string): string {
    return str.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ''
    );
  }

  static async captureStdout<T>(
    fn: () => T | Promise<T>
  ): Promise<[T, string]> {
    const originalWrite = process.stdout.write;
    let captured = '';

    process.stdout.write = (chunk: any) => {
      captured += chunk.toString();
      return true;
    };

    try {
      const result = await fn();
      return [result, captured];
    } finally {
      process.stdout.write = originalWrite;
    }
  }

  static async captureStderr<T>(
    fn: () => T | Promise<T>
  ): Promise<[T, string]> {
    const originalWrite = process.stderr.write;
    let captured = '';

    process.stderr.write = (chunk: any) => {
      captured += chunk.toString();
      return true;
    };

    try {
      const result = await fn();
      return [result, captured];
    } finally {
      process.stderr.write = originalWrite;
    }
  }

  static generateLargeDataset(size: number): any[] {
    const data = [];
    for (let i = 0; i < size; i++) {
      data.push({
        id: `item-${i}`,
        value: Math.random(),
        timestamp: Date.now() + i,
        nested: {
          field1: `value-${i}`,
          field2: i % 2 === 0,
        },
      });
    }
    return data;
  }

  static measurePerformance<T>(fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  static async measureAsyncPerformance<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  static createAbortController(timeout: number): AbortController {
    const controller = new AbortController();
    setTimeout(() => {
      // Abort after timeout
      if (typeof (controller as any).abort === 'function') {
        (controller as any).abort();
      }
    }, timeout);

    return controller;
  }
}
