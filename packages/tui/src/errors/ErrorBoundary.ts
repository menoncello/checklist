import { ErrorBoundaryCheckpointManager } from './ErrorBoundaryCheckpointManager';
import { ErrorBoundaryEventManager } from './ErrorBoundaryEventManager';
import {
  ErrorBoundaryConfig,
  ErrorBoundaryMetrics,
  ErrorHistoryEntry,
  ErrorHistoryManager,
  ErrorInfo,
  ErrorState,
  ErrorStateManager,
  StatePreservationManager,
} from './ErrorBoundaryHelpers';
import { ErrorBoundaryMetricsCollector } from './ErrorBoundaryMetricsCollector';
import { ErrorBoundaryOperations } from './ErrorBoundaryOperations';
import { ErrorBoundaryRenderer } from './ErrorBoundaryRenderer';
import { ErrorBoundaryRetryManager } from './ErrorBoundaryRetryManager';
import { ErrorBoundaryStateHandler } from './ErrorBoundaryStateHandler';
import { ErrorBoundaryWrapper } from './ErrorBoundaryWrapper';
import { ErrorBoundaryCheckpointAPI } from './helpers/ErrorBoundaryCheckpointAPI';
import { ErrorBoundaryConfigurationAPI } from './helpers/ErrorBoundaryConfigurationAPI';
import { ErrorBoundaryErrorHandler } from './helpers/ErrorBoundaryErrorHandler';
import { ErrorBoundaryOperationAPI } from './helpers/ErrorBoundaryOperationAPI';
import { ErrorBoundaryPublicAPI } from './helpers/ErrorBoundaryPublicAPI';

