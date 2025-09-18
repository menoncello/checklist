import { ErrorBoundaryHandlers } from './ErrorBoundaryHandlers';
import { ErrorBoundaryMethods } from './ErrorBoundaryMethods';
import { ErrorBoundaryRecovery } from './ErrorBoundaryRecovery';
import { ErrorBoundaryState } from './ErrorBoundaryState';
import {
  ErrorInfo,
  ErrorState,
  ErrorHistoryEntry,
  ErrorBoundaryConfig,
  ErrorMetrics,
} from './ErrorBoundaryTypes';
import { ErrorBoundaryUtils } from './ErrorBoundaryUtils';
import { ErrorBoundaryWrapper } from './ErrorBoundaryWrapper';

export * from './ErrorBoundaryTypes';

export class ErrorBoundary {
  private config: ErrorBoundaryConfig;
  private state: ErrorState;
  private eventHandlers = new Map<string, Set<Function>>();
  private preservedState: Map<string, unknown> = new Map();
  private errorHistory: ErrorHistoryEntry[] = [];
  private maxHistorySize = 50;
  private retryTimer: Timer | null = null;
  private recovery: ErrorBoundaryRecovery;

  constructor(config: Partial<ErrorBoundaryConfig> = {}) {
    this.config = ErrorBoundaryUtils.mergeConfigs(
      ErrorBoundaryUtils.createDefaultConfig(),
      config
    );
    this.state = ErrorBoundaryUtils.createInitialState();
    this.state.maxRetries = this.config.maxRetries;
    this.recovery = new ErrorBoundaryRecovery();
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
    ErrorBoundaryHandlers.handleError({
      error,
      errorInfo,
      config: this.config,
      state: this.state,
      updateStateFn: (newState) => {
        this.state = newState;
      },
      recordErrorFn: (err, info, id) => this.recordError(err, info, id),
      processHandlingFn: (err, info) => this.processErrorHandling(err, info),
    });
    this.emit('errorOccurred', {
      error,
      errorInfo,
      errorId: this.state.errorId,
    });
  }
  private recordError(
    error: Error,
    errorInfo: ErrorInfo,
    errorId: string
  ): void {
    ErrorBoundaryUtils.recordError(error, errorInfo, errorId, {
      retryCount: this.state.retryCount,
      history: this.errorHistory,
    });
  }

  private async processErrorHandling(
    error: Error,
    errorInfo: ErrorInfo
  ): Promise<void> {
    this.executeErrorCallback(error, errorInfo);
    this.executeRegisteredHandlers(error, errorInfo);
    const recoveryResult = await this.recovery.attemptRecovery(
      error,
      errorInfo
    );
    if (recoveryResult.recovered) {
      this.emit('errorRecovered', { error, strategy: recoveryResult.strategy });
      this.reset();
    } else {
      this.attemptManualRecovery(error, errorInfo);
    }
  }
  private executeRegisteredHandlers(error: Error, errorInfo: ErrorInfo): void {
    ErrorBoundaryHandlers.executeRegisteredHandlers(
      error,
      errorInfo,
      this.eventHandlers.get('error')
    );
  }
  private executeErrorCallback(error: Error, errorInfo: ErrorInfo): void {
    ErrorBoundaryHandlers.executeErrorCallback(
      error,
      errorInfo,
      this.config.onError
    );
  }

  private attemptManualRecovery(error: Error, errorInfo: ErrorInfo): void {
    if (
      ErrorBoundaryUtils.shouldRetry(
        error,
        this.state.retryCount,
        this.config.maxRetries
      )
    ) {
      this.scheduleRetry(error, errorInfo);
    } else {
      this.emit('errorUnrecoverable', { error, errorInfo });
    }
  }
  private scheduleRetry(error: Error, errorInfo: ErrorInfo): void {
    this.retryTimer = ErrorBoundaryHandlers.scheduleRetry({
      error,
      errorInfo,
      retryDelay: this.config.retryDelay,
      retryTimer: this.retryTimer,
      performRetryFn: (err, info) => this.performRetry(err, info),
    });
  }
  private performRetry(_error: Error, _errorInfo: ErrorInfo): void {
    ErrorBoundaryHandlers.performRetry(
      this.state,
      this.config,
      () => this.reset(),
      (event, data) => this.emit(event, data)
    );
  }
  public onError(handler: (error: Error, errorInfo: ErrorInfo) => void): void {
    this.on('error', handler);
  }
  public runWithBoundary(fn: () => void): void {
    ErrorBoundaryHandlers.runWithBoundary(fn, (error) =>
      this.handleError(error)
    );
  }
  public async runAsyncWithBoundary(fn: () => Promise<void>): Promise<void> {
    await ErrorBoundaryHandlers.runAsyncWithBoundary(fn, (error) =>
      this.handleError(error)
    );
  }
  public getFallbackUI(): string {
    return ErrorBoundaryWrapper.getFallbackUI(
      this.state.hasError,
      this.state.error,
      this.state.errorInfo,
      this.config.fallbackRenderer
    );
  }

