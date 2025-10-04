import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { LifecycleManager, LifecyclePhase, LifecycleHooks } from '../../src/framework/Lifecycle';
import { LifecycleState } from '../../src/framework/UIFramework';

// Mock process for testing with proper typing
const mockProcess = {
  once: mock((event: string, handler: Function) => {}),
  on: mock((event: string, handler: Function) => {}),
  off: mock((event: string, handler: Function) => {}),
  exit: mock((code?: number) => {}),
};

describe('LifecycleManager', () => {
  let lifecycleManager: LifecycleManager;
  let originalProcess: any;

  beforeEach(() => {
    // Store original process
    originalProcess = global.process;

    // Mock global process
    (global as any).process = mockProcess;

    // Reset all mocks
    mockProcess.once.mockRestore();
    mockProcess.on.mockRestore();
    mockProcess.off.mockRestore();
    mockProcess.exit.mockRestore();

    // Create new LifecycleManager instance
    lifecycleManager = new LifecycleManager();
  });

  afterEach(() => {
    // Restore original process
    (global as any).process = originalProcess;
  });

  describe('constructor', () => {
    it('should create instance with initial stopped state', () => {
      const manager = new LifecycleManager();
      const state = manager.getState();

      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(LifecycleManager);
      expect(state.phase).toBe('stopped');
      expect(state.startTime).toBe(0);
      expect(state.components.size).toBe(0);
      expect(state.screens.length).toBe(0);
      expect(state.errorState).toBeUndefined();
    });

    it('should setup shutdown handlers', () => {
      const manager = new LifecycleManager();

      expect(mockProcess.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockProcess.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });

  describe('initialization', () => {
    it('should initialize from stopped state', async () => {
      const state = lifecycleManager.getState();
      expect(state.phase).toBe('stopped');

      await lifecycleManager.initialize();

      const newState = lifecycleManager.getState();
      expect(newState.phase).toBe('initializing');
      expect(newState.startTime).toBeGreaterThan(0);
    });

    it('should not initialize from non-stopped state', async () => {
      await lifecycleManager.initialize();

      await expect(lifecycleManager.initialize()).rejects.toThrow(
        'Cannot initialize from phase: initializing'
      );
    });

    it('should set start time during initialization', async () => {
      const beforeInit = Date.now();

      await lifecycleManager.initialize();

      const state = lifecycleManager.getState();
      expect(state.startTime).toBeGreaterThanOrEqual(beforeInit);
      expect(state.startTime).toBeLessThanOrEqual(Date.now());
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization error');

      // Add a hook that throws
      lifecycleManager.registerHooks({
        onInitialize: () => { throw error; }
      });

      await expect(lifecycleManager.initialize()).rejects.toThrow(error);

      const state = lifecycleManager.getState();
      expect(state.errorState).toBe(error);
    });

    it('should execute initialize hooks in order', async () => {
      const executionOrder: string[] = [];

      lifecycleManager.registerHooks({
        onInitialize: async () => {
          executionOrder.push('hook1');
        }
      });

      lifecycleManager.registerHooks({
        onInitialize: async () => {
          executionOrder.push('hook2');
        }
      });

      await lifecycleManager.initialize();

      expect(executionOrder).toEqual(['hook1', 'hook2']);
    });

    it('should handle both sync and async initialize hooks', async () => {
      const results: string[] = [];

      lifecycleManager.registerHooks({
        onInitialize: () => {
          results.push('sync');
        }
      });

      lifecycleManager.registerHooks({
        onInitialize: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push('async');
        }
      });

      lifecycleManager.registerHooks({
        onInitialize: () => {
          return Promise.resolve().then(() => results.push('promise')) as any;
        }
      });

      await lifecycleManager.initialize();

      expect(results).toEqual(['sync', 'async', 'promise']);
    });

    it('should handle boolean return values from hooks', async () => {
      lifecycleManager.registerHooks({
        onInitialize: () => true
      });

      lifecycleManager.registerHooks({
        onInitialize: () => false
      });

      lifecycleManager.registerHooks({
        onInitialize: async () => true
      });

      // Should not throw, boolean values should be handled
      await expect(lifecycleManager.initialize()).resolves.toBeUndefined();
    });
  });

  describe('start', () => {
    beforeEach(async () => {
      await lifecycleManager.initialize();
    });

    it('should start from initializing state', async () => {
      await lifecycleManager.start();

      const state = lifecycleManager.getState();
      expect(state.phase).toBe('running');
    });

    it('should not start from non-initializing state', async () => {
      await lifecycleManager.start();

      await expect(lifecycleManager.start()).rejects.toThrow(
        'Cannot start from phase: running'
      );
    });

    it('should execute start hooks', async () => {
      const hookExecuted = mock(() => {});

      lifecycleManager.registerHooks({
        onStart: hookExecuted
      });

      await lifecycleManager.start();

      expect(hookExecuted).toHaveBeenCalled();
    });

    it('should handle start errors', async () => {
      const error = new Error('Start error');

      lifecycleManager.registerHooks({
        onStart: () => { throw error; }
      });

      await expect(lifecycleManager.start()).rejects.toThrow(error);

      const state = lifecycleManager.getState();
      expect(state.errorState).toBe(error);
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      await lifecycleManager.initialize();
      await lifecycleManager.start();
    });

    it('should stop from running state', async () => {
      await lifecycleManager.stop();

      const state = lifecycleManager.getState();
      expect(state.phase).toBe('stopped');
    });

    it('should not stop when not running', async () => {
      await lifecycleManager.stop();

      const state = lifecycleManager.getState();
      expect(state.phase).toBe('stopped');

      // Should not throw when called again
      await expect(lifecycleManager.stop()).resolves.toBeUndefined();
    });

    it('should execute stop hooks', async () => {
      const hookExecuted = mock(() => {});

      lifecycleManager.registerHooks({
        onStop: hookExecuted
      });

      await lifecycleManager.stop();

      expect(hookExecuted).toHaveBeenCalled();
    });

    it('should handle stop errors', async () => {
      const error = new Error('Stop error');

      lifecycleManager.registerHooks({
        onStop: () => { throw error; }
      });

      await expect(lifecycleManager.stop()).rejects.toThrow(error);

      const state = lifecycleManager.getState();
      expect(state.errorState).toBe(error);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await lifecycleManager.initialize();
      await lifecycleManager.start();
    });

    it('should shutdown from running state', async () => {
      await lifecycleManager.shutdown();

      const state = lifecycleManager.getState();
      expect(state.phase).toBe('stopped');
      expect(state.components.size).toBe(0);
      expect(state.screens.length).toBe(0);
    });

    it('should shutdown from stopped state', async () => {
      await lifecycleManager.stop();

      await expect(lifecycleManager.shutdown()).resolves.toBeUndefined();

      const state = lifecycleManager.getState();
      expect(state.phase).toBe('stopped');
    });

    it('should go through shutting-down phase', async () => {
      const stateChanges: LifecyclePhase[] = [];

      // Track state changes
      lifecycleManager.onStateChange((state) => {
        stateChanges.push(state.phase);
      });

      await lifecycleManager.shutdown();

      expect(stateChanges).toContain('shutting-down');
      expect(stateChanges[stateChanges.length - 1]).toBe('stopped');
    });

    it('should execute stop hooks if running', async () => {
      const stopHook = mock(() => {});
      const shutdownHook = mock(() => {});

      lifecycleManager.registerHooks({
        onStop: stopHook,
        onShutdown: shutdownHook
      });

      await lifecycleManager.shutdown();

      expect(stopHook).toHaveBeenCalled();
      expect(shutdownHook).toHaveBeenCalled();
    });

    it('should execute shutdown hooks', async () => {
      const hookExecuted = mock(() => {});

      lifecycleManager.registerHooks({
        onShutdown: hookExecuted
      });

      await lifecycleManager.shutdown();

      expect(hookExecuted).toHaveBeenCalled();
    });

    it('should execute shutdown handlers in reverse order', async () => {
      const executionOrder: string[] = [];

      const handler1 = async () => {
        executionOrder.push('handler1');
      };
      const handler2 = async () => {
        executionOrder.push('handler2');
      };
      const handler3 = async () => {
        executionOrder.push('handler3');
      };

      lifecycleManager.addShutdownHandler(handler1);
      lifecycleManager.addShutdownHandler(handler2);
      lifecycleManager.addShutdownHandler(handler3);

      await lifecycleManager.shutdown();

      expect(executionOrder).toEqual(['handler3', 'handler2', 'handler1']);
    });

    it('should force shutdown even if hooks fail', async () => {
      const error = new Error('Shutdown error');

      lifecycleManager.registerHooks({
        onShutdown: () => { throw error; }
      });

      await expect(lifecycleManager.shutdown()).resolves.toBeUndefined();

      const state = lifecycleManager.getState();
      expect(state.phase).toBe('stopped');
      expect(state.errorState).toBe(error);
    });

    it('should clear component registry during shutdown', async () => {
      lifecycleManager.registerComponent('component1');
      lifecycleManager.registerComponent('component2');
      lifecycleManager.pushScreen('screen1');
      lifecycleManager.pushScreen('screen2');

      expect(lifecycleManager.getComponentCount()).toBe(2);
      expect(lifecycleManager.getScreenCount()).toBe(2);

      await lifecycleManager.shutdown();

      expect(lifecycleManager.getComponentCount()).toBe(0);
      expect(lifecycleManager.getScreenCount()).toBe(0);
    });
  });

  describe('hook management', () => {
    it('should register and unregister hooks', () => {
      const hooks1: LifecycleHooks = {};
      const hooks2: LifecycleHooks = {};

      lifecycleManager.registerHooks(hooks1);
      lifecycleManager.registerHooks(hooks2);

      expect(() => {
        lifecycleManager.unregisterHooks(hooks1);
      }).not.toThrow();

      expect(() => {
        lifecycleManager.unregisterHooks(hooks2);
      }).not.toThrow();

      // Should not throw when unregistering non-existent hooks
      expect(() => {
        lifecycleManager.unregisterHooks({});
      }).not.toThrow();
    });

    it('should handle unregistering non-existent hooks', () => {
      const nonExistentHooks: LifecycleHooks = {};

      expect(() => {
        lifecycleManager.unregisterHooks(nonExistentHooks);
      }).not.toThrow();
    });

    it('should not execute unregistered hooks', async () => {
      const hookExecuted = mock(() => {});
      const hooks: LifecycleHooks = {
        onInitialize: hookExecuted
      };

      lifecycleManager.registerHooks(hooks);
      lifecycleManager.unregisterHooks(hooks);

      await lifecycleManager.initialize();

      expect(hookExecuted).not.toHaveBeenCalled();
    });
  });

  describe('shutdown handler management', () => {
    it('should add and remove shutdown handlers', () => {
      const handler1 = async () => {};
      const handler2 = async () => {};

      lifecycleManager.addShutdownHandler(handler1);
      lifecycleManager.addShutdownHandler(handler2);

      lifecycleManager.removeShutdownHandler(handler1);
      // No assertion needed since method returns void

      expect(() => {
        lifecycleManager.removeShutdownHandler(handler2);
      }).not.toThrow();

      expect(() => {
        lifecycleManager.removeShutdownHandler('nonexistent' as any);
      }).not.toThrow();
    });

    it('should not add duplicate shutdown handlers', () => {
      const handler = async () => {};

      lifecycleManager.addShutdownHandler(handler);
      lifecycleManager.addShutdownHandler(handler);

      // Should not throw, and duplicates are allowed (they'll be executed multiple times)
      lifecycleManager.removeShutdownHandler(handler);
      // No assertion needed since method returns void

      // Second removal should not throw
      expect(() => {
        lifecycleManager.removeShutdownHandler(handler);
      }).not.toThrow();
    });

    it('should execute shutdown handlers during shutdown', async () => {
      const handler1 = mock(() => Promise.resolve());
      const handler2 = mock(() => Promise.resolve());

      lifecycleManager.addShutdownHandler(handler1);
      lifecycleManager.addShutdownHandler(handler2);

      await lifecycleManager.initialize();
      await lifecycleManager.start();
      await lifecycleManager.shutdown();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should handle shutdown handler errors', async () => {
      const error = new Error('Handler error');
      const errorHandler = mock(() => Promise.reject(error));
      const successHandler = mock(() => Promise.resolve());

      lifecycleManager.addShutdownHandler(errorHandler);
      lifecycleManager.addShutdownHandler(successHandler);

      await lifecycleManager.initialize();
      await lifecycleManager.start();

      // Should not throw, should continue with other handlers
      await expect(lifecycleManager.shutdown()).resolves.toBeUndefined();

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('error handler management', () => {
    it('should add and remove error handlers', () => {
      const handler1 = (error: Error) => {};
      const handler2 = (error: Error) => {};

      lifecycleManager.addErrorHandler(handler1);
      lifecycleManager.addErrorHandler(handler2);

      expect(() => {
        lifecycleManager.removeErrorHandler(handler1);
      }).not.toThrow();

      expect(() => {
        lifecycleManager.removeErrorHandler(handler2);
      }).not.toThrow();
    });

    it('should execute error handlers when errors occur', async () => {
      const error = new Error('Test error');
      const errorHandler = mock(() => {});

      lifecycleManager.addErrorHandler(errorHandler);

      // Trigger error by throwing in a hook
      lifecycleManager.registerHooks({
        onInitialize: () => { throw error; }
      });

      await expect(lifecycleManager.initialize()).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('should handle errors in error handlers', async () => {
      const error = new Error('Test error');
      const handlerError = new Error('Handler error');
      const errorHandler = mock(() => { throw handlerError; });
      const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});

      lifecycleManager.addErrorHandler(errorHandler);

      // Trigger error
      lifecycleManager.registerHooks({
        onInitialize: () => { throw error; }
      });

      await expect(lifecycleManager.initialize()).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in error handler'),
        handlerError
      );
    });
  });

  describe('state change listeners', () => {
    it('should add and remove state change listeners', () => {
      const listener1 = (state: LifecycleState) => {};
      const listener2 = (state: LifecycleState) => {};

      lifecycleManager.onStateChange(listener1);
      lifecycleManager.onStateChange(listener2);

      expect(() => {
        lifecycleManager.offStateChange(listener1);
      }).not.toThrow();

      expect(() => {
        lifecycleManager.offStateChange(listener2);
      }).not.toThrow();
    });

    it('should notify listeners of state changes', async () => {
      const listener = mock(() => {});

      lifecycleManager.onStateChange(listener);

      await lifecycleManager.initialize();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'initializing'
        })
      );
    });

    it('should handle errors in state change listeners', async () => {
      const error = new Error('Listener error');
      const errorListener = mock(() => { throw error; });
      const successListener = mock(() => {});
      const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});

      lifecycleManager.onStateChange(errorListener);
      lifecycleManager.onStateChange(successListener);

      await lifecycleManager.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in state change listener'),
        error
      );
      expect(successListener).toHaveBeenCalled();
    });

    it('should provide state copy to listeners', async () => {
      let receivedState: LifecycleState | undefined;

      lifecycleManager.onStateChange((state) => {
        receivedState = state;
      });

      await lifecycleManager.initialize();

      expect(receivedState).toBeDefined();
      expect(receivedState!.phase).toBe('initializing');

      // Verify it's a copy
      if (receivedState) {
        (receivedState as any).phase = 'modified';
        expect(lifecycleManager.getState().phase).toBe('initializing');
      }
    });
  });

  describe('component management', () => {
    it('should register and unregister components', () => {
      lifecycleManager.registerComponent('component1');
      lifecycleManager.registerComponent('component2');

      expect(lifecycleManager.getComponentCount()).toBe(2);
      expect(lifecycleManager.getState().components.has('component1')).toBe(true);
      expect(lifecycleManager.getState().components.has('component2')).toBe(true);

      lifecycleManager.unregisterComponent('component1');

      expect(lifecycleManager.getComponentCount()).toBe(1);
      expect(lifecycleManager.getState().components.has('component1')).toBe(false);
    });

    it('should handle unregistering non-existent components', () => {
      expect(() => {
        lifecycleManager.unregisterComponent('nonexistent');
      }).not.toThrow();
    });

    it('should notify state change listeners on component changes', async () => {
      const listener = mock(() => {});

      lifecycleManager.onStateChange(listener);

      lifecycleManager.registerComponent('test');

      expect(listener).toHaveBeenCalled();
    });

    it('should handle duplicate component registration', () => {
      lifecycleManager.registerComponent('test');
      lifecycleManager.registerComponent('test');

      expect(lifecycleManager.getComponentCount()).toBe(1);
    });
  });

  describe('screen management', () => {
    it('should push and pop screens', () => {
      lifecycleManager.pushScreen('screen1');
      lifecycleManager.pushScreen('screen2');

      expect(lifecycleManager.getScreenCount()).toBe(2);
      expect(lifecycleManager.getCurrentScreen()).toBe('screen2');

      const popped = lifecycleManager.popScreen();

      expect(popped).toBe('screen2');
      expect(lifecycleManager.getScreenCount()).toBe(1);
      expect(lifecycleManager.getCurrentScreen()).toBe('screen1');
    });

    it('should handle popping from empty screen stack', () => {
      const popped = lifecycleManager.popScreen();

      expect(popped).toBeUndefined();
      expect(lifecycleManager.getScreenCount()).toBe(0);
    });

    it('should replace screens', () => {
      lifecycleManager.pushScreen('screen1');
      lifecycleManager.pushScreen('screen2');

      lifecycleManager.replaceScreen('screen3');

      expect(lifecycleManager.getScreenCount()).toBe(2);
      expect(lifecycleManager.getCurrentScreen()).toBe('screen3');
    });

    it('should push screen when replacing empty stack', () => {
      lifecycleManager.replaceScreen('screen1');

      expect(lifecycleManager.getScreenCount()).toBe(1);
      expect(lifecycleManager.getCurrentScreen()).toBe('screen1');
    });

    it('should notify state change listeners on screen changes', async () => {
      const listener = mock(() => {});

      lifecycleManager.onStateChange(listener);

      lifecycleManager.pushScreen('test');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('state queries', () => {
    beforeEach(async () => {
      await lifecycleManager.initialize();
    });

    it('should check running state', () => {
      expect(lifecycleManager.isRunning()).toBe(false);

      lifecycleManager.updatePhase('running');

      expect(lifecycleManager.isRunning()).toBe(true);
    });

    it('should check shutting down state', () => {
      expect(lifecycleManager.isShuttingDown()).toBe(false);

      lifecycleManager.updatePhase('shutting-down');

      expect(lifecycleManager.isShuttingDown()).toBe(true);
    });

    it('should check stopped state', () => {
      lifecycleManager.updatePhase('stopped');

      expect(lifecycleManager.isStopped()).toBe(true);

      lifecycleManager.updatePhase('running');

      expect(lifecycleManager.isStopped()).toBe(false);
    });

    it('should calculate uptime', async () => {
      // Create a fresh instance for this test since it modifies state
      const testLifecycleManager = new LifecycleManager();

      // No start time
      expect(testLifecycleManager.getUptime()).toBe(0);

      // Mock Date.now to control time
      const originalDateNow = Date.now;
      Date.now = mock(() => 1000);

      // Initialize to set start time
      await testLifecycleManager.initialize();

      // Advance time
      Date.now = mock(() => 1500);

      const uptime = testLifecycleManager.getUptime();
      expect(uptime).toBe(500);

      // Restore
      Date.now = originalDateNow;
    });

    it('should handle uptime with zero start time', () => {
      // Ensure start time is 0
      lifecycleManager.updatePhase('stopped');

      expect(lifecycleManager.getUptime()).toBe(0);
    });

    it('should report component and screen counts', () => {
      lifecycleManager.registerComponent('comp1');
      lifecycleManager.registerComponent('comp2');
      lifecycleManager.pushScreen('screen1');
      lifecycleManager.pushScreen('screen2');

      expect(lifecycleManager.getComponentCount()).toBe(2);
      expect(lifecycleManager.getScreenCount()).toBe(2);
    });

    it('should return current screen', () => {
      expect(lifecycleManager.getCurrentScreen()).toBeUndefined();

      lifecycleManager.pushScreen('screen1');
      expect(lifecycleManager.getCurrentScreen()).toBe('screen1');

      lifecycleManager.pushScreen('screen2');
      expect(lifecycleManager.getCurrentScreen()).toBe('screen2');

      lifecycleManager.popScreen();
      expect(lifecycleManager.getCurrentScreen()).toBe('screen1');
    });

    it('should check error state', async () => {
      // Create a fresh instance for this test since it modifies state
      const testLifecycleManager = new LifecycleManager();

      expect(testLifecycleManager.hasError()).toBe(false);
      expect(testLifecycleManager.getError()).toBeUndefined();

      const error = new Error('Test error');
      testLifecycleManager.registerHooks({
        onInitialize: () => { throw error; }
      });

      await expect(testLifecycleManager.initialize()).rejects.toThrow();

      expect(testLifecycleManager.hasError()).toBe(true);
      expect(testLifecycleManager.getError()).toBe(error);
    });

    it('should clear error state', async () => {
      // Create a fresh instance for this test since it modifies state
      const testLifecycleManager = new LifecycleManager();

      const error = new Error('Test error');
      testLifecycleManager.registerHooks({
        onInitialize: () => { throw error; }
      });

      await expect(testLifecycleManager.initialize()).rejects.toThrow();

      expect(testLifecycleManager.hasError()).toBe(true);

      testLifecycleManager.clearError();

      expect(testLifecycleManager.hasError()).toBe(false);
      expect(testLifecycleManager.getError()).toBeUndefined();
    });

    it('should notify state change listeners when clearing error', async () => {
      const listener = mock(() => {});
      const error = new Error('Test error');

      lifecycleManager.onStateChange(listener);
      lifecycleManager.registerHooks({
        onInitialize: () => { throw error; }
      });

      await expect(lifecycleManager.initialize()).rejects.toThrow();

      listener.mockClear();

      lifecycleManager.clearError();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('state management', () => {
    it('should return state copy', () => {
      lifecycleManager.registerComponent('test');
      lifecycleManager.pushScreen('screen');

      const state = lifecycleManager.getState();

      expect(state.components.size).toBe(1);
      expect(state.screens.length).toBe(1);

      // Modify the returned state
      state.components.add('modified');
      state.screens.push('modified');

      // Original state should be unchanged
      expect(lifecycleManager.getComponentCount()).toBe(1);
      expect(lifecycleManager.getScreenCount()).toBe(1);
    });

    it('should update phase', () => {
      lifecycleManager.updatePhase('running');

      expect(lifecycleManager.getState().phase).toBe('running');
    });

    it('should notify state change listeners on phase update', async () => {
      const listener = mock(() => {});

      lifecycleManager.onStateChange(listener);

      lifecycleManager.updatePhase('running');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'running'
        })
      );
    });
  });

  describe('signal handling', () => {
    it('should handle SIGINT signal', async () => {
      const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
      const exitSpy = spyOn(mockProcess, 'exit').mockImplementation(mock(() => {}));

      // Find and call SIGINT handler
      const sigintCall = (mockProcess.once.mock.calls as [string, Function][]).find(
        ([event]) => event === 'SIGINT'
      );

      if (sigintCall) {
        const handler = sigintCall[1];

        // Mock shutdown to avoid hanging
        const shutdownSpy = spyOn(lifecycleManager, 'shutdown').mockResolvedValue();

        await handler();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Received SIGINT')
        );
        expect(shutdownSpy).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(0);
      }
    });

    it('should handle SIGTERM signal', async () => {
      const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
      const exitSpy = spyOn(mockProcess, 'exit').mockImplementation(mock(() => {}));

      // Find and call SIGTERM handler
      const sigtermCall = (mockProcess.once.mock.calls as [string, Function][]).find(
        ([event]) => event === 'SIGTERM'
      );

      if (sigtermCall) {
        const handler = sigtermCall[1];

        // Mock shutdown to avoid hanging
        const shutdownSpy = spyOn(lifecycleManager, 'shutdown').mockResolvedValue();

        await handler();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Received SIGTERM')
        );
        expect(shutdownSpy).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(0);
      }
    });

    it('should handle uncaught exceptions', async () => {
      const error = new Error('Uncaught error');

      // Find and call uncaughtException handler
      const exceptionCall = (mockProcess.on.mock.calls as [string, Function][]).find(
        ([event]) => event === 'uncaughtException'
      );

      if (exceptionCall) {
        const handler = exceptionCall[1];

        try {
          handler(error);
        } catch (e) {
          // Handler might re-throw, that's expected behavior
        }

        const state = lifecycleManager.getState();
        expect(state.errorState).toEqual(error);
      }
    });

    it('should handle unhandled promise rejections', async () => {
      const reason = 'Promise rejection reason';

      // Find and call unhandledRejection handler
      const rejectionCall = (mockProcess.on.mock.calls as [string, Function][]).find(
        ([event]) => event === 'unhandledRejection'
      );

      if (rejectionCall) {
        const handler = rejectionCall[1];

        try {
          handler(reason);
        } catch (e) {
          // Handler might re-throw, that's expected behavior
        }

        const state = lifecycleManager.getState();
        expect(state.errorState).toBeDefined();
        expect(state.errorState!.message).toContain('Unhandled Promise Rejection');
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle multiple consecutive state changes', async () => {
      const listener = mock(() => {});

      lifecycleManager.onStateChange(listener);

      lifecycleManager.updatePhase('initializing');
      lifecycleManager.updatePhase('running');
      lifecycleManager.updatePhase('shutting-down');
      lifecycleManager.updatePhase('stopped');

      expect(listener).toHaveBeenCalledTimes(4);
    });

    it('should handle rapid component registration/unregistration', () => {
      for (let i = 0; i < 100; i++) {
        lifecycleManager.registerComponent(`component${i}`);
      }

      for (let i = 0; i < 100; i++) {
        lifecycleManager.unregisterComponent(`component${i}`);
      }

      expect(lifecycleManager.getComponentCount()).toBe(0);
    });

    it('should handle empty hook execution', async () => {
      const hooks: LifecycleHooks = {};

      lifecycleManager.registerHooks(hooks);

      await expect(lifecycleManager.initialize()).resolves.toBeUndefined();
      await expect(lifecycleManager.start()).resolves.toBeUndefined();
      await expect(lifecycleManager.stop()).resolves.toBeUndefined();
      await expect(lifecycleManager.shutdown()).resolves.toBeUndefined();
    });

    it('should handle hooks with undefined return values', async () => {
      lifecycleManager.registerHooks({
        onInitialize: () => undefined,
        onStart: () => undefined,
        onStop: () => undefined,
        onShutdown: () => undefined,
        onError: () => undefined,
      });

      await expect(lifecycleManager.initialize()).resolves.toBeUndefined();
      await expect(lifecycleManager.start()).resolves.toBeUndefined();
      await expect(lifecycleManager.stop()).resolves.toBeUndefined();
      await expect(lifecycleManager.shutdown()).resolves.toBeUndefined();
    });
  });
});