export type {
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
  private publicAPI!: ErrorBoundaryPublicAPI;
  private checkpointAPI!: ErrorBoundaryCheckpointAPI;
  private configurationAPI!: ErrorBoundaryConfigurationAPI;
  private operationAPI!: ErrorBoundaryOperationAPI;
  private errorHandler!: ErrorBoundaryErrorHandler;

  constructor(config: Partial<ErrorBoundaryConfig> = {}) {
    this.initializeConfig(config);
    this.initializeManagers();
    this.initializeHandlers();
  }

  private attemptRetry(): void {
    this.errorHandler.handleRetry();
  }

  private initializeConfig(config: Partial<ErrorBoundaryConfig>): void {
    const renderer = new ErrorBoundaryRenderer();
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      logErrors: true,
      fallbackRenderer: (error: Error, errorInfo: Record<string, unknown>) =>
        renderer.renderError(error, errorInfo),
      enableStatePreservation: true,
      ...config,
    };
  }

  private initializeManagers(): void {
    this.stateManager = new ErrorStateManager();
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
    this.initializeCoreHandlers();
    this.initializeAPIHandlers();
  }

  private initializeCoreHandlers(): void {
    this.wrapper = new ErrorBoundaryWrapper(
      (error: Error, errorInfo: ErrorInfo) => this.handleError(error, errorInfo)
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

  private initializeAPIHandlers(): void {
    this.publicAPI = new ErrorBoundaryPublicAPI(
      {
        stateManager: this.stateManager,
        historyManager: this.historyManager,
        preservationManager: this.preservationManager,
        checkpointManager: this.checkpointManager,
        eventManager: this.eventManager,
        metricsCollector: this.metricsCollector,
        operations: this.operations,
        stateHandler: this.stateHandler,
      },
      this.config
    );
    this.checkpointAPI = new ErrorBoundaryCheckpointAPI(
      this.checkpointManager,
      this.stateManager,
      this.stateHandler,
      this.eventManager
    );
    this.initializeConfigAndOperationAPIs();
  }

  private initializeConfigAndOperationAPIs(): void {
    this.initializeConfigurationAPI();
    this.initializeOperationAndErrorAPIs();
  }

  private initializeConfigurationAPI(): void {
    this.configurationAPI = new ErrorBoundaryConfigurationAPI(this.config, {
      stateManager: this.stateManager,
      historyManager: this.historyManager,
      preservationManager: this.preservationManager,
      retryManager: this.retryManager,
      operations: this.operations,
      stateHandler: this.stateHandler,
    });
  }

  private initializeOperationAndErrorAPIs(): void {
    this.operationAPI = new ErrorBoundaryOperationAPI(
      this.config,
      {
        wrapper: this.wrapper,
        retryManager: this.retryManager,
        eventManager: this.eventManager,
      },
      (config) => new ErrorBoundary(config)
    );
    this.errorHandler = new ErrorBoundaryErrorHandler(this.config, {
      stateHandler: this.stateHandler,
      operations: this.operations,
      retryManager: this.retryManager,
      eventManager: this.eventManager,
    });
  }

  public wrap<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return this.operationAPI.wrap(fn);
  }

  public async wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T
  ): Promise<T> {
    return this.operationAPI.wrapAsync(fn);
  }

  public handleError(error: Error, errorInfo: ErrorInfo = {}): void {
    this.errorHandler.handleError(error, errorInfo);
  }

  public retry(): boolean {
    return this.errorHandler.retry();
  }

  public clearError(): void {
    this.errorHandler.clearError();
  }

  public render(): string {
    const state = this.stateHandler.getState();
    if (state.hasError !== true || state.error == null) {
      return '';
    }
    const renderer = this.config.fallbackRenderer;
    if (renderer !== undefined && renderer !== null) {
      if (typeof renderer === 'function') {
        return renderer(state.error, state.errorInfo ?? {});
      } else if (typeof renderer === 'object' && 'renderError' in renderer) {
        const renderableRenderer = renderer as {
          renderError: (error: Error, errorInfo: unknown) => string;
        };
        return renderableRenderer.renderError(
          state.error,
          state.errorInfo ?? {}
        );
      }
    }
    return `Error: ${state.error.message}`;
  }

  public getFallbackUI(): string {
    return this.render();
  }

  public async retryOperation<T>(
    operation: () => T,
    maxRetries: number,
    delay: number
  ): Promise<T> {
    return this.operationAPI.retryOperation(operation, maxRetries, delay);
  }

  public runWithBoundary(fn: () => void): void {
    this.operationAPI.runWithBoundary(fn);
  }

  public async runAsyncWithBoundary(fn: () => Promise<void>): Promise<void> {
    return this.operationAPI.runAsyncWithBoundary(fn);
  }

  public createComponentBoundary(name: string): ErrorBoundary {
    return this.operationAPI.createComponentBoundary(
      name
    ) as unknown as ErrorBoundary;
  }

  public preserveCurrentState(): void {
    this.publicAPI.preserveCurrentState();
  }

  public restorePreservedState(): void {
    this.publicAPI.restorePreservedState();
  }

  public preserveState(key: string, value: unknown): void {
    this.publicAPI.preserveState(key, value);
  }

  public getPreservedState<T>(key: string): T | null {
    return this.publicAPI.getPreservedState<T>(key);
  }

  public clearPreservedState(key?: string): void {
    this.publicAPI.clearPreservedState(key);
  }

  public createCheckpoint(): string {
    return this.checkpointAPI.createCheckpoint();
  }

  public restoreFromCheckpoint(checkpointId: string): boolean {
    return this.checkpointAPI.restoreFromCheckpoint(checkpointId);
  }

  // Getter methods - delegated to public API
  public hasError(): boolean {
    return this.publicAPI.hasError();
  }

  public getError(): Error | null {
    return this.publicAPI.getError();
  }

  public getErrorInfo(): ErrorInfo | null {
    return this.publicAPI.getErrorInfo();
  }

  public getErrorState(): ErrorState {
    return this.publicAPI.getErrorState();
  }

  public canRetry(): boolean {
    return this.publicAPI.canRetry();
  }

  public getRemainingRetries(): number {
    return this.publicAPI.getRemainingRetries();
  }

  // History methods - delegated to public API
  public getErrorHistory(): ErrorHistoryEntry[] {
    return this.publicAPI.getErrorHistory();
  }

  public getRecentErrors(limit: number = 10): ErrorHistoryEntry[] {
    return this.publicAPI.getRecentErrors(limit);
  }

  public getErrorFrequency(): number {
    return this.publicAPI.getErrorFrequency();
  }

  public getMetrics(): ErrorBoundaryMetrics {
    return this.publicAPI.getMetrics();
  }

  // Configuration and reset methods
  public updateConfig(newConfig: Partial<ErrorBoundaryConfig>): void {
    this.configurationAPI.updateConfig(newConfig);
  }

  public getConfig(): ErrorBoundaryConfig {
    return this.publicAPI.getConfig();
  }

  public reset(): void {
    this.configurationAPI.reset();
  }

  public resetRetryCount(): void {
    this.publicAPI.resetRetryCount();
  }

  public getState(): ErrorState {
    return this.publicAPI.getState();
  }

  public destroy(): void {
    this.configurationAPI.destroy();
    this.eventManager.clear();
  }

  public onError(handler: (error: Error, errorInfo: ErrorInfo) => void): void {
    this.publicAPI.onError(handler);
  }

  public on(event: string, handler: Function): void {
    this.publicAPI.on(event, handler);
  }

  public off(event: string, handler: Function): void {
    this.publicAPI.off(event, handler);
  }
}
