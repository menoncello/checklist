import { ErrorBoundaryCheckpointManager } from './ErrorBoundaryCheckpointManager';
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
  private config: ErrorBoundaryConfig;
  private stateManager: ErrorStateManager;
  private historyManager: ErrorHistoryManager;
  private preservationManager: StatePreservationManager;
  private retryManager: ErrorBoundaryRetryManager;
  private checkpointManager: ErrorBoundaryCheckpointManager;
  private eventManager: ErrorBoundaryEventManager;
  private wrapper: ErrorBoundaryWrapper;
  private metricsCollector: ErrorBoundaryMetricsCollector;
  private operations: ErrorBoundaryOperations;
  private stateHandler: ErrorBoundaryStateHandler;

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
      fallbackRenderer: ErrorBoundaryRenderer.defaultFallbackRenderer,
      enableStatePreservation: true,
      ...config,
    };
  }

  private initializeManagers(): void {
    this.stateManager = new ErrorStateManager(this.config.maxRetries);
    this.historyManager = new ErrorHistoryManager();
    this.preservationManager = new StatePreservationManager();
    this.eventManager = new ErrorBoundaryEventManager();
    this.checkpointManager = new ErrorBoundaryCheckpointManager(
      this.preservationManager
    );
    this.retryManager = new ErrorBoundaryRetryManager(() =>
      this.attemptRetry()
    );
  }

  private initializeHandlers(): void {
    this.wrapper = new ErrorBoundaryWrapper((error, errorInfo) =>
      this.handleError(error, errorInfo)
    );
    this.metricsCollector = new ErrorBoundaryMetricsCollector(
      this.historyManager,
      this.preservationManager
    );
    this.operations = new ErrorBoundaryOperations(this.config);
    this.stateHandler = new ErrorBoundaryStateHandler(
      this.stateManager,
      this.historyManager,
      this.preservationManager,
      this.config.enableStatePreservation
    );
  }

  public wrap<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return this.wrapper.wrap(fn);
  }

  public async wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T
  ): Promise<T> {
    return this.wrapper.wrapAsync(fn);
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
    this.stateHandler.updateErrorState(params);
  }

  private recordError(params: ErrorRecordParams): void {
    this.stateHandler.recordError(params);
  }

  private performErrorHandlingTasks(error: Error, errorInfo: ErrorInfo): void {
    this.operations.logError(
      error,
      errorInfo,
      this.stateHandler.getRetryCount()
    );
    this.stateHandler.preserveCurrentState();
    this.operations.executeErrorCallback(error, errorInfo);
  }

  private handleRetryLogic(error: Error, errorInfo: ErrorInfo): void {
    if (this.operations.canRetry(this.stateHandler.getRetryCount())) {
      this.retryManager.scheduleRetry(this.config.retryDelay);
    } else {
      this.eventManager.emit('errorBoundaryExhausted', { error, errorInfo });
    }
  }

  private attemptRetry(): void {
    this.stateHandler.incrementRetryCount();

    this.operations.executeRetryCallback(
      this.stateHandler.getRetryCount(),
      this.config.maxRetries
    );

    this.eventManager.emit('retry', {
      attempt: this.stateHandler.getRetryCount(),
      maxRetries: this.config.maxRetries,
    });

    const restoredState = this.stateHandler.restorePreservedState();
    if (restoredState) {
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
    const hadError = this.stateHandler.reset(this.config.maxRetries);

    if (hadError) {
      this.operations.executeRecoveryCallback();
      this.eventManager.emit('recovery');
    }
  }

  public render(): string {
    const state = this.stateHandler.getState();
    if (!state.hasError || !state.error) {
      return '';
    }
    return ErrorBoundaryRenderer.renderError(
      state.error,
      state.errorInfo ?? {},
      this.config.fallbackRenderer
    );
  }

  public getFallbackUI(): string {
    return this.render();
  }

  public async retryOperation<T>(
    operation: () => T,
    maxRetries: number,
    delay: number
  ): Promise<T> {
    return this.retryManager.retryOperation(operation, maxRetries, delay);
  }

  public runWithBoundary(fn: () => void): void {
    this.wrapper.runWithBoundary(fn);
  }

  public async runAsyncWithBoundary(fn: () => Promise<void>): Promise<void> {
    return this.wrapper.runAsyncWithBoundary(fn);
  }

  public createComponentBoundary(name: string): ErrorBoundary {
    const boundary = new ErrorBoundary({ ...this.config });
    boundary.on('error', (data: { error: Error; errorInfo: ErrorInfo }) => {
      this.eventManager.emit('componentError', {
        component: name,
        ...data,
      });
    });
    return boundary;
  }

  public preserveCurrentState(): void {
    this.stateHandler.preserveCurrentState();
  }

  public restorePreservedState(): void {
    const restoredState = this.stateHandler.restorePreservedState();
    if (restoredState) {
      this.eventManager.emit('stateRestored', restoredState);
    }
  }

  // State preservation - delegated to preservation manager
  public preserveState(key: string, value: unknown): void {
    this.preservationManager.preserveState(key, value);
  }

  public getPreservedState<T>(key: string): T | null {
    return this.preservationManager.getPreservedState<T>(key);
  }

  public clearPreservedState(key?: string): void {
    this.preservationManager.clearPreservedState(key);
  }

  public createCheckpoint(): string {
    return this.checkpointManager.createCheckpoint(
      this.stateHandler.getState()
    );
  }

  public restoreFromCheckpoint(checkpointId: string): boolean {
    const checkpoint =
      this.checkpointManager.restoreFromCheckpoint(checkpointId);

    if (checkpoint) {
      const params: ErrorUpdateParams = {
        error: checkpoint.state.error || new Error('Unknown error'),
        errorInfo: checkpoint.state.errorInfo || {},
        errorId: checkpoint.state.errorId,
        timestamp: checkpoint.state.timestamp,
      };

      this.stateManager.reset(checkpoint.state.maxRetries);
      if (checkpoint.state.hasError) {
        this.stateManager.updateState(params);
      }

      this.eventManager.emit('checkpointRestored', { checkpointId });
      return true;
    }

    return false;
  }

  // Getter methods - delegated to state handler
  public hasError(): boolean {
    return this.stateHandler.hasError();
  }

  public getError(): Error | null {
    return this.stateManager.getError();
  }

  public getErrorInfo(): ErrorInfo | null {
    return this.stateManager.getErrorInfo();
  }

  public getErrorState(): ErrorState {
    return this.stateHandler.getState();
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
    return this.metricsCollector.collectMetrics(
      this.stateHandler.getState(),
      this.config.maxRetries
    );
  }

  // Configuration and reset methods
  public updateConfig(newConfig: Partial<ErrorBoundaryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.stateManager.setMaxRetries(this.config.maxRetries);
    this.operations.updateConfig(this.config);
    this.stateHandler.updateStatePreservationConfig(
      this.config.enableStatePreservation
    );
  }

  public getConfig(): ErrorBoundaryConfig {
    return { ...this.config };
  }

  public reset(): void {
    this.stateManager.reset(this.config.maxRetries);
    this.historyManager.clear();
    this.preservationManager.clear();
  }

  public resetRetryCount(): void {
    this.stateManager.resetRetryCount();
  }

  public getState(): ErrorState {
    return this.stateHandler.getState();
  }

  public destroy(): void {
    this.retryManager.destroy();
    this.eventManager.clear();
    this.preservationManager.clear();
    this.historyManager.clear();
    this.stateManager.reset(this.config.maxRetries);
  }

  public onError(handler: (error: Error, errorInfo: ErrorInfo) => void): void {
    this.eventManager.on(
      'error',
      ({ error, errorInfo }: { error: Error; errorInfo: ErrorInfo }) =>
        handler(error, errorInfo)
    );
  }

  public on(event: string, handler: Function): void {
    this.eventManager.on(event, handler);
  }

  public off(event: string, handler: Function): void {
    this.eventManager.off(event, handler);
  }
}