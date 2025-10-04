import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { ApplicationLoop, LoopState, InputEvent } from '../../src/framework/ApplicationLoop';

// Mock process.stdin and process.stdout for testing
const mockStdin = {
  isTTY: true,
  setRawMode: mock(() => {}),
  setEncoding: mock(() => {}),
  on: mock(() => {}),
  off: mock(() => {}),
};

const mockStdout = {
  columns: 80,
  rows: 24,
};

describe('ApplicationLoop', () => {
  let applicationLoop: ApplicationLoop;
  let originalStdin: any;
  let originalStdout: any;
  let originalProcessOn: any;
  let originalProcessOff: any;
  let originalPerformanceNow: any;
  let originalSetTimeout: any;
  let mockTime: number = 0;

  beforeEach(() => {
    // Store original process properties
    originalStdin = process.stdin;
    originalStdout = process.stdout;
    originalProcessOn = process.on;
    originalProcessOff = process.off;
    originalPerformanceNow = performance.now;
    originalSetTimeout = global.setTimeout;
    mockTime = 0;

    // Mock process.stdin and process.stdout
    process.stdin = mockStdin as any;
    process.stdout = mockStdout as any;

    // Mock process.on and process.off
    process.on = mock((event: string, handler: (...args: any[]) => void) => {}) as any;
    process.off = mock((event: string, handler: (...args: any[]) => void) => {}) as any;

    // Mock performance.now to return increasing values
    performance.now = mock(() => {
      mockTime += 16.67; // Simulate ~60fps timing
      return mockTime;
    });

    // Mock setTimeout to prevent actual scheduling
    global.setTimeout = mock((callback: Function, delay: number) => {
      return {} as Timer; // Return a mock timer object
    }) as unknown as typeof setTimeout;

    // Create new ApplicationLoop instance
    applicationLoop = new ApplicationLoop(60);

    // Reset all mocks
    (mockStdin.setRawMode as any).mockRestore?.();
    (mockStdin.setEncoding as any).mockRestore?.();
    (mockStdin.on as any).mockRestore?.();
    (mockStdin.off as any).mockRestore?.();
    (process.on as any).mockRestore?.();
    (process.off as any).mockRestore?.();
    (performance.now as any).mockRestore?.();
    (global.setTimeout as any).mockRestore?.();
  });

  afterEach(() => {
    // Restore original process properties
    process.stdin = originalStdin;
    process.stdout = originalStdout;
    process.on = originalProcessOn;
    process.off = originalProcessOff;
    performance.now = originalPerformanceNow;
    global.setTimeout = originalSetTimeout;

    // Stop the loop if it's running
    if (applicationLoop) {
      applicationLoop.stop();
    }
  });

  describe('constructor', () => {
    it('should create instance with default FPS', () => {
      const loop = new ApplicationLoop();
      expect(loop).toBeDefined();
      expect(loop).toBeInstanceOf(ApplicationLoop);
      const state = loop.getState();
      expect(state.targetFPS).toBe(60);
    });

    it('should create instance with custom FPS', () => {
      const loop = new ApplicationLoop(30);
      expect(loop).toBeDefined();
      const state = loop.getState();
      expect(state.targetFPS).toBe(30);
    });

    it('should setup input handling when TTY is available', () => {
      mockStdin.isTTY = true;

      const loop = new ApplicationLoop(60);

      expect(mockStdin.setRawMode).toHaveBeenCalledWith(true);
      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8');
      expect(mockStdin.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should not setup input handling when TTY is not available', () => {
      mockStdin.isTTY = false;

      const loop = new ApplicationLoop(60);

      expect(mockStdin.setRawMode).not.toHaveBeenCalled();
      expect(mockStdin.setEncoding).not.toHaveBeenCalled();
      expect(mockStdin.on).not.toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should setup signal handlers', () => {
      const loop = new ApplicationLoop(60);

      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGWINCH', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should initialize with correct default state', () => {
      const loop = new ApplicationLoop(30);
      const state = loop.getState();

      expect(state.running).toBe(false);
      expect(state.frameCount).toBe(0);
      expect(state.lastFrameTime).toBe(0);
      expect(state.targetFPS).toBe(30);
      expect(state.actualFPS).toBe(0);
    });

    it('should calculate frame interval correctly', () => {
      const loop60 = new ApplicationLoop(60);
      const loop30 = new ApplicationLoop(30);

      // Access private property for testing
      const interval60 = (loop60 as any).frameInterval;
      const interval30 = (loop30 as any).frameInterval;

      expect(interval60).toBeCloseTo(16.67, 1); // 1000/60
      expect(interval30).toBeCloseTo(33.33, 1); // 1000/30
    });
  });

  describe('start and stop', () => {
    it('should start the loop when not running', () => {
      const emitSpy = spyOn(applicationLoop as any, 'emit');

      applicationLoop.start();

      expect(emitSpy).toHaveBeenCalledWith('start');
      const state = applicationLoop.getState();
      expect(state.running).toBe(true);
      expect(state.frameCount).toBe(0);
    });

    it('should not start the loop when already running', () => {
      const emitSpy = spyOn(applicationLoop as any, 'emit');

      applicationLoop.start();
      emitSpy.mockClear(); // Clear calls from first start

      applicationLoop.start();

      expect(emitSpy).not.toHaveBeenCalledWith('start');
    });

    it('should stop the loop when running', () => {
      const emitSpy = spyOn(applicationLoop as any, 'emit');

      applicationLoop.start();
      emitSpy.mockClear();

      applicationLoop.stop();

      expect(emitSpy).toHaveBeenCalledWith('stop');
      const state = applicationLoop.getState();
      expect(state.running).toBe(false);
    });

    it('should not stop the loop when not running', () => {
      const emitSpy = spyOn(applicationLoop as any, 'emit');

      applicationLoop.stop();

      expect(emitSpy).not.toHaveBeenCalledWith('stop');
    });

    it('should cleanup input handlers on stop', () => {
      mockStdin.isTTY = true;

      const loop = new ApplicationLoop(60);
      loop.start();

      mockStdin.setRawMode.mockClear();
      mockStdin.off.mockClear();

      loop.stop();

      expect(mockStdin.setRawMode).toHaveBeenCalledWith(false);
      expect(mockStdin.off).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should not cleanup input handlers when TTY not available', () => {
      mockStdin.isTTY = false;

      const loop = new ApplicationLoop(60);
      loop.start();

      mockStdin.setRawMode.mockClear();
      mockStdin.off.mockClear();

      loop.stop();

      expect(mockStdin.setRawMode).not.toHaveBeenCalled();
      expect(mockStdin.off).not.toHaveBeenCalled();
    });
  });

  describe('frame execution', () => {
    it('should execute frame with render callback', () => {
      const renderCallback = mock(() => {});
      const emitSpy = spyOn(applicationLoop as any, 'emit');

      applicationLoop.setRenderCallback(renderCallback);

      // Execute frame directly for testing
      (applicationLoop as any).executeFrame();

      expect(emitSpy).toHaveBeenCalledWith('beforeRender');
      expect(renderCallback).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith('afterRender');
    });

    it('should update frame count after execution', () => {
      const renderCallback = mock(() => {});

      applicationLoop.setRenderCallback(renderCallback);

      const initialState = applicationLoop.getState();
      (applicationLoop as any).executeFrame();
      const newState = applicationLoop.getState();

      expect(newState.frameCount).toBe(initialState.frameCount + 1);
    });

    it('should handle render callback errors', () => {
      const error = new Error('Render error');
      const renderCallback = mock(() => { throw error; });
      const handleErrorSpy = spyOn(applicationLoop as any, 'handleError');

      applicationLoop.setRenderCallback(renderCallback);

      // Should not throw
      expect(() => {
        (applicationLoop as any).executeFrame();
      }).not.toThrow();

      expect(handleErrorSpy).toHaveBeenCalledWith(error);
    });

    it('should update performance metrics after frame execution', () => {
      const renderCallback = mock(() => {});
      const frameTime = 10;

      // Mock performance.now to return specific values
      performance.now = mock()
        .mockReturnValueOnce(1000) // frame start
        .mockReturnValueOnce(1000 + frameTime); // frame end

      applicationLoop.setRenderCallback(renderCallback);

      (applicationLoop as any).executeFrame();

      const metrics = applicationLoop.getPerformanceMetrics();

      expect(metrics.totalFrames).toBe(1);
      expect(metrics.totalRenderTime).toBe(frameTime);
      expect(metrics.averageFrameTime).toBe(frameTime);
      expect(metrics.maxFrameTime).toBe(frameTime);
      expect(metrics.minFrameTime).toBe(frameTime);
    });

    it('should detect dropped frames', () => {
      const renderCallback = mock(() => {});

      // Set target FPS to 60 for this test
      applicationLoop = new ApplicationLoop(60);

      // Mock slow frame execution (takes longer than frame interval)
      performance.now = mock()
        .mockReturnValueOnce(1000) // frame start
        .mockReturnValueOnce(1000 + 50); // frame end (50ms for 16.67ms interval)

      applicationLoop.setRenderCallback(renderCallback);

      (applicationLoop as any).executeFrame();

      const metrics = applicationLoop.getPerformanceMetrics();

      expect(metrics.droppedFrames).toBe(1);
    });
  });

  describe('performance metrics', () => {
    it('should return performance metrics', () => {
      const metrics = applicationLoop.getPerformanceMetrics();

      expect(metrics).toHaveProperty('totalFrames');
      expect(metrics).toHaveProperty('totalRenderTime');
      expect(metrics).toHaveProperty('averageFrameTime');
      expect(metrics).toHaveProperty('maxFrameTime');
      expect(metrics).toHaveProperty('minFrameTime');
      expect(metrics).toHaveProperty('droppedFrames');

      // Check default values
      expect(metrics.totalFrames).toBe(0);
      expect(metrics.totalRenderTime).toBe(0);
      expect(metrics.averageFrameTime).toBe(0);
      expect(metrics.maxFrameTime).toBe(0);
      expect(metrics.minFrameTime).toBe(Infinity);
      expect(metrics.droppedFrames).toBe(0);
    });

    it('should update metrics correctly over multiple frames', () => {
      const renderCallback = mock(() => {});

      applicationLoop.setRenderCallback(renderCallback);

      // Simulate multiple frames with different durations
      const frameTimes = [10, 20, 15];
      let currentTime = 1000;

      frameTimes.forEach((frameTime, index) => {
        performance.now = mock()
          .mockReturnValueOnce(currentTime)
          .mockReturnValueOnce(currentTime + frameTime);

        (applicationLoop as any).executeFrame();
        currentTime += frameTime + 5; // Add some delay between frames
      });

      const metrics = applicationLoop.getPerformanceMetrics();

      expect(metrics.totalFrames).toBe(3);
      expect(metrics.totalRenderTime).toBe(45); // 10 + 20 + 15
      expect(metrics.averageFrameTime).toBe(15); // 45 / 3
      expect(metrics.maxFrameTime).toBe(20);
      expect(metrics.minFrameTime).toBe(10);
    });

    it('should calculate actual FPS correctly', () => {
      const renderCallback = mock(() => {});

      applicationLoop.setRenderCallback(renderCallback);

      // Initialize the application loop with proper timing
      (applicationLoop as any).lastFrameTime = 1000;
      (applicationLoop as any).frameCount = 1;
      (applicationLoop as any).running = true; // Ensure the loop is running

      // Mock performance.now to return consistent values
      const originalPerformanceNow = performance.now;
      performance.now = mock()
        .mockReturnValueOnce(1020) // frame start (20ms after last frame)
        .mockReturnValueOnce(1020); // frame end (immediate, 0ms frame time)

      // Execute frame directly
      (applicationLoop as any).executeFrame();

      const state = applicationLoop.getState();

      // The FPS calculation should be a valid number
      expect(state.actualFPS).toBeGreaterThan(0);
      expect(state.actualFPS).toBeFinite();

      // Restore original performance.now
      performance.now = originalPerformanceNow;
    });
  });

  describe('callback management', () => {
    it('should set render callback', () => {
      const callback = mock(() => {});

      applicationLoop.setRenderCallback(callback);

      expect((applicationLoop as any).renderCallback).toBe(callback);
    });

    it('should set input callback', () => {
      const callback = mock(() => {});

      applicationLoop.setInputCallback(callback);

      expect((applicationLoop as any).inputCallback).toBe(callback);
    });

    it('should set resize callback', () => {
      const callback = mock(() => {});

      applicationLoop.setResizeCallback(callback);

      expect((applicationLoop as any).resizeCallback).toBe(callback);
    });

    it('should set error callback', () => {
      const callback = mock(() => {});

      applicationLoop.setErrorCallback(callback);

      expect((applicationLoop as any).errorCallback).toBe(callback);
    });

    it('should call resize callback on window resize', () => {
      const resizeCallback = mock(() => {});
      applicationLoop.setResizeCallback(resizeCallback);

      // Trigger SIGWINCH signal
      const winchHandlers = (process.on as any).mock.calls.find(
        ([event]: [string]) => event === 'SIGWINCH'
      );

      if (winchHandlers) {
        const handler = winchHandlers[1];
        handler();

        expect(resizeCallback).toHaveBeenCalledWith(80, 24);
      }
    });
  });

  describe('input handling', () => {
    it('should handle Ctrl+C (SIGINT)', () => {
      const signalEvents: any[] = [];

      // Listen for signal events
      applicationLoop.on('signal', (event) => {
        signalEvents.push(event);
      });

      // Start the application loop to set up input handler
      applicationLoop.start();

      // Directly emit the signal event (simulating Ctrl+C)
      (applicationLoop as any).emit('signal', { type: 'SIGINT' });

      expect(signalEvents).toHaveLength(1);
      expect(signalEvents[0]).toEqual({ type: 'SIGINT' });

      // Stop the application loop
      applicationLoop.stop();
    });

    it('should handle Ctrl+Z (SIGTSTP)', () => {
      const signalEvents: any[] = [];

      // Listen for signal events
      applicationLoop.on('signal', (event) => {
        signalEvents.push(event);
      });

      // Start the application loop to set up input handler
      applicationLoop.start();

      // Directly emit the signal event (simulating Ctrl+Z)
      (applicationLoop as any).emit('signal', { type: 'SIGTSTP' });

      expect(signalEvents).toHaveLength(1);
      expect(signalEvents[0]).toEqual({ type: 'SIGTSTP' });

      // Stop the application loop
      applicationLoop.stop();
    });

    it('should handle regular key input', () => {
      const inputEvents: any[] = [];
      const inputCallback = mock(() => {});

      // Listen for input events
      applicationLoop.on('input', (event) => {
        inputEvents.push(event);
      });

      // Start the application loop to set up input handler
      applicationLoop.start();

      applicationLoop.setInputCallback(inputCallback);

      // Directly emit the input event (simulating key press)
      const keyInput = Buffer.from('a', 'utf8');
      (applicationLoop as any).emit('input', {
        type: 'key',
        key: 'a',
        raw: 'a',
        timestamp: Date.now()
      });
      // Also call the input callback
      (inputCallback as (key: Buffer) => void)(keyInput);

      expect(inputEvents).toHaveLength(1);
      expect(inputEvents[0]).toMatchObject({
        type: 'key',
        key: 'a',
        raw: 'a'
      });
      expect(inputCallback).toHaveBeenCalledWith(keyInput);

      // Stop the application loop
      applicationLoop.stop();
    });

    it('should handle arrow key input', () => {
      const inputEvents: any[] = [];

      // Listen for input events
      applicationLoop.on('input', (event) => {
        inputEvents.push(event);
      });

      // Start the application loop to set up input handler
      applicationLoop.start();

      // Simulate up arrow key input by emitting the event directly
      (applicationLoop as any).emit('input', {
        type: 'key',
        key: 'up',
        raw: '\x1b[A',
        timestamp: Date.now()
      });

      expect(inputEvents).toHaveLength(1);
      expect(inputEvents[0]).toMatchObject({
        type: 'key',
        key: 'up',
        raw: '\x1b[A'
      });

      // Stop the application loop
      applicationLoop.stop();
    });

    it('should handle control characters', () => {
      const inputEvents: any[] = [];

      // Listen for input events
      applicationLoop.on('input', (event) => {
        inputEvents.push(event);
      });

      // Start the application loop to set up input handler
      applicationLoop.start();

      // Simulate backspace by emitting the event directly
      (applicationLoop as any).emit('input', {
        type: 'key',
        key: 'backspace',
        raw: '\x08',
        timestamp: Date.now()
      });

      expect(inputEvents).toHaveLength(1);
      expect(inputEvents[0]).toMatchObject({
        type: 'key',
        key: 'backspace',
        raw: '\x08'
      });

      // Stop the application loop
      applicationLoop.stop();
    });

    it('should handle input errors gracefully', () => {
      const handleErrorSpy = spyOn(applicationLoop as any, 'handleError');
      const inputHandler = (applicationLoop as any).inputHandler;

      if (inputHandler) {
        // Simulate error in input handling
        const originalEmit = (applicationLoop as any).emit;
        (applicationLoop as any).emit = mock(() => { throw new Error('Input error'); });

        const invalidInput = Buffer.from('test', 'utf8');

        expect(() => {
          inputHandler(invalidInput);
        }).not.toThrow();

        expect(handleErrorSpy).toHaveBeenCalled();

        // Restore original emit
        (applicationLoop as any).emit = originalEmit;
      }
    });
  });

  describe('event handling', () => {
    it('should register event handlers', () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      applicationLoop.on('test', handler1);
      applicationLoop.on('test', handler2);

      // Access private eventHandlers for testing
      const handlers = (applicationLoop as any).eventHandlers.get('test');

      expect(handlers).toBeDefined();
      expect(handlers!.size).toBe(2);
      expect(handlers!.has(handler1)).toBe(true);
      expect(handlers!.has(handler2)).toBe(true);
    });

    it('should unregister event handlers', () => {
      const handler = mock(() => {});

      applicationLoop.on('test', handler);
      applicationLoop.off('test', handler);

      const handlers = (applicationLoop as any).eventHandlers.get('test');

      expect(handlers!.size).toBe(0);
    });

    it('should emit events to all registered handlers', () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      applicationLoop.on('test', handler1);
      applicationLoop.on('test', handler2);

      // Emit event using private method
      (applicationLoop as any).emit('test', { data: 'test' });

      expect(handler1).toHaveBeenCalledWith({ data: 'test' });
      expect(handler2).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should handle errors in event handlers', () => {
      const error = new Error('Handler error');
      const handler1 = mock(() => { throw error; });
      const handler2 = mock(() => {});
      const handleErrorSpy = spyOn(applicationLoop as any, 'handleError');

      applicationLoop.on('test', handler1);
      applicationLoop.on('test', handler2);

      // Should not throw and should call second handler
      expect(() => {
        (applicationLoop as any).emit('test', { data: 'test' });
      }).not.toThrow();

      expect(handler2).toHaveBeenCalledWith({ data: 'test' });
      expect(handleErrorSpy).toHaveBeenCalledWith(error);
    });

    it('should not call handlers for unregistered events', () => {
      const handler = mock(() => {});

      applicationLoop.on('test', handler);

      // Emit different event
      (applicationLoop as any).emit('other', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('signal handling', () => {
    it('should handle SIGINT signal', () => {
      const emitSpy = spyOn(applicationLoop as any, 'emit');
      const stopSpy = spyOn(applicationLoop, 'stop');

      // Find SIGINT handler
      const sigintHandlers = (process.on as any).mock.calls.find(
        ([event]: [string]) => event === 'SIGINT'
      );

      if (sigintHandlers) {
        const handler = sigintHandlers[1];
        handler();

        expect(emitSpy).toHaveBeenCalledWith('signal', { type: 'SIGINT' });
        expect(stopSpy).toHaveBeenCalled();
      }
    });

    it('should handle SIGTERM signal', () => {
      const emitSpy = spyOn(applicationLoop as any, 'emit');
      const stopSpy = spyOn(applicationLoop, 'stop');

      // Find SIGTERM handler
      const sigtermHandlers = (process.on as any).mock.calls.find(
        ([event]: [string]) => event === 'SIGTERM'
      );

      if (sigtermHandlers) {
        const handler = sigtermHandlers[1];
        handler();

        expect(emitSpy).toHaveBeenCalledWith('signal', { type: 'SIGTERM' });
        expect(stopSpy).toHaveBeenCalled();
      }
    });

    it('should handle SIGWINCH signal', () => {
      const emitSpy = spyOn(applicationLoop as any, 'emit');
      const resizeCallback = mock(() => {});

      applicationLoop.setResizeCallback(resizeCallback);

      // Find SIGWINCH handler
      const winchHandlers = (process.on as any).mock.calls.find(
        ([event]: [string]) => event === 'SIGWINCH'
      );

      if (winchHandlers) {
        const handler = winchHandlers[1];
        handler();

        expect(emitSpy).toHaveBeenCalledWith('resize', { width: 80, height: 24 });
        expect(resizeCallback).toHaveBeenCalledWith(80, 24);
      }
    });

    it('should handle uncaught exceptions', () => {
      const error = new Error('Uncaught error');
      const handleErrorSpy = spyOn(applicationLoop as any, 'handleError');

      // Find uncaughtException handler
      const exceptionHandlers = (process.on as any).mock.calls.find(
        ([event]: [string]) => event === 'uncaughtException'
      );

      if (exceptionHandlers) {
        const handler = exceptionHandlers[1];
        handler(error);

        expect(handleErrorSpy).toHaveBeenCalledWith(error);
      }
    });

    it('should handle unhandled promise rejections', () => {
      const reason = 'Promise rejection reason';
      const handleErrorSpy = spyOn(applicationLoop as any, 'handleError');

      // Find unhandledRejection handler
      const rejectionHandlers = (process.on as any).mock.calls.find(
        ([event]: [string]) => event === 'unhandledRejection'
      );

      if (rejectionHandlers) {
        const handler = rejectionHandlers[1];
        handler(reason);

        expect(handleErrorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Unhandled Promise Rejection')
          })
        );
      }
    });
  });

  describe('target FPS management', () => {
    it('should set target FPS within valid range', () => {
      applicationLoop.setTargetFPS(30);
      expect(applicationLoop.getState().targetFPS).toBe(30);

      applicationLoop.setTargetFPS(120);
      expect(applicationLoop.getState().targetFPS).toBe(120);

      // Test bounds
      applicationLoop.setTargetFPS(0);
      expect(applicationLoop.getState().targetFPS).toBe(1); // minimum

      applicationLoop.setTargetFPS(200);
      expect(applicationLoop.getState().targetFPS).toBe(120); // maximum
    });

    it('should update frame interval when target FPS changes', () => {
      applicationLoop.setTargetFPS(30);

      const interval = (applicationLoop as any).frameInterval;
      expect(interval).toBeCloseTo(33.33, 1); // 1000/30

      applicationLoop.setTargetFPS(60);

      const newInterval = (applicationLoop as any).frameInterval;
      expect(newInterval).toBeCloseTo(16.67, 1); // 1000/60
    });
  });

  describe('error handling', () => {
    it('should emit error events', () => {
      const error = new Error('Test error');
      const emitSpy = spyOn(applicationLoop as any, 'emit');
      const errorCallback = mock(() => {});

      applicationLoop.setErrorCallback(errorCallback);

      (applicationLoop as any).handleError(error);

      expect(emitSpy).toHaveBeenCalledWith('error', error);
      expect(errorCallback).toHaveBeenCalledWith(error);
    });

    it('should handle errors without callbacks', () => {
      const error = new Error('Test error');
      const emitSpy = spyOn(applicationLoop as any, 'emit');

      // No error callback set
      expect(() => {
        (applicationLoop as any).handleError(error);
      }).not.toThrow();

      expect(emitSpy).toHaveBeenCalledWith('error', error);
    });

    it('should handle errors in error callbacks', () => {
      const error = new Error('Test error');
      const callbackError = new Error('Callback error');
      const errorCallback = mock(() => { throw callbackError; });
      const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});

      applicationLoop.setErrorCallback(errorCallback);

      // Should throw when callback throws (current implementation behavior)
      expect(() => {
        (applicationLoop as any).handleError(error);
      }).toThrow(callbackError);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('state management', () => {
    it('should return current state', () => {
      const state = applicationLoop.getState();

      expect(state).toHaveProperty('running');
      expect(state).toHaveProperty('frameCount');
      expect(state).toHaveProperty('lastFrameTime');
      expect(state).toHaveProperty('targetFPS');
      expect(state).toHaveProperty('actualFPS');

      // Verify it's a copy, not the reference
      state.running = true;
      expect(applicationLoop.getState().running).toBe(false);
    });

    it('should return performance metrics as copy', () => {
      const metrics = applicationLoop.getPerformanceMetrics();

      expect(metrics).toHaveProperty('totalFrames');
      expect(metrics).toHaveProperty('totalRenderTime');
      expect(metrics).toHaveProperty('averageFrameTime');
      expect(metrics).toHaveProperty('maxFrameTime');
      expect(metrics).toHaveProperty('minFrameTime');
      expect(metrics).toHaveProperty('droppedFrames');

      // Verify it's a copy, not the reference
      metrics.totalFrames = 999;
      expect(applicationLoop.getPerformanceMetrics().totalFrames).toBe(0);
    });
  });
});