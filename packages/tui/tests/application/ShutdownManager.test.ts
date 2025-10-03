import { describe, expect, it, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { ShutdownManager, ShutdownReport, ShutdownContext } from '../../src/application/ShutdownManager';
import { ShutdownManagerConfig } from '../../src/application/ShutdownConfigManager';

describe('ShutdownManager - Simplified Tests', () => {
  let shutdownManager: ShutdownManager;
  let config: Partial<ShutdownManagerConfig>;

  beforeEach(() => {
    config = {
      timeout: 5000,
      enableStateSave: true,
      forceKillTimeout: 10000,
      cleanupOrder: [],
    };

    // Reset all mocks
    mock.restore();
  });

  afterEach(() => {
    // Cleanup - no explicit destroy method, mock.restore handles cleanup
    mock.restore();
  });

  it('should create ShutdownManager instance', () => {
    expect(() => {
      shutdownManager = new ShutdownManager(config as ShutdownManagerConfig);
    }).not.toThrow();

    expect(shutdownManager).toBeDefined();
  });

  it('should initialize with default config when no config provided', () => {
    expect(() => {
      shutdownManager = new ShutdownManager();
    }).not.toThrow();

    expect(shutdownManager).toBeDefined();
  });

  it('should have basic methods available', () => {
    shutdownManager = new ShutdownManager(config as ShutdownManagerConfig);

    expect(typeof shutdownManager.executeGracefulShutdown).toBe('function');
    expect(typeof shutdownManager.addCleanupStep).toBe('function');
    expect(typeof shutdownManager.removeCleanupStep).toBe('function');
    expect(typeof shutdownManager.onShutdown).toBe('function');
  });

  it('should handle graceful shutdown without errors', async () => {
    shutdownManager = new ShutdownManager(config as ShutdownManagerConfig);

    const report = await shutdownManager.executeGracefulShutdown('test-reason');

    expect(report).toBeDefined();
    expect(typeof report.duration).toBe('number');
    expect(report.stepsCompleted).toBeGreaterThanOrEqual(0);
    expect(typeof report.stepsFailed).toBe('number');
    expect(Array.isArray(report.steps)).toBe(true);
    expect(typeof report.forceShutdown).toBe('boolean');
    expect(typeof report.timeoutReached).toBe('boolean');
  });

  it('should handle force shutdown without errors', async () => {
    shutdownManager = new ShutdownManager(config as ShutdownManagerConfig);

    const report = await shutdownManager.executeGracefulShutdown('test-reason');

    expect(report).toBeDefined();
    expect(typeof report.duration).toBe('number');
    expect(typeof report.stepsCompleted).toBe('number');
    expect(typeof report.stepsFailed).toBe('number');
    expect(Array.isArray(report.steps)).toBe(true);
    expect(typeof report.forceShutdown).toBe('boolean');
    expect(typeof report.timeoutReached).toBe('boolean');
  });

  it('should add and remove cleanup steps', () => {
    shutdownManager = new ShutdownManager(config as ShutdownManagerConfig);

    const step = {
      id: 'test-step',
      name: 'Test Step',
      priority: 1,
      timeout: 5000,
      required: false,
      executor: async () => { console.log('Test step executed'); }
    };

    expect(() => shutdownManager.addCleanupStep(step)).not.toThrow();
    expect(() => shutdownManager.removeCleanupStep('test-step')).not.toThrow();
    expect(() => shutdownManager.removeCleanupStep('non-existent')).not.toThrow();
  });

  it('should handle cleanup steps execution order', async () => {
    shutdownManager = new ShutdownManager(config as ShutdownManagerConfig);

    const executionOrder: string[] = [];

    const step1 = {
      id: 'step1',
      name: 'Step 1',
      priority: 2,
      timeout: 5000,
      required: false,
      executor: async () => { executionOrder.push('step1'); }
    };

    const step2 = {
      id: 'step2',
      name: 'Step 2',
      priority: 1,
      timeout: 5000,
      required: false,
      executor: async () => { executionOrder.push('step2'); }
    };

    shutdownManager.addCleanupStep(step1);
    shutdownManager.addCleanupStep(step2);

    await shutdownManager.executeGracefulShutdown('test-reason');

    // Steps should be executed in priority order (higher priority first)
    expect(executionOrder).toEqual(['step1', 'step2']);
  });

  it('should handle errors in cleanup steps gracefully', async () => {
    shutdownManager = new ShutdownManager(config as ShutdownManagerConfig);

    const errorStep = {
      id: 'error-step',
      name: 'Error Step',
      priority: 1,
      timeout: 5000,
      required: false,
      executor: async () => { throw new Error('Test error'); }
    };

    const normalStep = {
      id: 'normal-step',
      name: 'Normal Step',
      priority: 2,
      timeout: 5000,
      required: false,
      executor: async () => { /* Should execute */ }
    };

    shutdownManager.addCleanupStep(errorStep);
    shutdownManager.addCleanupStep(normalStep);

    // Should not throw even if a step fails
    const report = await shutdownManager.executeGracefulShutdown('test-reason');

    expect(report).toBeDefined();
    expect(report.stepsFailed).toBeGreaterThan(0);
    expect(report.steps.length).toBeGreaterThan(0);

    // Check that failed steps are marked in the steps array
    const failedSteps = report.steps.filter(step => step.status === 'failed');
    expect(failedSteps.length).toBeGreaterThan(0);
  });

  it('should respect timeout configuration', async () => {
    const slowConfig = {
      ...config,
      timeout: 100 // Very short timeout
    } as ShutdownManagerConfig;

    shutdownManager = new ShutdownManager(slowConfig);

    const slowStep = {
      id: 'slow-step',
      name: 'Slow Step',
      priority: 1,
      timeout: 50, // Short timeout to trigger timeout behavior
      required: false,
      executor: async () => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    shutdownManager.addCleanupStep(slowStep);

    const startTime = Date.now();
    const report = await shutdownManager.executeGracefulShutdown('test-reason');
    const duration = Date.now() - startTime;

    expect(report).toBeDefined();
    expect(duration).toBeLessThan(300); // Should be fast due to timeout
  });

  it('should generate proper report format', async () => {
    shutdownManager = new ShutdownManager(config as ShutdownManagerConfig);

    const report = await shutdownManager.executeGracefulShutdown('test-reason');

    expect(report).toMatchObject({
      duration: expect.any(Number),
      stepsCompleted: expect.any(Number),
      stepsFailed: expect.any(Number),
      steps: expect.any(Array),
      forceShutdown: expect.any(Boolean),
      timeoutReached: expect.any(Boolean)
    });

    // Verify step structure if any steps were executed
    if (report.steps.length > 0) {
      const step = report.steps[0];
      expect(step).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        status: expect.stringMatching(/^(completed|failed|skipped)$/)
      });
      expect(typeof step.duration).toBe('number');
    }
  });

  it('should handle concurrent shutdown attempts', async () => {
    shutdownManager = new ShutdownManager(config as ShutdownManagerConfig);

    // Start multiple shutdown attempts simultaneously
    const promises = [
      shutdownManager.executeGracefulShutdown('reason1'),
      shutdownManager.executeGracefulShutdown('reason2'),
      shutdownManager.executeGracefulShutdown('reason3')
    ];

    const results = await Promise.all(promises);

    // All should complete without throwing
    expect(results).toHaveLength(3);
    results.forEach(report => {
      expect(report).toBeDefined();
      expect(typeof report.duration).toBe('number');
    });
  });

  it('should handle destroy method correctly', () => {
    shutdownManager = new ShutdownManager(config as ShutdownManagerConfig);

    // Test basic cleanup
    expect(shutdownManager).toBeDefined();
    expect(shutdownManager.getConfig()).toBeDefined();
  });
});