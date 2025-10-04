import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { TerminalManager, TerminalManagerConfig } from '../../src/terminal/TerminalManager';

// Test IDs: 2.5-UNIT-009, 2.5-UNIT-010, 2.5-UNIT-011
describe('TerminalManager Core Tests', () => {
  let terminalManager: TerminalManager;
  let config: Partial<TerminalManagerConfig>;

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
      try {
        await terminalManager.cleanup();
      } catch {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Terminal Initialization (AC4)', () => {
    it('should initialize with configuration', async () => {
      // Given: TerminalManager with configuration
      terminalManager = new TerminalManager(config);

      // When: Initialization occurs
      await terminalManager.initialize();

      // Then: TerminalManager should be initialized
      expect(terminalManager.isInitialized()).toBe(true);
    });

    it('should provide state information', async () => {
      // Given: Initialized TerminalManager
      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();

      // When: State is requested
      const state = terminalManager.getState();

      // Then: State should be valid
      expect(state.initialized).toBe(true);
      expect(typeof state.supportsColor).toBe('boolean');
      expect(typeof state.supportsUnicode).toBe('boolean');
      expect(state.width).toBeGreaterThan(0);
      expect(state.height).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    it('should manage configuration', () => {
      // Given: TerminalManager with configuration
      terminalManager = new TerminalManager(config);

      // When: Configuration is accessed
      const currentConfig = terminalManager.getConfig();

      // Then: Configuration should be accessible
      expect(currentConfig).toBeDefined();
      expect(typeof currentConfig.enableRawMode).toBe('boolean');
    });

    it('should update configuration', () => {
      // Given: TerminalManager
      terminalManager = new TerminalManager(config);

      // When: Configuration is updated
      terminalManager.updateConfig({ enableMouseSupport: true });

      // Then: Configuration should be updated
      const updatedConfig = terminalManager.getConfig();
      expect(updatedConfig.enableMouseSupport).toBe(true);
    });
  });

  describe('Terminal Capabilities', () => {
    beforeEach(async () => {
      terminalManager = new TerminalManager(config);
      await terminalManager.initialize();
    });

    it('should provide capability information', () => {
      // Given: Initialized TerminalManager
      // When: Capabilities are checked
      const hasColor = terminalManager.supportsColor();
      const hasUnicode = terminalManager.supportsUnicode();

      // Then: Capability flags should be boolean
      expect(typeof hasColor).toBe('boolean');
      expect(typeof hasUnicode).toBe('boolean');
    });

    it('should provide dimensions', () => {
      // Given: TerminalManager with terminal info
      // When: Dimensions are requested
      const dimensions = terminalManager.getDimensions();

      // Then: Dimensions should be valid
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);
    });

    it('should check specific capabilities', () => {
      // Given: TerminalManager with capability detection
      // When: Specific capability is checked
      const hasCapability = terminalManager.hasCapability('color');

      // Then: Capability check should return boolean
      expect(typeof hasCapability).toBe('boolean');
    });
  });

  describe('Lifecycle Management', () => {
    it('should handle lifecycle correctly', async () => {
      // Given: TerminalManager in uninitialized state
      terminalManager = new TerminalManager(config);
      expect(terminalManager.isInitialized()).toBe(false);

      // When: Lifecycle methods are called
      await terminalManager.onInitialize();
      expect(terminalManager.isInitialized()).toBe(true);

      await terminalManager.onShutdown();
      expect(terminalManager.isInitialized()).toBe(false);
    });
  });
});