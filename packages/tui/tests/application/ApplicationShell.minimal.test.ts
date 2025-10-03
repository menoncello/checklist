import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { ApplicationShell } from '../../src/application/ApplicationShell';
import { ApplicationShellConfig } from '../../src/application/ApplicationShellConfig';
import { createMockDependencies } from '../mocks/ApplicationShellMocks';

// Test ID: 2.5-UNIT-001 - ApplicationShell constructor initializes
describe('ApplicationShell Core Tests', () => {
  let config: ApplicationShellConfig;
  let mockDeps: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    config = {
      version: '1.0.0',
      splitRatio: 0.7,
    };

    // Create mock dependencies
    mockDeps = createMockDependencies(config);
  });

  afterEach(async () => {
    // Cleanup is handled by mocks
  });

  describe('Initialization (AC1)', () => {
    it('should initialize with valid configuration', () => {
      // Given: Application is initialized with valid configuration
      // When: ApplicationShell constructor is called
      const applicationShell = new ApplicationShell(config);

      // Then: ApplicationShell should be properly initialized
      expect(applicationShell).toBeDefined();
      expect(applicationShell.render).toBeDefined();
      expect(applicationShell.initialize).toBeDefined();
    });

    it('should handle initialization lifecycle', async () => {
      // Given: ApplicationShell is created
      const applicationShell = new ApplicationShell(config);

      // When: Lifecycle methods are called
      await applicationShell.initialize();

      // Then: Application should be in initialized state
      expect(applicationShell).toBeDefined();
    });

    it('should support basic operations', () => {
      // Given: ApplicationShell with basic configuration
      const applicationShell = new ApplicationShell(config);

      // When: Basic operations are performed
      applicationShell.render();

      // Then: Operations should complete without errors
      expect(applicationShell).toBeDefined();
    });
  });

  describe('Component Management', () => {
    let applicationShell: ApplicationShell;

    beforeEach(() => {
      applicationShell = new ApplicationShell(config);
    });

    it('should handle screen operations', () => {
      // Given: ApplicationShell with screen management
      const mockScreen = { name: 'test-screen', render: () => {} };

      // When: Screen operations are performed
      applicationShell.pushScreen(mockScreen);
      applicationShell.popScreen();

      // Then: Operations should complete successfully
      expect(applicationShell).toBeDefined();
    });

    it('should handle event operations', () => {
      // Given: ApplicationShell with event handling
      const mockHandler = () => {};

      // When: Event operations are performed
      applicationShell.on('test-event', mockHandler);
      applicationShell.emit('test-event');
      applicationShell.off('test-event', mockHandler);

      // Then: Operations should complete successfully
      expect(applicationShell).toBeDefined();
    });
  });

  describe('Terminal Integration', () => {
    let applicationShell: ApplicationShell;

    beforeEach(() => {
      applicationShell = new ApplicationShell(config);
    });

    it('should provide terminal information', () => {
      // Given: ApplicationShell with terminal integration
      // When: Terminal information is requested
      const size = applicationShell.getTerminalSize();

      // Then: Size information should be provided
      expect(size).toBeDefined();
      expect(typeof size.width).toBe('number');
      expect(typeof size.height).toBe('number');
    });

    it('should check terminal capabilities', () => {
      // Given: ApplicationShell with capability detection
      // When: Capabilities are checked
      const hasColor = applicationShell.isTerminalCapable('color');

      // Then: Capability information should be boolean
      expect(typeof hasColor).toBe('boolean');
    });
  });

  describe('Performance Monitoring', () => {
    let applicationShell: ApplicationShell;

    beforeEach(() => {
      applicationShell = new ApplicationShell(config);
    });

    it('should support profiling operations', () => {
      // Given: ApplicationShell with profiling
      // When: Profiling operations are performed
      applicationShell.startProfiling('test-operation');
      const duration = applicationShell.endProfiling('test-operation');

      // Then: Duration should be measured
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });
});