  public async retryOperation<T>(
    operation: () => T | Promise<T>,
    maxAttempts: number = this.config.maxRetries,
    delay: number = this.config.retryDelay
  ): Promise<T> {
    return ErrorBoundaryMethods.retryOperation(
      operation,
      maxAttempts,
      delay,
      (ms) => this.delay(ms)
    );
  }
  private async delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
  public createComponentBoundary(name: string): ErrorBoundary {
    return ErrorBoundaryHandlers.createComponentBoundary(
      name,
      this.config,
      ErrorBoundary
    ) as ErrorBoundary;
  }
  public reset(): void {
    this.state = ErrorBoundaryState.reset(
      this.config.maxRetries,
      this.retryTimer,
      () => this.clearPreservedState(),
      (event) => this.emit(event)
    );
    this.retryTimer = null;
  }
  public getErrorHistory(): ErrorHistoryEntry[] {
    return [...this.errorHistory];
  }
  public getMetrics(timeWindow?: number): ErrorMetrics {
    return ErrorBoundaryMethods.getMetrics(
      this.errorHistory,
      timeWindow,
      this.state,
      this.config
    );
  }

  public getState(): ErrorState { return { ...this.state }; }
  public getErrorState(): ErrorState { return this.getState(); }
  public hasError(): boolean { return this.state.hasError; }
  public getError(): Error | null { return this.state.error; }

  public clearError(): void {
    this.state = ErrorBoundaryState.clearError(
      this.config.maxRetries,
      this.retryTimer,
      this.config.onRecovery,
      (event) => this.emit(event)
    );
    this.retryTimer = null;
  }

  public getPreservedState<T = unknown>(key: string): T | null {
    return ErrorBoundaryState.getPreservedState<T>(this.preservedState, key);
  }

  public retry(): boolean {
    if (!this.canRetry()) return false;
    this.performRetry(
      this.state.error ?? new Error('Unknown'),
      this.state.errorInfo ?? {}
    );
    return true;
  }
  public canRetry(): boolean { return this.state.retryCount < this.config.maxRetries; }
  public getRemainingRetries(): number { return this.config.maxRetries - this.state.retryCount; }
  public resetRetryCount(): void { this.state.retryCount = 0; }
  public preserveCurrentState(): void {
    ErrorBoundaryMethods.preserveCurrentState(
      this.state,
      (key, value) => this.preserveState(key, value),
      this.config.enableStatePreservation
    );
  }
  public restorePreservedState(): void {
    const preserved = ErrorBoundaryMethods.restorePreservedState((key) =>
      this.getPreservedState(key)
    );
    if (preserved) this.state = { ...preserved };
  }
  public render(): string { return this.getFallbackUI(); }
  public createCheckpoint(): string { const checkpointId = ErrorBoundaryMethods.createCheckpoint(this.state); this.preserveState(checkpointId, { ...this.state }); return checkpointId; }
  public restoreFromCheckpoint(checkpointId: string): boolean { const checkpoint = ErrorBoundaryMethods.restoreFromCheckpoint(checkpointId, (key) => this.restoreState(key)); if (checkpoint) { this.state = { ...checkpoint }; return true; } return false; }
  public getErrorFrequency(): number {
    return ErrorBoundaryMethods.getErrorFrequency(this.errorHistory);
  }
  public getRecentErrors(limit: number): ErrorHistoryEntry[] {
    return ErrorBoundaryMethods.getRecentErrors(this.errorHistory, limit);
  }
  public getConfig(): ErrorBoundaryConfig { return { ...this.config }; }
  public updateConfig(newConfig: Partial<ErrorBoundaryConfig>): void {
    this.config = ErrorBoundaryState.updateConfig(
      this.config,
      newConfig,
      (event, data) => this.emit(event, data)
    );
  }
  public preserveState(key: string, value: unknown): void {
    ErrorBoundaryState.preserveState(
      this.preservedState,
      this.config.enableStatePreservation,
      key,
      value
    );
  }
  public restoreState(key: string): unknown {
    return ErrorBoundaryState.restoreState(this.preservedState, key);
  }
  public clearPreservedState(key?: string): void {
    ErrorBoundaryState.clearPreservedState(this.preservedState, key);
  }
  public destroy(): void {
    ErrorBoundaryState.destroy({
      retryTimer: this.retryTimer,
      eventHandlers: this.eventHandlers,
      preservedState: this.preservedState,
      errorHistory: this.errorHistory,
      emitFn: (event) => this.emit(event),
    });
  }

  public on(event: string, handler: Function): void { if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, new Set()); this.eventHandlers.get(event)?.add(handler); }
  public off(event: string, handler: Function): void { this.eventHandlers.get(event)?.delete(handler); }
  private emit(event: string, data?: unknown): void { this.eventHandlers.get(event)?.forEach((h) => { try { h(data); } catch (e) { console.error(`Event error:`, e); } }); }
}
