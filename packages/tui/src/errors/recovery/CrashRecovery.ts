import { ProcessHandlers } from './ProcessHandlers';
import { StateManager } from './StateManager';
import { StrategyManager } from './StrategyManager';
import {
  CrashState,
  RecoveryStrategy,
  CrashRecoveryConfig,
  CrashRecoveryMetrics,
} from './types';

export class CrashRecovery {
  private config: CrashRecoveryConfig;
  private crashState: CrashState;
  private stateManager!: StateManager;
  private processHandlers!: ProcessHandlers;
  private strategyManager!: StrategyManager;
  private eventHandlers = new Map<string, Set<Function>>();
  private recoveryTimer: Timer | null = null;
  private criticalSections = new Set<string>();
  private startTime = Date.now();

  constructor(config: Partial<CrashRecoveryConfig> = {}) {
    this.config = this.mergeConfig(config);
    this.crashState = this.createInitialState();
    this.initializeManagers();
    this.setupCallbacks();
    this.setupEventHandling();
  }

  private mergeConfig(
    config: Partial<CrashRecoveryConfig>
  ): CrashRecoveryConfig {
    return {
      maxRecoveryAttempts: 3,
      recoveryDelay: 2000,
      enableAutoRecovery: true,
      gracefulShutdownTimeout: 5000,
      stateBackupInterval: 30000,
      enableStateBackups: true,
      disableProcessHandlers: false,
      ...config,
    };
  }

  private initializeManagers(): void {
    this.stateManager = new StateManager(
      this.config.stateBackupInterval,
      this.config.enableStateBackups
    );

    this.processHandlers = new ProcessHandlers(
      this.config.gracefulShutdownTimeout,
      this.config.disableProcessHandlers,
      (reason: string, error?: Error) => this.handleCrash(reason, error),
      this
    );

    this.strategyManager = new StrategyManager();
  }

  private setupCallbacks(): void {
    this.processHandlers.setOnSignalHandler(this.handleSignal.bind(this));

    this.processHandlers.setOnWarningHandler((warning: Error) => {
      this.emit('memoryWarning', { warning });
    });

    this.strategyManager.setOnStateRestored(() => {
      this.emit('stateRestored', {});
    });
  }

  private createInitialState(): CrashState {
    return {
      crashed: false,
      crashReason: '',
      crashTimestamp: 0,
      recoveryAttempts: 0,
      lastRecoveryAttempt: 0,
      canRecover: true,
      gracefulShutdownCompleted: false,
    };
  }

  private setupEventHandling(): void {
    // Add emergency handler for critical cleanup
    this.processHandlers.addEmergencyHandler(() => {
      this.performEmergencyCleanup();
    });
  }

  private performEmergencyCleanup(): void {
    try {
      if (this.config.enableStateBackups) {
        this.stateManager.backupState('emergency', {
          crashState: this.crashState,
          timestamp: Date.now(),
          criticalSections: Array.from(this.criticalSections),
        });
      }
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
    }
  }

  public handleCrash(reason: string, error?: Error): void {
    console.error('Application crash detected:', {
      reason,
      error: error?.message,
      timestamp: new Date().toISOString(),
    });

    // Only update crash state if not already crashed (prevent recursive handling)
    if (!this.crashState.crashed) {
      this.crashState = {
        ...this.crashState,
        crashed: true,
        crashReason: reason,
        crashTimestamp: Date.now(),
        canRecover: this.canAttemptRecovery(),
      };
    }

    this.emit('crash', { crashState: this.crashState, error });

    // Run emergency handlers on crash
    this.processHandlers.runEmergencyHandlers();

    if (this.config.onCrash) {
      try {
        this.config.onCrash(this.crashState);
      } catch (callbackError) {
        console.error('Error in crash callback:', callbackError);
      }
    }

    if (this.config.enableAutoRecovery && this.crashState.canRecover) {
      this.scheduleRecovery();
    }
  }

  private canAttemptRecovery(): boolean {
    return (
      this.crashState.recoveryAttempts < this.config.maxRecoveryAttempts &&
      !this.processHandlers.isShutdownInProgress() &&
      this.criticalSections.size === 0
    );
  }

  private scheduleRecovery(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    this.recoveryTimer = setTimeout(() => {
      this.attemptRecovery();
    }, this.config.recoveryDelay);
  }

