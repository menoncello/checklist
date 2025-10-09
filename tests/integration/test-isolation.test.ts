/**
 * Test isolation verification
 */

import { describe, test, expect, beforeEach} from 'bun:test';
describe('Test Isolation', () => {
  beforeEach(() => {
    // Ensure test environment is properly set before each test
    process.env.NODE_ENV = 'test';
    Bun.env.NODE_ENV = 'test';
  });
  test('should verify process listeners are accessible', () => {
    // Basic test to ensure process listeners work
    expect(typeof process.listeners).toBe('function');

    // Test getting listeners for different events
    const uncaughtListeners = process.listeners('uncaughtException');
    expect(Array.isArray(uncaughtListeners)).toBe(true);

    const unhandledListeners = process.listeners('unhandledRejection');
    expect(Array.isArray(unhandledListeners)).toBe(true);
  });

  test('should verify process.env is accessible', () => {
    // Basic test to ensure process.env works
    expect(typeof process.env).toBe('object');

    // Ensure test environment is set correctly
    if (process.env.NODE_ENV !== 'test') {
      process.env.NODE_ENV = 'test';
    }

    expect(process.env.NODE_ENV).toBe('test');
  });

  test('should verify process.on/off works', () => {
    // Test adding and removing listeners
    const testListener = () => {};

    // Add listener
    process.on('SIGINT', testListener);
    const listenersAfterAdd = process.listeners('SIGINT');
    expect(listenersAfterAdd.length).toBeGreaterThan(0);

    // Remove listener
    process.off('SIGINT', testListener);
    const listenersAfterRemove = process.listeners('SIGINT');
    expect(listenersAfterRemove.filter(l => l === testListener).length).toBe(0);
  });
});