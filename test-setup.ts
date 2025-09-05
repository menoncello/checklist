/**
 * Global Test Setup for Bun Test Runner
 * This file is loaded before all tests via bunfig.toml
 */

// Setup global test utilities
import { beforeAll, afterAll } from 'bun:test';

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.CHECKLIST_ENV = 'test';

// Global test timeout
const DEFAULT_TIMEOUT = 5000;

// Setup global mocks if needed
beforeAll(() => {
  // Clear any previous test artifacts
  if (globalThis.localStorage) {
    globalThis.localStorage.clear();
  }

  // Setup console spy for tests that need to verify console output
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  globalThis.originalConsole = originalConsole;
});

afterAll(() => {
  // Restore console
  if (globalThis.originalConsole) {
    console.log = globalThis.originalConsole.log;
    console.error = globalThis.originalConsole.error;
    console.warn = globalThis.originalConsole.warn;
  }
});

// Global test helpers
globalThis.testHelpers = {
  timeout: DEFAULT_TIMEOUT,

  // Helper to create temp test directories
  async createTempDir(prefix = 'test-') {
    const tempDir = await Bun.write(`/tmp/${prefix}${Date.now()}/test.txt`, 'test');
    return tempDir;
  },

  // Helper for async test delays
  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Mock file system helper
  mockFS: () => {
    const files = new Map<string, string>();
    return {
      readFile: (path: string) => files.get(path),
      writeFile: (path: string, content: string) => files.set(path, content),
      exists: (path: string) => files.has(path),
      clear: () => files.clear(),
    };
  },
};

// Export for TypeScript
declare global {
  var originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
  };

  var testHelpers: {
    timeout: number;
    createTempDir: (prefix?: string) => Promise<any>;
    delay: (ms: number) => Promise<void>;
    mockFS: () => {
      readFile: (path: string) => string | undefined;
      writeFile: (path: string, content: string) => void;
      exists: (path: string) => boolean;
      clear: () => void;
    };
  };
}

export {};
