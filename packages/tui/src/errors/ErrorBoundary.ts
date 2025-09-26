import { ErrorBoundaryCheckpointManager } from './ErrorBoundaryCheckpointManager';
import { ErrorBoundaryCore } from './ErrorBoundaryCore';
import { ErrorBoundaryEventManager } from './ErrorBoundaryEventManager';
import {
  ErrorBoundaryConfig,
  ErrorBoundaryMetrics,
  ErrorHistoryEntry,
  ErrorHistoryManager,
  ErrorInfo,
  ErrorRecordParams,
  ErrorState,
  ErrorStateManager,
  ErrorUpdateParams,
  StatePreservationManager,
} from './ErrorBoundaryHelpers';
import { ErrorBoundaryMetricsCollector } from './ErrorBoundaryMetricsCollector';
import { ErrorBoundaryOperations } from './ErrorBoundaryOperations';
import { ErrorBoundaryRenderer } from './ErrorBoundaryRenderer';
import { ErrorBoundaryRetryManager } from './ErrorBoundaryRetryManager';
import { ErrorBoundaryStateHandler } from './ErrorBoundaryStateHandler';
import { ErrorBoundaryUtils } from './ErrorBoundaryUtils';
import { ErrorBoundaryWrapper } from './ErrorBoundaryWrapper';

export {
  ErrorBoundaryConfig,
  ErrorBoundaryMetrics,
  ErrorHistoryEntry,
  ErrorInfo,
  ErrorState,
} from './ErrorBoundaryHelpers';

export class ErrorBoundary {
  private config!: ErrorBoundaryConfig;
  private stateManager!: ErrorStateManager;
  private historyManager!: ErrorHistoryManager;
  private preservationManager!: StatePreservationManager;
  private retryManager!: ErrorBoundaryRetryManager;
  private checkpointManager!: ErrorBoundaryCheckpointManager;
  private eventManager!: ErrorBoundaryEventManager;
  private wrapper!: ErrorBoundaryWrapper;
  private metricsCollector!: ErrorBoundaryMetricsCollector;
  private operations!: ErrorBoundaryOperations;
  private stateHandler!: ErrorBoundaryStateHandler;
  private core!: ErrorBoundaryCore;

  constructor(config: Partial<ErrorBoundaryConfig> = {}) {
    this.initializeConfig(config);
    this.initializeManagers();
    this.initializeHandlers();
  }

