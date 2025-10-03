import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { TerminalInitializer } from '@checklist/tui/src/terminal/TerminalInitializer';
import { CapabilityDetector } from '@checklist/tui/src/terminal/CapabilityDetector';
import { FallbackRenderer } from '@checklist/tui/src/terminal/FallbackRenderer';
import { TerminalManagerConfig } from '@checklist/tui/src/terminal/TerminalManagerConfig';
import { TerminalStateManager } from '@checklist/tui/src/terminal/TerminalStateManager';

// Mock dependencies
const mockCapabilityDetector = {
  detect: mock(() => Promise.resolve({
    capabilities: {
      color: true,
      color256: true,
      trueColor: true,
      unicode: true,
      mouse: false,
      altScreen: true,
      windowTitle: true,
      clipboard: false,
    }
  })),
};

const mockFallbackRenderer = {
  render: mock(() => 'rendered content'),
};

const mockTerminalStateManager = {
  getState: mock(() => ({
    initialized: false,
    supportsColor: false,
    supportsUnicode: false,
    width: 80,
    height: 24,
    originalMode: undefined,
    capabilities: new Map(),
    fallbackMode: false,
  })),
  setInitialized: mock(() => {}),
  setSupportsColor: mock(() => {}),
  setSupportsUnicode: mock(() => {}),
  setDimensions: mock(() => {}),
  setCapability: mock(() => {}),
  setOriginalMode: mock(() => {}),
  setFallbackMode: mock(() => {}),
};

const mockTerminalManagerConfig: TerminalManagerConfig = {
  enableRawMode: true,
  enableMouseSupport: false,
  enableAltScreen: false,
  fallbackRenderer: true,
  autoDetectCapabilities: true,
};

// Mock constructor functions
const mockCapabilityDetectorConstructor = mock(() => mockCapabilityDetector);
const mockFallbackRendererConstructor = mock(() => mockFallbackRenderer);
const mockTerminalStateManagerConstructor = mock(() => mockTerminalStateManager);

