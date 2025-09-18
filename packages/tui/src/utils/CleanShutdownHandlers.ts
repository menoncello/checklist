import { ShutdownState } from '../shutdown/types';

export class ShutdownStateManager {
  private state: ShutdownState;

  constructor() {
    this.state = {
      initiated: false,
      graceful: false,
      startTime: 0,
      completedTasks: [],
      failedTasks: [],
      phase: 'idle',
    };
  }

  public initiate(_reason: string): void {
    this.state.initiated = true;
    this.state.startTime = Date.now();
    this.state.phase = 'graceful';
    this.state.graceful = true;
  }

  public setForceMode(): void {
    this.state.graceful = false;
    this.state.phase = 'forced';
  }

  public isInitiated(): boolean {
    return this.state.initiated;
  }

  public isGraceful(): boolean {
    return this.state.graceful;
  }

  public getState(): ShutdownState {
    return { ...this.state };
  }

  public addCompletedTask(taskId: string): void {
    this.state.completedTasks.push(taskId);
  }

  public addFailedTask(taskId: string): void {
    this.state.failedTasks.push(taskId);
  }

  public getMetrics(): {
    duration: number;
    completed: number;
    failed: number;
  } {
    return {
      duration: Date.now() - this.state.startTime,
      completed: this.state.completedTasks.length,
      failed: this.state.failedTasks.length,
    };
  }

  public setPhase(phase: 'idle' | 'graceful' | 'forced' | 'complete'): void {
    this.state.phase = phase;
  }
}

export class ShutdownLogger {
  constructor(
    private enabled: boolean,
    private logCallback?: (message: string) => void
  ) {}

  public log(message: string): void {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [SHUTDOWN] ${message}`;

    if (this.logCallback != null) {
      this.logCallback(formattedMessage);
    } else if (typeof console !== 'undefined' && console.log != null) {
      console.log(formattedMessage);
    }
  }

  public logCompletion(
    graceful: boolean,
    metrics: {
      duration: number;
      completed: number;
      failed: number;
      total: number;
    }
  ): void {
    this.log(
      `Shutdown ${graceful ? 'completed gracefully' : 'forced'} in ${metrics.duration}ms`
    );
    this.log(
      `Tasks: ${metrics.completed}/${metrics.total} completed, ${metrics.failed} failed`
    );
  }
}

export class ShutdownPromiseManager {
  private shutdownPromise: Promise<void> | null = null;
  private resolveShutdown: (() => void) | null = null;

  public setupPromise(): void {
    this.shutdownPromise = new Promise<void>((resolve) => {
      this.resolveShutdown = resolve;
    });
  }

  public getPromise(): Promise<void> | null {
    return this.shutdownPromise;
  }

  public resolve(): void {
    if (this.resolveShutdown != null) {
      this.resolveShutdown();
      this.resolveShutdown = null;
    }
  }

  public isActive(): boolean {
    return this.shutdownPromise != null;
  }
}