  private initializeConfig(config: Partial<ErrorBoundaryConfig>): void {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      logErrors: true,
      fallbackRenderer: new ErrorBoundaryRenderer(),
      enableStatePreservation: true,
      ...config,
    };
  }

  private initializeManagers(): void {
    this.stateManager = new ErrorStateManager();
    this.historyManager = new ErrorHistoryManager();
    this.preservationManager = new StatePreservationManager();
    this.eventManager = new ErrorBoundaryEventManager();
    this.checkpointManager = new ErrorBoundaryCheckpointManager();
    this.retryManager = new ErrorBoundaryRetryManager();
  }

  private initializeHandlers(): void {
    this.wrapper = new ErrorBoundaryWrapper();
    this.metricsCollector = new ErrorBoundaryMetricsCollector();
    this.operations = new ErrorBoundaryOperations();
    this.stateHandler = new ErrorBoundaryStateHandler();
    this.core = new ErrorBoundaryCore(this.config, {
      stateHandler: this.stateHandler,
      operations: this.operations,
      retryManager: this.retryManager,
      eventManager: this.eventManager,
      metricsCollector: this.metricsCollector,
      checkpointManager: this.checkpointManager,
      statePreservation: this.preservationManager,
    });
  }

  public wrap<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return ErrorBoundaryWrapper.wrap(fn, (error, errorInfo) =>
      this.handleError(error, errorInfo)
    );
  }

  public async wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T
  ): Promise<T> {
    return ErrorBoundaryWrapper.wrapAsync(fn, (error, errorInfo) =>
      this.handleError(error, errorInfo)
    );
  }

  public handleError(error: Error, errorInfo: ErrorInfo = {}): void {
    const errorId = ErrorBoundaryUtils.generateErrorId();
    const timestamp = Date.now();
    const params = { error, errorInfo, errorId, timestamp };

    this.updateErrorState(params);
    this.recordError(params);
    this.performErrorHandlingTasks(error, errorInfo);
    this.eventManager.emit('error', { error, errorInfo, errorId, timestamp });
    this.handleRetryLogic(error, errorInfo);
  }

  private updateErrorState(params: ErrorUpdateParams): void {
    this.stateHandler.updateErrorState(params.error ?? new Error('Unknown error'), params.errorInfo);
  }

  private recordError(params: ErrorRecordParams): void {
    this.stateHandler.recordError(params.error, params.errorInfo);
  }

  private performErrorHandlingTasks(error: Error, errorInfo: ErrorInfo): void {
    this.operations.logError(
      error,
      errorInfo,
      this.stateHandler.getRetryCount(),
      this.config.maxRetries ?? 3
    );
    this.stateHandler.preserveCurrentState();
    this.operations.executeErrorCallback(error, errorInfo);
  }

  private handleRetryLogic(error: Error, errorInfo: ErrorInfo): void {
    if (this.operations.canRetry?.(this.stateHandler.getRetryCount()) === true) {
      this.retryManager.scheduleRetry(this.config.retryDelay ?? 1000);
    } else {
      this.eventManager.emit('errorBoundaryExhausted', { error, errorInfo });
    }
  }

  private attemptRetry(): void {
    this.stateHandler.incrementRetryCount();

    this.operations.executeRetryCallback(
      this.stateHandler.getRetryCount(),
      this.config.maxRetries ?? 3
    );

    this.eventManager.emit('retry', {
      attempt: this.stateHandler.getRetryCount(),
      maxRetries: this.config.maxRetries,
    });

    const restoredState = this.stateHandler.restorePreservedState();
    if (restoredState !== null && restoredState !== undefined) {
      this.eventManager.emit('stateRestored', restoredState);
    }

    this.clearError();
  }

  public retry(): boolean {
    if (!this.canRetry()) {
      return false;
    }
    this.attemptRetry();
    return true;
  }

  public clearError(): void {
    this.retryManager.cancelRetry();
    this.stateHandler.reset();
    const hadError = this.stateHandler.hasError();

    if (hadError === true) {
      this.operations.executeRecoveryCallback();
      this.eventManager.emit('recovery');
    }
  }

  public render(): string {
    const state = this.stateHandler.getState();
    if (!state.hasError || !state.error) {
      return '';
    }
    const renderer = this.config.fallbackRenderer;
    if (renderer !== undefined && renderer !== null && typeof renderer === 'object' && 'renderError' in renderer) {
      const renderableRenderer = renderer as { renderError: (error: Error, errorInfo: unknown) => string };
      return renderableRenderer.renderError(state.error, state.errorInfo ?? {});
    }
    return `Error: ${state.error.message}`;
  }

  public getFallbackUI(): string {
    return this.render();
  }

  public async retryOperation<T>(
    operation: () => T,
    _maxRetries: number,
    _delay: number
  ): Promise<T> {
    return this.retryManager.retryOperation(() => operation());
  }

  public runWithBoundary(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.handleError(error as Error, {});
      throw error;
    }
  }

  public async runAsyncWithBoundary(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.handleError(error as Error, {});
      throw error;
    }
  }

  public createComponentBoundary(name: string): ErrorBoundary {
    const boundary = new ErrorBoundary({ ...this.config });
    boundary.on('error', (data: unknown) => {
      const errorData = data as { error: Error; errorInfo: ErrorInfo };
      this.eventManager.emit('componentError', {
        component: name,
        ...errorData,
      });
    });
    return boundary;
  }

  public preserveCurrentState(): void {
    this.stateHandler.preserveCurrentState();
  }

  // Delegated methods to core
  public restorePreservedState(): unknown {
    return this.core.restorePreservedState();
  }

  public preserveState(key: string, value: unknown): void {
    return this.core.preserveState(key, value);
  }

  public getPreservedState<T>(key: string): T | null {
    return this.core.getPreservedState<T>(key);
  }

  public clearPreservedState(key?: string): void {
    return this.core.clearPreservedState(key);
  }

  public createCheckpoint(): string {
    return this.core.createCheckpoint();
  }

  public restoreFromCheckpoint(checkpointId: string): boolean {
    return this.core.restoreFromCheckpoint(checkpointId);
  }

  public hasError(): boolean {
    return this.core.hasError();
  }

  public getErrorState(): ErrorState {
    return this.core.getErrorState();
  }

  public canRetry(): boolean {
    return this.operations.canRetry(this.stateHandler.getRetryCount());
  }

  public getRemainingRetries(): number {
    return this.operations.getRemainingRetries(
      this.stateHandler.getRetryCount()
    );
  }

  // History methods - delegated to history manager
  public getErrorHistory(): ErrorHistoryEntry[] {
    return this.historyManager.getHistory();
  }

  public getRecentErrors(limit: number = 10): ErrorHistoryEntry[] {
    return this.historyManager.getRecentErrors(limit);
  }

  public getErrorFrequency(): number {
    return this.historyManager.getErrorFrequency();
  }

  public getMetrics(): ErrorBoundaryMetrics {
    return this.metricsCollector.collectMetrics();
  }

  // Configuration and reset methods
  public updateConfig(newConfig: Partial<ErrorBoundaryConfig>): void {
    this.core.updateConfig(newConfig);
    this.stateManager.setMaxRetries(this.config.maxRetries ?? 3);
    this.operations.updateConfig(this.config);
  }

  public getConfig(): ErrorBoundaryConfig {
    return this.core.getConfig();
  }

  public reset(): void {
    this.core.reset();
    this.historyManager.clear();
  }

  public resetRetryCount(): void {
    this.stateManager.resetRetryCount();
  }

  public getState(): ErrorState {
    return this.core.getErrorState();
  }

  public destroy(): void {
    this.core.destroy();
    this.historyManager.clear();
  }

  public onError(handler: (error: Error, errorInfo: ErrorInfo) => void): void {
    this.eventManager.on(
      'error',
      ({ error, errorInfo }: { error: Error; errorInfo: ErrorInfo }) =>
        handler(error, errorInfo)
    );
  }

  public on(event: string, handler: (...args: unknown[]) => void): void {
    this.eventManager.on(event, handler);
  }

  public off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventManager.off(event, handler);
  }
}