describe('TerminalInitializer', () => {
  let terminalInitializer: TerminalInitializer;
  let originalStdin: any;
  let originalStdout: any;

  beforeEach(() => {
    // Save original stdin/stdout
    originalStdin = process.stdin;
    originalStdout = process.stdout;

    // Reset constructor mocks
    mockCapabilityDetectorConstructor.mockRestore();
    mockFallbackRendererConstructor.mockRestore();
    mockTerminalStateManagerConstructor.mockRestore();

    // Reset all mock implementations
    mockCapabilityDetector.detect.mockRestore();
    mockTerminalStateManager.setInitialized.mockRestore();
    mockTerminalStateManager.setFallbackMode.mockRestore();
    mockTerminalStateManager.setSupportsColor.mockRestore();
    mockTerminalStateManager.setSupportsUnicode.mockRestore();
    mockTerminalStateManager.setDimensions.mockRestore();
    mockTerminalStateManager.setCapability.mockRestore();
    mockTerminalStateManager.setOriginalMode.mockRestore();
    mockTerminalStateManager.getState.mockRestore();

    // Restore default mock implementations
    mockCapabilityDetector.detect.mockResolvedValue({
      capabilities: {
        color: true,
        color256: true,
        trueColor: true,
        unicode: true,
        mouse: false,
        altScreen: true,
        windowTitle: true,
        clipboard: false,
      }
    });

    mockTerminalStateManager.getState.mockReturnValue({
      initialized: false,
      supportsColor: false,
      supportsUnicode: false,
      width: 80,
      height: 24,
      originalMode: undefined,
      capabilities: new Map(),
      fallbackMode: false,
    });

    // Mock process.stdout for testing
    process.stdout = {
      columns: 80,
      rows: 24,
    } as any;

    // Create fresh instance
    terminalInitializer = new TerminalInitializer(
      mockTerminalManagerConfig,
      mockTerminalStateManager as any,
      mockCapabilityDetector as any,
      mockFallbackRenderer as any
    );
  });

  afterEach(() => {
    // Restore original stdin/stdout
    process.stdin = originalStdin;
    process.stdout = originalStdout;
  });

  describe('constructor', () => {
    it('should create instance with provided dependencies', () => {
      expect(terminalInitializer).toBeDefined();
      expect(terminalInitializer).toBeInstanceOf(TerminalInitializer);

      const config = (terminalInitializer as any).config;
      const state = (terminalInitializer as any).state;
      const capabilityDetector = (terminalInitializer as any).capabilityDetector;
      const fallbackRenderer = (terminalInitializer as any).fallbackRenderer;

      expect(config).toBe(mockTerminalManagerConfig);
      expect(state).toBe(mockTerminalStateManager);
      expect(capabilityDetector).toBe(mockCapabilityDetector);
      expect(fallbackRenderer).toBe(mockFallbackRenderer);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully in TTY environment', async () => {
      // Mock TTY environment
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      await terminalInitializer.initialize();

      expect(mockTerminalStateManager.setInitialized).toHaveBeenCalledWith(true);
      expect(mockTerminalStateManager.setFallbackMode).not.toHaveBeenCalled();
    });

    it('should enable fallback mode in non-TTY environment', async () => {
      // Mock non-TTY environment
      process.stdin = {
        isTTY: false,
      } as any;

      await terminalInitializer.initialize();

      expect(mockTerminalStateManager.setFallbackMode).toHaveBeenCalledWith(true);
      expect(mockTerminalStateManager.setInitialized).toHaveBeenCalledWith(true);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock TTY environment to trigger capability detection
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      // Mock capability detector to throw error
      mockCapabilityDetector.detect.mockRejectedValue(new Error('Detection failed'));

      // Should not throw an error
      await expect(terminalInitializer.initialize()).resolves.toBeUndefined();

      // Should have entered fallback mode
      expect(mockTerminalStateManager.setFallbackMode).toHaveBeenCalledWith(true);
    });

    it('should log initialization success', async () => {
      // Mock TTY environment
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      // Mock state to return initialized state
      mockTerminalStateManager.getState.mockReturnValue({
        initialized: true,
        supportsColor: true,
        supportsUnicode: true,
        width: 80,
        height: 24,
        originalMode: undefined,
        capabilities: new Map(),
        fallbackMode: false,
      });

      await terminalInitializer.initialize();

      // Should complete without errors
      expect(mockTerminalStateManager.setInitialized).toHaveBeenCalled();
    });
  });

  describe('performInitialization', () => {
    it('should initialize fallback mode when TTY is not available', async () => {
      // Mock non-TTY environment
      process.stdin = {
        isTTY: false,
      } as any;

      const method = (terminalInitializer as any).performInitialization.bind(terminalInitializer);
      await method();

      expect(mockTerminalStateManager.setFallbackMode).toHaveBeenCalledWith(true);
      expect(mockTerminalStateManager.setInitialized).toHaveBeenCalledWith(true);
    });

    it('should setup raw mode when enabled', async () => {
      // Mock TTY environment with raw mode enabled
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      const configWithRawMode = { ...mockTerminalManagerConfig, enableRawMode: true };
      const initializerWithRawMode = new TerminalInitializer(
        configWithRawMode,
        mockTerminalStateManager as any,
        mockCapabilityDetector as any,
        mockFallbackRenderer as any
      );

      const method = (initializerWithRawMode as any).performInitialization.bind(initializerWithRawMode);
      await method();

      expect(process.stdin.setRawMode).toHaveBeenCalledWith(true);
      expect(mockTerminalStateManager.setOriginalMode).toHaveBeenCalledWith(0);
    });

    it('should not setup raw mode when disabled', async () => {
      // Mock TTY environment with raw mode disabled
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      const configWithoutRawMode = { ...mockTerminalManagerConfig, enableRawMode: false };
      const initializerWithoutRawMode = new TerminalInitializer(
        configWithoutRawMode,
        mockTerminalStateManager as any,
        mockCapabilityDetector as any,
        mockFallbackRenderer as any
      );

      const method = (initializerWithoutRawMode as any).performInitialization.bind(initializerWithoutRawMode);
      await method();

      expect(process.stdin.setRawMode).not.toHaveBeenCalled();
    });

    it('should detect capabilities when enabled', async () => {
      // Mock TTY environment
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      const configWithDetection = { ...mockTerminalManagerConfig, autoDetectCapabilities: true };
      const initializerWithDetection = new TerminalInitializer(
        configWithDetection,
        mockTerminalStateManager as any,
        mockCapabilityDetector as any,
        mockFallbackRenderer as any
      );

      const method = (initializerWithDetection as any).performInitialization.bind(initializerWithDetection);
      await method();

      expect(mockCapabilityDetector.detect).toHaveBeenCalled();
    });

    it('should not detect capabilities when disabled', async () => {
      // Mock TTY environment
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      const configWithoutDetection = { ...mockTerminalManagerConfig, autoDetectCapabilities: false };
      const initializerWithoutDetection = new TerminalInitializer(
        configWithoutDetection,
        mockTerminalStateManager as any,
        mockCapabilityDetector as any,
        mockFallbackRenderer as any
      );

      const method = (initializerWithoutDetection as any).performInitialization.bind(initializerWithoutDetection);
      await method();

      expect(mockCapabilityDetector.detect).not.toHaveBeenCalled();
    });

    it('should set initialized state', async () => {
      // Mock TTY environment
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      const method = (terminalInitializer as any).performInitialization.bind(terminalInitializer);
      await method();

      expect(mockTerminalStateManager.setInitialized).toHaveBeenCalledWith(true);
    });
  });

  describe('logInitializationSuccess', () => {
    it('should log success with current state', () => {
      // Mock state
      const mockState = {
        initialized: true,
        supportsColor: true,
        supportsUnicode: true,
        width: 80,
        height: 24,
        originalMode: undefined,
        capabilities: new Map([['color', true], ['unicode', true]]),
        fallbackMode: false,
      };

      mockTerminalStateManager.getState.mockReturnValue(mockState);

      const method = (terminalInitializer as any).logInitializationSuccess.bind(terminalInitializer);
      method();

      // Should complete without errors
      expect(mockTerminalStateManager.getState).toHaveBeenCalled();
    });

    it('should handle state with various capability combinations', () => {
      // Define interface for test state
      interface TestTerminalState {
        initialized: boolean;
        supportsColor: boolean;
        supportsUnicode: boolean;
        width: number;
        height: number;
        originalMode: number | undefined;
        capabilities: Map<string, boolean>;
        fallbackMode: boolean;
      }

      const testStates: TestTerminalState[] = [
        {
          initialized: true,
          supportsColor: true,
          supportsUnicode: true,
          width: 120,
          height: 40,
          originalMode: 0,
          capabilities: new Map([['color', true], ['unicode', true]]),
          fallbackMode: false,
        },
        {
          initialized: true,
          supportsColor: false,
          supportsUnicode: false,
          width: 80,
          height: 24,
          originalMode: 0,
          capabilities: new Map([['color', false], ['unicode', false]]),
          fallbackMode: true,
        },
        {
          initialized: true,
          supportsColor: true,
          supportsUnicode: false,
          width: 132,
          height: 43,
          originalMode: undefined,
          capabilities: new Map([['color', true], ['unicode', false]]),
          fallbackMode: false,
        },
      ];

      for (const state of testStates) {
        mockTerminalStateManager.getState.mockReturnValue(state as any);

        const method = (terminalInitializer as any).logInitializationSuccess.bind(terminalInitializer);
        method();

        // Should complete without errors for each state
        expect(mockTerminalStateManager.getState).toHaveBeenCalled();
      }
    });
  });

  describe('handleInitializationError', () => {
    it('should enter fallback mode when enabled', async () => {
      const error = new Error('Initialization failed');
      const configWithFallback = { ...mockTerminalManagerConfig, fallbackRenderer: true };
      const initializerWithFallback = new TerminalInitializer(
        configWithFallback,
        mockTerminalStateManager as any,
        mockCapabilityDetector as any,
        mockFallbackRenderer as any
      );

      const method = (initializerWithFallback as any).handleInitializationError.bind(initializerWithFallback);
      await method(error);

      expect(mockTerminalStateManager.setFallbackMode).toHaveBeenCalledWith(true);
    });

    it('should throw error when fallback mode is disabled', async () => {
      const error = new Error('Initialization failed');
      const configWithoutFallback = { ...mockTerminalManagerConfig, fallbackRenderer: false };
      const initializerWithoutFallback = new TerminalInitializer(
        configWithoutFallback,
        mockTerminalStateManager as any,
        mockCapabilityDetector as any,
        mockFallbackRenderer as any
      );

      const method = (initializerWithoutFallback as any).handleInitializationError.bind(initializerWithoutFallback);

      await expect(method(error)).rejects.toThrow('Initialization failed');
    });

    it('should initialize fallback mode successfully', async () => {
      const error = new Error('Initialization failed');
      const configWithFallback = { ...mockTerminalManagerConfig, fallbackRenderer: true };
      const initializerWithFallback = new TerminalInitializer(
        configWithFallback,
        mockTerminalStateManager as any,
        mockCapabilityDetector as any,
        mockFallbackRenderer as any
      );

      const method = (initializerWithFallback as any).handleInitializationError.bind(initializerWithFallback);
      await method(error);

      expect(mockTerminalStateManager.setSupportsColor).toHaveBeenCalledWith(false);
      expect(mockTerminalStateManager.setSupportsUnicode).toHaveBeenCalledWith(false);
      expect(mockTerminalStateManager.setDimensions).toHaveBeenCalledWith(80, 24);
    });

    it('should handle fallback mode initialization errors', async () => {
      const error = new Error('Initialization failed');
      const configWithFallback = { ...mockTerminalManagerConfig, fallbackRenderer: true };
      const initializerWithFallback = new TerminalInitializer(
        configWithFallback,
        mockTerminalStateManager as any,
        mockCapabilityDetector as any,
        mockFallbackRenderer as any
      );

      // Mock fallback mode initialization to throw error
      mockTerminalStateManager.setSupportsColor.mockImplementation(() => {
        throw new Error('Fallback initialization failed');
      });

      const method = (initializerWithFallback as any).handleInitializationError.bind(initializerWithFallback);

      await expect(method(error)).rejects.toThrow('Fallback initialization failed');
    });
  });

  describe('setupRawMode', () => {
    it('should set raw mode when TTY is available', () => {
      // Mock TTY environment
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      const method = (terminalInitializer as any).setupRawMode.bind(terminalInitializer);
      method();

      expect(process.stdin.setRawMode).toHaveBeenCalledWith(true);
      expect(mockTerminalStateManager.setOriginalMode).toHaveBeenCalledWith(0);
    });

    it('should not set raw mode when TTY is not available', () => {
      // Mock non-TTY environment
      const mockSetRawMode = mock(() => {});
      process.stdin = {
        isTTY: false,
        setRawMode: mockSetRawMode,
        isRaw: false,
      } as any;

      const method = (terminalInitializer as any).setupRawMode.bind(terminalInitializer);
      method();

      expect(mockSetRawMode).not.toHaveBeenCalled();
      expect(mockTerminalStateManager.setOriginalMode).not.toHaveBeenCalled();
    });

    it('should handle setRawMode errors gracefully', () => {
      // Mock TTY environment with setRawMode error
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {
          throw new Error('Raw mode not supported');
        }),
        isRaw: false,
      } as any;

      const method = (terminalInitializer as any).setupRawMode.bind(terminalInitializer);
      method();

      // Should not throw an error
      expect(process.stdin.setRawMode).toHaveBeenCalled();
      // setOriginalMode should still be called even if setRawMode fails
      expect(mockTerminalStateManager.setOriginalMode).toHaveBeenCalledWith(0);
    });

    it('should track original mode correctly', () => {
      // Test with already raw mode
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: true,
      } as any;

      const method = (terminalInitializer as any).setupRawMode.bind(terminalInitializer);
      method();

      expect(process.stdin.setRawMode).toHaveBeenCalledWith(true);
      expect(mockTerminalStateManager.setOriginalMode).toHaveBeenCalledWith(1);
    });
  });

  describe('detectCapabilities', () => {
    it('should detect and apply capabilities', async () => {
      const method = (terminalInitializer as any).detectCapabilities.bind(terminalInitializer);
      await method();

      expect(mockCapabilityDetector.detect).toHaveBeenCalled();
      expect(mockTerminalStateManager.setSupportsColor).toHaveBeenCalledWith(true);
      expect(mockTerminalStateManager.setSupportsUnicode).toHaveBeenCalledWith(true);
      expect(mockTerminalStateManager.setDimensions).toHaveBeenCalledWith(80, 24);

      // Check that capabilities are set
      const capabilityCalls = mockTerminalStateManager.setCapability.mock.calls;
      expect(capabilityCalls.length).toBeGreaterThan(0);
    });

    it('should handle capability detection with minimal results', async () => {
      // Mock minimal capability results
      mockCapabilityDetector.detect.mockResolvedValue({
        capabilities: {
          color: false,
          color256: false,
          trueColor: false,
          unicode: false,
          mouse: false,
          altScreen: false,
          windowTitle: false,
          clipboard: false,
        }
      });

      const method = (terminalInitializer as any).detectCapabilities.bind(terminalInitializer);
      await method();

      expect(mockTerminalStateManager.setSupportsColor).toHaveBeenCalledWith(false);
      expect(mockTerminalStateManager.setSupportsUnicode).toHaveBeenCalledWith(false);
    });

    it('should handle capability detection errors', async () => {
      // Mock capability detection error
      mockCapabilityDetector.detect.mockRejectedValue(new Error('Detection failed'));

      const method = (terminalInitializer as any).detectCapabilities.bind(terminalInitializer);

      // Should throw an error when called directly
      await expect(method()).rejects.toThrow('Detection failed');
    });

    it('should set default dimensions when not provided in results', async () => {
      // Mock capability results without dimensions
      mockCapabilityDetector.detect.mockResolvedValue({
        capabilities: {
          color: true,
          color256: true,
          trueColor: true,
          unicode: true,
          mouse: false,
          altScreen: false,
          windowTitle: false,
          clipboard: false,
        }
      });

      // Mock different terminal size
      process.stdout.columns = 120;
      process.stdout.rows = 40;

      const method = (terminalInitializer as any).detectCapabilities.bind(terminalInitializer);
      await method();

      expect(mockTerminalStateManager.setDimensions).toHaveBeenCalledWith(120, 40);
    });

    it('should handle missing stdout dimensions', async () => {
      // Mock capability results without dimensions
      mockCapabilityDetector.detect.mockResolvedValue({
        capabilities: {
          color: true,
          color256: true,
          trueColor: true,
          unicode: true,
          mouse: false,
          altScreen: false,
          windowTitle: false,
          clipboard: false,
        }
      });

      // Mock missing stdout dimensions
      const originalColumns = process.stdout.columns;
      const originalRows = process.stdout.rows;
      delete (process.stdout as any).columns;
      delete (process.stdout as any).rows;

      const method = (terminalInitializer as any).detectCapabilities.bind(terminalInitializer);
      await method();

      expect(mockTerminalStateManager.setDimensions).toHaveBeenCalledWith(80, 24); // Defaults

      // Restore
      (process.stdout as any).columns = originalColumns;
      (process.stdout as any).rows = originalRows;
    });
  });

  describe('initializeFallbackMode', () => {
    it('should initialize fallback mode with basic settings', async () => {
      const method = (terminalInitializer as any).initializeFallbackMode.bind(terminalInitializer);
      await method();

      expect(mockTerminalStateManager.setSupportsColor).toHaveBeenCalledWith(false);
      expect(mockTerminalStateManager.setSupportsUnicode).toHaveBeenCalledWith(false);
      expect(mockTerminalStateManager.setDimensions).toHaveBeenCalledWith(80, 24);
    });

    it('should handle fallback mode initialization errors', async () => {
      // Mock fallback mode initialization to throw error
      mockTerminalStateManager.setSupportsColor.mockImplementation(() => {
        throw new Error('Fallback init failed');
      });

      const method = (terminalInitializer as any).initializeFallbackMode.bind(terminalInitializer);

      await expect(method()).rejects.toThrow('Fallback init failed');
    });
  });

  describe('edge cases', () => {
    it('should handle process.stdin.isTTY being undefined', async () => {
      // Mock undefined isTTY
      const originalDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        configurable: true,
      });

      await terminalInitializer.initialize();

      expect(mockTerminalStateManager.setFallbackMode).toHaveBeenCalledWith(true);

      // Restore
      if (originalDescriptor) {
        Object.defineProperty(process.stdin, 'isTTY', originalDescriptor);
      } else {
        delete (process.stdin as any).isTTY;
      }
    });

    it('should handle process.stdout missing columns/rows', async () => {
      // Save original properties
      const originalColumns = process.stdout.columns;
      const originalRows = process.stdout.rows;

      // Remove properties
      delete (process.stdout as any).columns;
      delete (process.stdout as any).rows;

      // Mock TTY environment with auto-detection enabled
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      const configWithDetection = { ...mockTerminalManagerConfig, autoDetectCapabilities: true };
      const initializerWithDetection = new TerminalInitializer(
        configWithDetection,
        mockTerminalStateManager as any,
        mockCapabilityDetector as any,
        mockFallbackRenderer as any
      );

      await initializerWithDetection.initialize();

      // Should use default dimensions
      expect(mockTerminalStateManager.setDimensions).toHaveBeenCalledWith(80, 24);

      // Restore
      (process.stdout as any).columns = originalColumns;
      (process.stdout as any).rows = originalRows;
    });

    it('should handle multiple initialization attempts', async () => {
      // Mock TTY environment
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      // Initialize multiple times
      await terminalInitializer.initialize();
      await terminalInitializer.initialize();
      await terminalInitializer.initialize();

      // Should complete without errors
      expect(mockTerminalStateManager.setInitialized).toHaveBeenCalledTimes(3);
    });

    it('should handle initialization with mixed capability results', async () => {
      // Mock mixed capability results
      mockCapabilityDetector.detect.mockResolvedValue({
        capabilities: {
          color: true,
          color256: false,
          trueColor: false,
          unicode: true,
          mouse: false,
          altScreen: false,
          windowTitle: true,
          clipboard: false,
        }
      });

      // Mock TTY environment with auto-detection enabled
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      const configWithDetection = { ...mockTerminalManagerConfig, autoDetectCapabilities: true };
      const initializerWithDetection = new TerminalInitializer(
        configWithDetection,
        mockTerminalStateManager as any,
        mockCapabilityDetector as any,
        mockFallbackRenderer as any
      );

      await initializerWithDetection.initialize();

      // Should handle mixed capabilities correctly
      expect(mockTerminalStateManager.setSupportsColor).toHaveBeenCalledWith(true);
      expect(mockTerminalStateManager.setSupportsUnicode).toHaveBeenCalledWith(true);
    });
  });

  describe('performance', () => {
    it('should initialize quickly', async () => {
      // Mock TTY environment
      process.stdin = {
        isTTY: true,
        setRawMode: mock(() => {}),
        isRaw: false,
      } as any;

      const start = performance.now();
      await terminalInitializer.initialize();
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should complete quickly
    });

    it('should handle fallback mode initialization quickly', async () => {
      // Mock non-TTY environment
      process.stdin = {
        isTTY: false,
      } as any;

      const start = performance.now();
      await terminalInitializer.initialize();
      const end = performance.now();

      expect(end - start).toBeLessThan(50); // Should complete very quickly
    });
  });
});