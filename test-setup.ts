import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import type { Server } from 'bun';

declare global {
  var __TEST_SERVERS__: Server[];
  var __TEST_TEMP_DIRS__: string[];
  var __ORIGINAL_CONSOLE__: typeof console;
}

globalThis.__TEST_SERVERS__ = [];
globalThis.__TEST_TEMP_DIRS__ = [];

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

globalThis.__ORIGINAL_CONSOLE__ = originalConsole as any;

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';

  // Mock console methods to suppress output during tests
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;

  for (const server of globalThis.__TEST_SERVERS__) {
    server.stop();
  }
  globalThis.__TEST_SERVERS__ = [];

  for (const tempDir of globalThis.__TEST_TEMP_DIRS__) {
    try {
      Bun.spawn(['rm', '-rf', tempDir], { stdout: 'ignore', stderr: 'ignore' });
    } catch {}
  }
  globalThis.__TEST_TEMP_DIRS__ = [];
});

beforeEach(() => {
  // Clear any mocks if needed
});

afterEach(() => {
  // Restore any mocks if needed
});

export {};
