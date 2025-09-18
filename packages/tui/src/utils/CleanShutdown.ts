import {
  ShutdownTask,
  ShutdownConfig,
  ShutdownState,
  EventHandler,
} from '../shutdown/types';
import {
  ShutdownCore,
  ShutdownMetricsCalculator,
  ShutdownCompletionHandler,
  ShutdownSequenceManager,
} from './CleanShutdownCore';
import {
  ShutdownTimerManager,
  EventBus,
  SignalHandlerSetup,
} from './CleanShutdownHelpers';

export class CleanShutdown {
  private config: ShutdownConfig;
  private state: ShutdownState;
  private core!: ShutdownCore;
  private eventBus = new EventBus();
  private timerManager = new ShutdownTimerManager();
  private shutdownPromise: Promise<void> | null = null;
  private resolveShutdown: (() => void) | null = null;
  private completionHandler!: ShutdownCompletionHandler;
  private sequenceManager!: ShutdownSequenceManager;

  constructor(config: Partial<ShutdownConfig> = {}) {
    this.config = {
      gracefulTimeout: 30000,
      forceTimeout: 5000,
      enableLogging: true,
      saveState: true,
      ...config,
    };

    this.state = {
      initiated: false,
      graceful: false,
      startTime: 0,
      completedTasks: [],
      failedTasks: [],
      phase: 'idle',
    };

    this.initializeComponents();
    this.setupHandlers();
  }

  private initializeComponents(): void {
    this.core = new ShutdownCore(
      this.config,
      this.state,
      (msg) => this.log(msg),
      (event, data) => this.emit(event, data)
    );

    this.completionHandler = new ShutdownCompletionHandler(
      this.config,
      (msg) => this.log(msg),
      (event, data) => this.emit(event, data)
    );

    this.sequenceManager = new ShutdownSequenceManager(
      this.state,
      this.core,
      (msg) => this.log(msg),
      (event, data) => this.emit(event, data)
    );
  }

  private setupHandlers(): void {
    this.setupSignalHandlers();
    this.core.setupDefaultTasks();
    this.setupExecutorListeners();
  }

  private setupSignalHandlers(): void {
    SignalHandlerSetup.setup({
      onSigterm: () => {
        this.log('Received SIGTERM');
        this.initiate('SIGTERM');
      },
      onSigint: () => {
        this.log('Received SIGINT');
        this.initiate('SIGINT');
      },
      onSigkill: () => {
        this.log('Received SIGKILL');
        this.forceShutdown();
      },
      onUncaught: (error) => {
        if (this.state.initiated) {
          this.log(`Uncaught exception: ${error.message}`);
          this.forceShutdown();
        }
      },
      onUnhandled: (reason) => {
        if (this.state.initiated) {
          this.log(`Unhandled rejection: ${reason}`);
        }
      },
    });
  }

  private setupExecutorListeners(): void {
    this.on('requestForcedShutdown', () => this.forceShutdown());
  }

  public addTask(task: ShutdownTask): void {
    if (this.state.initiated) {
      throw new Error('Cannot add tasks after shutdown initiated');
    }
    this.core.addTask(task);
  }

  public removeTask(id: string): boolean {
    if (this.state.initiated) {
      throw new Error('Cannot remove tasks after shutdown initiated');
    }
    return this.core.removeTask(id);
  }

  public async initiate(reason: string = 'manual'): Promise<void> {
    if (this.state.initiated) {
      return this.shutdownPromise ?? Promise.resolve();
    }

    this.state.initiated = true;
    this.state.startTime = Date.now();
    this.state.phase = 'graceful';
    this.state.graceful = true;

    this.log(`Shutdown initiated: ${reason}`);
    this.executeStartCallback();

    this.shutdownPromise = new Promise<void>((resolve) => {
      this.resolveShutdown = resolve;
    });

    this.setupTimers();

    await this.sequenceManager.executeSequence();
    this.completeShutdown(true);

    return this.shutdownPromise;
  }

  private setupTimers(): void {
    this.timerManager.setupGracefulTimer(this.config.gracefulTimeout, () => {
      this.log(`Graceful timeout exceeded`);
      this.forceShutdown();
    });
    this.timerManager.setupForceTimer(
      this.config.gracefulTimeout,
      this.config.forceTimeout,
      () => {
        this.log('Force timeout exceeded');
        process.exit(1);
      }
    );
  }

  public async forceShutdown(): Promise<void> {
    if (this.state.phase === 'forced' || this.state.phase === 'complete') {
      return;
    }

    this.log('Forcing shutdown');
    await this.sequenceManager.executeForce();
    this.completeShutdown(false);
  }

  private completeShutdown(graceful: boolean): void {
    const metrics = ShutdownMetricsCalculator.calculate(
      this.state,
      this.core.getTasks().length
    );

    this.completionHandler.handleCompletion(graceful, metrics);
    this.cleanup();

    if (this.resolveShutdown !== null) {
      this.resolveShutdown();
    }

    setTimeout(() => process.exit(graceful ? 0 : 1), 100);
  }

  private cleanup(): void {
    this.timerManager.clearTimers();
    this.core.clearAllTimeouts();
  }

  private executeStartCallback(): void {
    if (this.config.onShutdownStart) {
      try {
        this.config.onShutdownStart();
      } catch (error) {
        this.log(`Error in start callback: ${(error as Error).message}`);
      }
    }
  }

  private log(message: string): void {
    if (!this.config.enableLogging) return;
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [SHUTDOWN] ${message}`;
    if (typeof console !== 'undefined') {
      console.log(formatted);
    }
  }

  public on(event: string, handler: EventHandler): void {
    this.eventBus.on(event, handler);
  }
  public off(event: string, handler: EventHandler): void {
    this.eventBus.off(event, handler);
  }
  public once(event: string, handler: EventHandler): void {
    this.eventBus.once(event, handler);
  }
  private emit(event: string, data?: unknown): void {
    this.eventBus.emit(event, data);
  }

  public isShuttingDown(): boolean {
    return this.state.initiated;
  }
  public getState(): ShutdownState {
    return { ...this.state };
  }
  public getMetrics() {
    return ShutdownMetricsCalculator.calculate(
      this.state,
      this.core.getTasks().length
    );
  }
}