  private async attemptRecovery(): Promise<void> {
    this.crashState.recoveryAttempts++;
    this.crashState.lastRecoveryAttempt = Date.now();

    console.log(
      `Attempting recovery (${this.crashState.recoveryAttempts}/${this.config.maxRecoveryAttempts})`
    );

    this.emit('recoveryAttempt', {
      attempt: this.crashState.recoveryAttempts,
      maxAttempts: this.config.maxRecoveryAttempts,
    });

    const success = await this.strategyManager.executeRecovery(this.crashState);

    if (success) {
      this.handleSuccessfulRecovery();
    } else {
      this.handleFailedRecovery();
    }
  }

  private handleSuccessfulRecovery(): void {
    console.log('Recovery successful');

    this.crashState = this.createInitialState();
    this.emit('recovery', { success: true });
    this.emit('recoverySuccess', { success: true });

    if (this.config.onRecovery) {
      this.config.onRecovery(true, this.crashState.recoveryAttempts);
    }
  }

  private handleFailedRecovery(): void {
    console.error('Recovery failed');

    this.emit('recoveryFailed', {
      attempts: this.crashState.recoveryAttempts,
      maxAttempts: this.config.maxRecoveryAttempts,
    });

    if (this.crashState.recoveryAttempts < this.config.maxRecoveryAttempts) {
      this.scheduleRecovery();
    } else {
      console.error('Maximum recovery attempts exceeded');
      this.emit('recoveryExhausted');
      this.processHandlers.forceShutdown(1);
    }

    if (this.config.onRecovery) {
      this.config.onRecovery(false, this.crashState.recoveryAttempts);
    }
  }

  public enterCriticalSection(name: string): void {
    this.criticalSections.add(name);
  }

  public exitCriticalSection(name: string): void {
    this.criticalSections.delete(name);
  }

  public isInCriticalSection(): boolean {
    return this.criticalSections.size > 0;
  }

  public addEmergencyHandler(handler: () => void): void {
    this.processHandlers.addEmergencyHandler(handler);
  }

  public removeEmergencyHandler(handler: () => void): void {
    this.processHandlers.removeEmergencyHandler(handler);
  }

  public addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.strategyManager.addStrategy(strategy);
  }

  public removeRecoveryStrategy(name: string): boolean {
    return this.strategyManager.removeStrategy(name);
  }

  public getCrashState(): CrashState {
    return { ...this.crashState };
  }

  public getRecoveryStrategies(): RecoveryStrategy[] {
    return this.strategyManager.getStrategies();
  }

  public getMetrics(): CrashRecoveryMetrics {
    const uptime = Date.now() - this.startTime;

    return {
      totalCrashes:
        this.crashState.recoveryAttempts + (this.crashState.crashed ? 1 : 0),
      totalRecoveries: this.crashState.recoveryAttempts,
      averageRecoveryTime: 0, // Would need to track recovery times
      lastCrashTime: this.crashState.crashed
        ? this.crashState.crashTimestamp
        : null,
      lastRecoveryTime: this.crashState.lastRecoveryAttempt || null,
      crashFrequency: 0, // Would need time-based tracking
      successfulRecoveryRate: 0, // Would need success/failure tracking
      currentCrashState: this.crashState,
      backupCount: this.stateManager.getBackupCount(),
      uptime,
    };
  }

  public createStateBackup(): void {
    this.stateManager.backupState('regular', {
      crashState: this.crashState,
      timestamp: Date.now(),
      criticalSections: Array.from(this.criticalSections),
    });
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
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
          console.error(`Error in crash recovery event handler:`, error);
        }
      });
    }
  }

  private shutdownInProgress = false;

  private handleSignal(signal: string): void {
    this.initiateGracefulShutdown(signal).catch((error) => {
      console.error('Error in graceful shutdown:', error);
    });
  }

  public async initiateGracefulShutdown(reason: string): Promise<void> {
    // Check if shutdown is already in progress to prevent multiple calls
    if (this.shutdownInProgress) {
      return;
    }

    this.shutdownInProgress = true;
    console.log(`Initiating graceful shutdown: ${reason}`);
    this.emit('gracefulShutdown', { reason });

    if (this.config.onGracefulShutdown) {
      try {
        await this.config.onGracefulShutdown();
      } catch (error) {
        console.error('Error in graceful shutdown callback:', error);
      }
    }

    // Mark graceful shutdown as completed
    this.crashState.gracefulShutdownCompleted = true;
  }

  public cleanup(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    this.stateManager.cleanup();
    this.processHandlers.cleanup();
    this.eventHandlers.clear();
    this.criticalSections.clear();
  }
}
