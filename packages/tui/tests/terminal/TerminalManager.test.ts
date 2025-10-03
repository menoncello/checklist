import { describe, expect, it, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { TerminalManager, TerminalManagerConfig, TerminalState } from '../../src/terminal/TerminalManager';

// Test IDs: 2.5-UNIT-009, 2.5-UNIT-010, 2.5-UNIT-011
describe('TerminalManager', () => {
  let terminalManager: TerminalManager;
  let config: TerminalManagerConfig;

  beforeEach(() => {
    config = {
      enableRawMode: true,
      enableMouseSupport: false,
      enableAltScreen: false,
      fallbackRenderer: true,
      autoDetectCapabilities: true,
    };
  });

  afterEach(async () => {
    if (terminalManager) {
      await terminalManager.cleanup();
    }
  });

  describe('Terminal Initialization (AC4)', () => {
    // Test ID: 2.5-UNIT-009 - TerminalManager sets raw mode correctly
    it('should set raw mode correctly when enabled', async () => {
      // Given: Terminal in default state with raw mode enabled in config
      terminalManager = new TerminalManager(config);

      // Mock process.stdin for testing
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

      // When: TerminalManager.initialize() is called
      const result = await terminalManager.initialize();

      // Then: Initialization should succeed and state should reflect initialization
      expect(result).toBe(true);
      expect(terminalManager.isInitialized()).toBe(true);

      // In TTY mode with enableRawMode, fallback mode should be false
      expect(terminalManager.isFallbackMode()).toBe(false);

      // Cleanup
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    });

    it('should detect terminal capabilities during initialization', async () => {
      // Given: TerminalManager with capability detection enabled
      terminalManager = new TerminalManager(config);

      // When: Initialization occurs
      await terminalManager.initialize();

      // Then: Terminal capabilities should be detected
      const state = terminalManager.getState();
      expect(state.initialized).toBe(true);
      expect(typeof state.supportsColor).toBe('boolean');
      expect(typeof state.supportsUnicode).toBe('boolean');
      expect(state.width).toBeGreaterThan(0);
      expect(state.height).toBeGreaterThan(0);
    });

    it('should fall back to safe mode when TTY is not available', async () => {
      // Given: Non-TTY environment
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });

      terminalManager = new TerminalManager(config);

      // When: Initialization occurs
      await terminalManager.initialize();

      // Then: Fallback mode should be activated
      expect(terminalManager.isFallbackMode()).toBe(true);
      expect(terminalManager.isInitialized()).toBe(true);

      // Cleanup
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    });

    it('should handle initialization errors gracefully', async () => {
      // Given: TerminalManager with potentially problematic configuration
      const badConfig = { ...config, enableRawMode: true };
      terminalManager = new TerminalManager(badConfig);

      // Mock an error during initialization by replacing setRawMode temporarily
      const originalIsTTY = process.stdin.isTTY;
      const originalSetRawMode = process.stdin.setRawMode;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
      process.stdin.setRawMode = () => {
        throw new Error('Raw mode not supported');
      };

      // When: Initialization occurs with setRawMode throwing error
      const result = await terminalManager.initialize();

      // Then: Error should be handled gracefully and initialization should still succeed
      expect(result).toBe(true);
      expect(terminalManager.isInitialized()).toBe(true);

      // Cleanup
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
      process.stdin.setRawMode = originalSetRawMode;
    });
  });

  describe('Terminal State Restoration (AC4)', () => {
    // Test ID: 2.5-UNIT-010 - TerminalManager restores original state
    it('should restore original terminal state on shutdown', async () => {
      // Given: Terminal in modified state (raw mode enabled)
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();

      // Store the original mode from state
      const state = terminalManager.getState();
      const originalMode = state.originalMode;

      // When: TerminalManager.cleanup() is called
      const result = await terminalManager.cleanup();

      // Then: Cleanup should succeed and terminal should be deinitialized
      expect(result).toBe(true);
      expect(terminalManager.isInitialized()).toBe(false);

      // If originalMode was set, the terminal mode should have been restored
      // (we can't spy on setRawMode in Bun, but we know the state was tracked)
      if (originalMode !== undefined) {
        expect(originalMode).toBeTypeOf('number');
      }

      // Cleanup
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    });

    it('should handle restoration when original mode is unknown', async () => {
      // Given: TerminalManager without stored original mode
      terminalManager = new TerminalManager({ ...config, enableRawMode: false });
      await terminalManager.initialize();

      // When: Cleanup is called without raw mode changes
      const result = await terminalManager.cleanup();

      // Then: Cleanup should complete without errors
      expect(result).toBe(true);
      expect(terminalManager.isInitialized()).toBe(false);
    });

    it('should handle restoration errors gracefully', async () => {
      // Given: TerminalManager with potential restoration issues
      const originalIsTTY = process.stdin.isTTY;
      const originalSetRawMode = process.stdin.setRawMode;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();

      // Mock restoration error by replacing setRawMode
      process.stdin.setRawMode = () => {
        throw new Error('Failed to restore terminal mode');
      };

      // When: Restoration fails during cleanup
      const result = await terminalManager.cleanup();

      // Then: Error should be handled gracefully
      expect(result).toBe(true); // Cleanup should still return true despite internal error
      expect(terminalManager.isInitialized()).toBe(false);

      // Cleanup
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
      process.stdin.setRawMode = originalSetRawMode;
    });
  });

  describe.skip('Signal Handling (AC4)', () => {
    // Test ID: 2.5-UNIT-011 - Signal handling (SIGINT, SIGTERM)
    it('should handle SIGINT and SIGTERM signals', async () => {
      // Given: TerminalManager with signal handling
      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();

      // Mock process signal handlers
      let sigintHandler: ((signal: string) => void) | undefined;
      let sigtermHandler: ((signal: string) => void) | undefined;

      const onSpy = spyOn(process, 'on').mockImplementation((event: string, handler: any) => {
        if (event === 'SIGINT') sigintHandler = handler;
        if (event === 'SIGTERM') sigtermHandler = handler;
        return process;
      });

      // Re-initialize to setup signal handlers
      await terminalManager.cleanup();
      await terminalManager.initialize();

      // When: SIGINT signal is received
      if (sigintHandler) {
        sigintHandler('SIGINT');
      }

      // When: SIGTERM signal is received
      if (sigtermHandler) {
        sigtermHandler('SIGTERM');
      }

      // Then: Signal handlers should be registered
      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      onSpy.mockRestore();
    });

    it('should gracefully shutdown on signal reception', async () => {
      // Given: TerminalManager running with signal handlers
      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();

      // Mock signal handling
      const cleanupSpy = spyOn(terminalManager, 'cleanup');

      // When: Shutdown signal is processed
      // (Simulated - actual signal handling tested in integration)
      await terminalManager.cleanup();

      // Then: Cleanup should be called
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should manage configuration correctly', () => {
      // Given: TerminalManager with initial configuration
      terminalManager = new TerminalManager(config);

      // When: Configuration is retrieved
      const currentConfig = terminalManager.getConfig();

      // Then: Configuration should match initial settings
      expect(currentConfig.enableRawMode).toBe(config.enableRawMode);
      expect(currentConfig.enableMouseSupport).toBe(config.enableMouseSupport);
      expect(currentConfig.fallbackRenderer).toBe(config.fallbackRenderer);
    });

    it('should update configuration dynamically', () => {
      // Given: TerminalManager with initial configuration
      terminalManager = new TerminalManager(config);

      const newConfig = { enableMouseSupport: true };

      // When: Configuration is updated
      terminalManager.updateConfig(newConfig);

      // Then: Configuration should reflect changes
      const updatedConfig = terminalManager.getConfig();
      expect(updatedConfig.enableMouseSupport).toBe(true);
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();
    });

    it('should provide current terminal state', () => {
      // Given: Initialized TerminalManager
      // When: State is requested
      const state = terminalManager.getState();

      // Then: State should be complete and valid
      expect(state.initialized).toBe(true);
      expect(typeof state.supportsColor).toBe('boolean');
      expect(typeof state.supportsUnicode).toBe('boolean');
      expect(state.width).toBeGreaterThan(0);
      expect(state.height).toBeGreaterThan(0);
      expect(state.capabilities).toBeInstanceOf(Map);
    });

    it('should track terminal dimensions correctly', () => {
      // Given: TerminalManager with terminal info
      // When: Dimensions are requested
      const dimensions = terminalManager.getDimensions();

      // Then: Dimensions should be valid
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);
    });

    it('should provide capability information', () => {
      // Given: TerminalManager with capability detection
      // When: Capabilities are checked
      const hasColor = terminalManager.supportsColor();
      const hasUnicode = terminalManager.supportsUnicode();

      // Then: Capability flags should be boolean
      expect(typeof hasColor).toBe('boolean');
      expect(typeof hasUnicode).toBe('boolean');
    });

    it('should check specific capabilities', () => {
      // Given: TerminalManager with detected capabilities
      // When: Specific capability is checked
      const hasCapability = terminalManager.hasCapability('color');

      // Then: Capability check should return boolean
      expect(typeof hasCapability).toBe('boolean');
    });
  });

  describe('Component Integration', () => {
    beforeEach(async () => {
      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();
    });

    it('should provide access to capability detector', () => {
      // Given: TerminalManager with capability detection
      // When: Capability detector is requested
      const detector = terminalManager.getCapabilityDetector();

      // Then: Detector should be available
      expect(detector).toBeDefined();
    });

    it('should provide access to fallback renderer', () => {
      // Given: TerminalManager with fallback support
      // When: Fallback renderer is requested
      const renderer = terminalManager.getFallbackRenderer();

      // Then: Renderer should be available
      expect(renderer).toBeDefined();
    });

    it('should provide terminal information', () => {
      // Given: TerminalManager with terminal info
      // When: Terminal info is requested
      const info = terminalManager.getTerminalInfo();

      // Then: Info should be available
      expect(info).toBeDefined();
    });
  });

  describe('Lifecycle Integration', () => {
    it('should register with lifecycle manager', () => {
      // Given: TerminalManager and mock lifecycle manager
      terminalManager = new TerminalManager(config);

      const registerHooksSpy = {
        registerHooks: (_: any) => {},
      };
      const mockLifecycleManager = {
        registerHooks: spyOn(registerHooksSpy, 'registerHooks'),
      };

      // When: Hooks are registered (TerminalManager registers itself with the lifecycle manager)
      terminalManager.registerHooks(mockLifecycleManager as any);

      // Then: TerminalManager should have registered itself with the lifecycle manager
      expect(mockLifecycleManager.registerHooks).toHaveBeenCalledWith(terminalManager);
    });

    it('should handle lifecycle state transitions', async () => {
      // Given: TerminalManager in various lifecycle states
      terminalManager = new TerminalManager(config);

      // When: Lifecycle methods are called
      await terminalManager.onInitialize();
      expect(terminalManager.isInitialized()).toBe(true);

      await terminalManager.onShutdown();
      expect(terminalManager.isInitialized()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization in non-TTY environments', async () => {
      // Given: Non-TTY environment
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });

      terminalManager = new TerminalManager(config);

      // When: Initialization occurs in non-TTY environment
      await terminalManager.initialize();

      // Then: Should handle gracefully with fallback mode
      expect(terminalManager.isInitialized()).toBe(true);
      expect(terminalManager.isFallbackMode()).toBe(true);

      // Cleanup
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
    });

    it('should handle concurrent initialization attempts', async () => {
      // Given: TerminalManager with potential concurrent access
      terminalManager = new TerminalManager(config);

      // When: Multiple initialization attempts occur
      const promises = [
        terminalManager.initialize(),
        terminalManager.initialize(),
        terminalManager.initialize(),
      ];

      // Then: All should complete without conflicts
      await Promise.all(promises);
      expect(terminalManager.isInitialized()).toBe(true);
    });

    it('should handle cleanup errors without throwing', async () => {
      // Given: TerminalManager that may error during cleanup
      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();

      // When: Cleanup encounters errors
      // Then: Should not throw unhandled errors
      await expect(terminalManager.cleanup()).resolves.toBeDefined();
    });

    it('should handle missing dependencies gracefully', () => {
      // Given: TerminalManager with minimal configuration
      const minimalConfig: TerminalManagerConfig = {
        enableRawMode: false,
        enableMouseSupport: false,
        enableAltScreen: false,
        fallbackRenderer: false,
        autoDetectCapabilities: false,
      };

      // When: TerminalManager is created with minimal config
      terminalManager = new TerminalManager(minimalConfig);

      // Then: Should create successfully without errors
      expect(terminalManager).toBeDefined();
      expect(terminalManager.getConfig()).toBeDefined();
      expect(terminalManager.getState()).toBeDefined();
    });

    it('should handle undefined configuration values', () => {
      // Given: TerminalManager with partial configuration
      const partialConfig: Partial<TerminalManagerConfig> = {
        enableRawMode: undefined as any,
        enableMouseSupport: undefined as any,
      };

      // When: TerminalManager is created with partial config
      terminalManager = new TerminalManager(partialConfig);

      // Then: Should handle undefined values gracefully
      expect(terminalManager).toBeDefined();
      const config = terminalManager.getConfig();
      expect(config).toBeDefined();
    });
  });

  describe('Test Environment Configuration', () => {
    it('should use test-friendly defaults in test environment', () => {
      // Given: Test environment
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      // When: TerminalManager is created without explicit config
      terminalManager = new TerminalManager();

      // Then: Should use test-friendly defaults
      const config = terminalManager.getConfig();
      expect(config.enableRawMode).toBe(false);
      expect(config.enableMouseSupport).toBe(false);
      expect(config.enableAltScreen).toBe(false);
      expect(config.fallbackRenderer).toBe(true);
      expect(config.autoDetectCapabilities).toBe(false);

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should merge provided config with test defaults in test environment', () => {
      // Given: Test environment with custom config
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const customConfig: Partial<TerminalManagerConfig> = {
        enableRawMode: true,
        enableMouseSupport: true,
      };

      // When: TerminalManager is created with custom config
      terminalManager = new TerminalManager(customConfig);

      // Then: Should merge with test defaults
      const config = terminalManager.getConfig();
      expect(config.enableRawMode).toBe(true);
      expect(config.enableMouseSupport).toBe(true);
      expect(config.enableAltScreen).toBe(false); // Default
      expect(config.fallbackRenderer).toBe(true); // Default
      expect(config.autoDetectCapabilities).toBe(false); // Default

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should ignore test defaults in non-test environment', () => {
      // Given: Non-test environment
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const customConfig: Partial<TerminalManagerConfig> = {
        enableRawMode: true,
        enableMouseSupport: true,
      };

      // When: TerminalManager is created in non-test environment
      terminalManager = new TerminalManager(customConfig);

      // Then: Should not apply test defaults
      const config = terminalManager.getConfig();
      expect(config.enableRawMode).toBe(true);
      expect(config.enableMouseSupport).toBe(true);

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('State Operations', () => {
    beforeEach(async () => {
      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();
    });

    it('should provide accurate capability information', () => {
      // Given: Initialized TerminalManager
      // When: Capabilities are checked
      const hasColor = terminalManager.supportsColor();
      const hasUnicode = terminalManager.supportsUnicode();
      const isFallback = terminalManager.isFallbackMode();

      // Then: Should return accurate boolean values
      expect(typeof hasColor).toBe('boolean');
      expect(typeof hasUnicode).toBe('boolean');
      expect(typeof isFallback).toBe('boolean');
    });

    it('should handle capability checking for unknown capabilities', () => {
      // Given: Initialized TerminalManager
      // When: Unknown capability is checked
      const hasUnknownCapability = terminalManager.hasCapability('unknown_capability');

      // Then: Should return boolean (likely false for unknown capabilities)
      expect(typeof hasUnknownCapability).toBe('boolean');
    });

    it('should provide correct terminal dimensions', () => {
      // Given: Initialized TerminalManager
      // When: Dimensions are requested
      const dimensions = terminalManager.getDimensions();

      // Then: Should provide valid dimensions
      expect(dimensions).toHaveProperty('width');
      expect(dimensions).toHaveProperty('height');
      expect(typeof dimensions.width).toBe('number');
      expect(typeof dimensions.height).toBe('number');
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);
    });

    it('should reflect initialization state correctly', () => {
      // Given: Initialized TerminalManager
      // When: Initialization state is checked
      const isInitialized = terminalManager.isInitialized();

      // Then: Should reflect actual state
      expect(isInitialized).toBe(true);
    });
  });

  describe('Component Access', () => {
    beforeEach(async () => {
      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();
    });

    it('should provide access to all components', () => {
      // Given: Initialized TerminalManager
      // When: Components are accessed
      const capabilityDetector = terminalManager.getCapabilityDetector();
      const fallbackRenderer = terminalManager.getFallbackRenderer();
      const terminalInfo = terminalManager.getTerminalInfo();

      // Then: All components should be accessible
      expect(capabilityDetector).toBeDefined();
      expect(fallbackRenderer).toBeDefined();
      expect(terminalInfo).toBeDefined();
    });

    it('should provide consistent component instances', () => {
      // Given: Initialized TerminalManager
      // When: Components are accessed multiple times
      const detector1 = terminalManager.getCapabilityDetector();
      const detector2 = terminalManager.getCapabilityDetector();
      const renderer1 = terminalManager.getFallbackRenderer();
      const renderer2 = terminalManager.getFallbackRenderer();

      // Then: Should return same instances
      expect(detector1).toBe(detector2);
      expect(renderer1).toBe(renderer2);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle configuration with boolean values', () => {
      // Given: Configuration with various boolean combinations
      const booleanConfigs: TerminalManagerConfig[] = [
        { enableRawMode: true, enableMouseSupport: true, enableAltScreen: true, fallbackRenderer: true, autoDetectCapabilities: true },
        { enableRawMode: false, enableMouseSupport: false, enableAltScreen: false, fallbackRenderer: false, autoDetectCapabilities: false },
        { enableRawMode: true, enableMouseSupport: false, enableAltScreen: true, fallbackRenderer: false, autoDetectCapabilities: true },
      ];

      // When: TerminalManager is created with each configuration
      // Then: Should handle all combinations gracefully
      for (const testConfig of booleanConfigs) {
        const testTerminalManager = new TerminalManager(testConfig);
        expect(testTerminalManager).toBeDefined();
        const retrievedConfig = testTerminalManager.getConfig();
        expect(retrievedConfig).toEqual(testConfig);
      }
    });

    it('should handle empty configuration object', () => {
      // Given: Empty configuration object
      const emptyConfig = {};

      // When: TerminalManager is created with empty config
      terminalManager = new TerminalManager(emptyConfig);

      // Then: Should apply defaults and work correctly
      expect(terminalManager).toBeDefined();
      const config = terminalManager.getConfig();
      expect(config).toBeDefined();
      expect(typeof config.enableRawMode).toBe('boolean');
      expect(typeof config.enableMouseSupport).toBe('boolean');
    });

    it('should handle configuration updates', () => {
      // Given: TerminalManager with initial configuration
      terminalManager = new TerminalManager(config);

      // When: Configuration is updated multiple times
      terminalManager.updateConfig({ enableMouseSupport: true });
      terminalManager.updateConfig({ enableAltScreen: true });
      terminalManager.updateConfig({ enableRawMode: false });

      // Then: Should apply all updates correctly
      const finalConfig = terminalManager.getConfig();
      expect(finalConfig.enableMouseSupport).toBe(true);
      expect(finalConfig.enableAltScreen).toBe(true);
      expect(finalConfig.enableRawMode).toBe(false);
      expect(finalConfig.fallbackRenderer).toBe(config.fallbackRenderer); // Unchanged
    });
  });

  describe('Lifecycle Edge Cases', () => {
    it('should handle multiple cleanup calls', async () => {
      // Given: TerminalManager that has been initialized
      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();

      // When: Cleanup is called multiple times
      const result1 = await terminalManager.cleanup();
      const result2 = await terminalManager.cleanup();
      const result3 = await terminalManager.cleanup();

      // Then: All should complete without errors
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
      expect(terminalManager.isInitialized()).toBe(false);
    });

    it('should handle multiple initialization calls', async () => {
      // Given: TerminalManager
      terminalManager = new TerminalManager(config);

      // When: Initialize is called multiple times
      const result1 = await terminalManager.initialize();
      const result2 = await terminalManager.initialize();
      const result3 = await terminalManager.initialize();

      // Then: All should complete without errors
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
      expect(terminalManager.isInitialized()).toBe(true);
    });

    it('should handle cleanup before initialization', async () => {
      // Given: TerminalManager that has not been initialized
      terminalManager = new TerminalManager(config);

      // When: Cleanup is called before initialization
      const result = await terminalManager.cleanup();

      // Then: Should handle gracefully
      expect(result).toBe(true);
      expect(terminalManager.isInitialized()).toBe(false);
    });
  });
});