import { EventHandler } from './UIFramework.js';

export interface LoopState {
  running: boolean;
  frameCount: number;
  lastFrameTime: number;
  targetFPS: number;
  actualFPS: number;
}

export class ApplicationLoop {
  private running = false;
  private frameCount = 0;
  private lastFrameTime = 0;
  private targetFPS = 60;
  private actualFPS = 0;
  private frameInterval: number;
  private loopTimer: Timer | null = null;
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private renderCallback?: () => void;
  private inputCallback?: (input: Buffer) => void;
  private resizeCallback?: (width: number, height: number) => void;
  private errorCallback?: (error: Error) => void;

  private performanceMetrics = {
    totalFrames: 0,
    totalRenderTime: 0,
    averageFrameTime: 0,
    maxFrameTime: 0,
    minFrameTime: Infinity,
    droppedFrames: 0,
  };

  constructor(targetFPS: number = 60) {
    this.targetFPS = targetFPS;
    this.frameInterval = 1000 / targetFPS;
    this.setupInputHandling();
    this.setupSignalHandlers();
  }

  private setupInputHandling(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', (data: Buffer) => {
        try {
          this.handleInput(data);
        } catch (error) {
          this.handleError(error as Error);
        }
      });
    }
  }

  private setupSignalHandlers(): void {
    process.on('SIGINT', () => {
      this.emit('signal', { type: 'SIGINT' });
      this.stop();
    });

    process.on('SIGTERM', () => {
      this.emit('signal', { type: 'SIGTERM' });
      this.stop();
    });

    process.on('SIGWINCH', () => {
      const size = {
        width: process.stdout.columns ?? 80,
        height: process.stdout.rows ?? 24,
      };
      this.emit('resize', size);
      if (this.resizeCallback) {
        this.resizeCallback(size.width, size.height);
      }
    });

    process.on('uncaughtException', (error) => {
      this.handleError(error);
    });

    process.on('unhandledRejection', (reason) => {
      this.handleError(new Error(`Unhandled Promise Rejection: ${reason}`));
    });
  }

  private handleInput(data: Buffer): void {
    const input = data.toString();

    // Handle special key sequences
    if (input === '\x03') {
      // Ctrl+C
      this.emit('signal', { type: 'SIGINT' });
      return;
    }

    if (input === '\x1a') {
      // Ctrl+Z
      this.emit('signal', { type: 'SIGTSTP' });
      return;
    }

    // Parse ANSI escape sequences
    const parsedInput = this.parseInput(input);
    this.emit('input', parsedInput);

    if (this.inputCallback) {
      this.inputCallback(data);
    }
  }

  private parseInput(input: string): InputEvent {
    // Basic ANSI escape sequence parsing
    if (input.startsWith('\x1b[')) {
      const seq = input.slice(2);

      // Arrow keys
      if (seq === 'A') return { type: 'key', key: 'up', raw: input };
      if (seq === 'B') return { type: 'key', key: 'down', raw: input };
      if (seq === 'C') return { type: 'key', key: 'right', raw: input };
      if (seq === 'D') return { type: 'key', key: 'left', raw: input };

      // Function keys
      if (seq.match(/^\d+~$/)) {
        const code = parseInt(seq.slice(0, -1));
        return { type: 'key', key: `f${code}`, raw: input };
      }

      // Mouse events (if enabled)
      if (seq.startsWith('M')) {
        return { type: 'mouse', raw: input };
      }

      return { type: 'escape', sequence: seq, raw: input };
    }

    // Control characters
    if (input.charCodeAt(0) < 32) {
      const controlMap: Record<number, string> = {
        8: 'backspace',
        9: 'tab',
        10: 'enter',
        13: 'enter',
        27: 'escape',
        127: 'delete',
      };

      const key =
        controlMap[input.charCodeAt(0)] ??
        `ctrl+${String.fromCharCode(input.charCodeAt(0) + 96)}`;
      return { type: 'key', key, raw: input };
    }

    // Regular characters
    return { type: 'key', key: input, raw: input };
  }

  private handleError(error: Error): void {
    this.emit('error', error);
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  public start(): void {
    if (this.running) return;

    this.running = true;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.emit('start');

    this.scheduleNextFrame();
  }

  public stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }

    this.emit('stop');
    this.cleanup();
  }

  private scheduleNextFrame(): void {
    if (!this.running) return;

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;
    const delay = Math.max(0, this.frameInterval - elapsed);

    this.loopTimer = setTimeout(() => {
      this.executeFrame();
      this.scheduleNextFrame();
    }, delay);
  }

  private executeFrame(): void {
    const frameStart = performance.now();

    try {
      this.emit('beforeRender');

      if (this.renderCallback) {
        this.renderCallback();
      }

      this.emit('afterRender');

      this.frameCount++;
      this.updatePerformanceMetrics(frameStart);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  private updatePerformanceMetrics(frameStart: number): void {
    const frameEnd = performance.now();
    const frameTime = frameEnd - frameStart;
    const timeSinceLastFrame = frameEnd - this.lastFrameTime;

    this.performanceMetrics.totalFrames++;
    this.performanceMetrics.totalRenderTime += frameTime;
    this.performanceMetrics.averageFrameTime =
      this.performanceMetrics.totalRenderTime /
      this.performanceMetrics.totalFrames;

    if (frameTime > this.performanceMetrics.maxFrameTime) {
      this.performanceMetrics.maxFrameTime = frameTime;
    }

    if (frameTime < this.performanceMetrics.minFrameTime) {
      this.performanceMetrics.minFrameTime = frameTime;
    }

    // Check for dropped frames
    if (timeSinceLastFrame > this.frameInterval * 1.5) {
      this.performanceMetrics.droppedFrames++;
    }

    // Calculate actual FPS
    this.actualFPS = 1000 / timeSinceLastFrame;
    this.lastFrameTime = frameEnd;
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }

  public setRenderCallback(callback: () => void): void {
    this.renderCallback = callback;
  }

  public setInputCallback(callback: (input: Buffer) => void): void {
    this.inputCallback = callback;
  }

  public setResizeCallback(
    callback: (width: number, height: number) => void
  ): void {
    this.resizeCallback = callback;
  }

  public setErrorCallback(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  public getState(): LoopState {
    return {
      running: this.running,
      frameCount: this.frameCount,
      lastFrameTime: this.lastFrameTime,
      targetFPS: this.targetFPS,
      actualFPS: this.actualFPS,
    };
  }

  public getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  public setTargetFPS(fps: number): void {
    this.targetFPS = Math.max(1, Math.min(120, fps));
    this.frameInterval = 1000 / this.targetFPS;
  }

  public on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          this.handleError(error as Error);
        }
      });
    }
  }
}

export interface InputEvent {
  type: 'key' | 'mouse' | 'escape';
  key?: string;
  sequence?: string;
  raw: string;
  x?: number;
  y?: number;
  button?: number;
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
  };
}
