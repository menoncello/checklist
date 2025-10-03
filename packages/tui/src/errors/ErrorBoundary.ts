import { createLogger } from "@checklist/core/utils/logger";
import { LifecycleManager, LifecycleHooks } from "../framework/Lifecycle";
import {
  ApplicationErrorContext,
  ApplicationErrorReport,
} from "./ApplicationErrorHandler";
import {
  ErrorBoundaryConfig,
  ErrorBoundaryMetrics,
  type ErrorInfo,
  ErrorRecordParams,
  ErrorUpdateParams,
  type ErrorState,
} from "./ErrorBoundaryHelpers";
import {
  ErrorBoundaryInitializers,
  ErrorBoundaryDependencies,
} from "./ErrorBoundaryInitializers";
import { ErrorBoundaryMethods } from "./ErrorBoundaryMethods";

const _logger = createLogger("checklist:tui:error-boundary");

export {
  type ErrorBoundaryConfig,
  type ErrorBoundaryMetrics,
  type ErrorInfo,
  type ErrorState,
} from "./ErrorBoundaryHelpers";

export {
  type ApplicationErrorContext,
  type ApplicationErrorReport,
} from "./ApplicationErrorHandler";

export class ErrorBoundary implements LifecycleHooks {
  private deps: ErrorBoundaryDependencies;
  private methods: ErrorBoundaryMethods;
  private initializers = new ErrorBoundaryInitializers();
  private initialized = false;

  constructor(config: Partial<ErrorBoundaryConfig> = {}) {
    this.deps = this.initializers.createDependencies(config);
    this.methods = new ErrorBoundaryMethods(this.deps);
  }

  public wrap<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return this.methods.wrap(fn);
  }

  public async onInitialize(): Promise<void> {
    this.initialized = true;
    await this.methods.onInitialize();
  }

  public async onShutdown(): Promise<void> {
    await this.methods.onShutdown();
    this.initialized = false;
  }

  public registerHooks(lifecycleManager: LifecycleManager): void {
    this.methods.registerHooks(lifecycleManager);
  }

  public handleApplicationError(
    error: Error,
    context: ApplicationErrorContext,
  ): void {
    this.methods.handleApplicationError(error, context);
  }

  public handleError(error: Error, errorInfo?: ErrorInfo): void {
    this.methods.handleError(error, errorInfo);
  }

  public getErrorReports(): ApplicationErrorReport[] {
    return this.methods.getErrorReports() as ApplicationErrorReport[];
  }

  public clearErrorReports(): void {
    this.methods.clearErrorReports();
  }

  public async execute<T>(fn: () => Promise<T> | T): Promise<T> {
    return this.methods.execute(fn);
  }

  public createCheckpoint(id: string): void {
    this.methods.createCheckpoint(id);
  }

  public restoreFromCheckpoint(id: string): boolean {
    return this.methods.restoreFromCheckpoint(id);
  }

  public getMetrics(): ErrorBoundaryMetrics {
    return this.methods.getMetrics() as ErrorBoundaryMetrics;
  }

  public getState(): ErrorState {
    return this.methods.getState() as ErrorState;
  }

  public resetState(): void {
    this.methods.resetState();
  }

  public recordError(params: ErrorRecordParams): void {
    this.deps.stateManager.recordError(params);
  }

  public updateErrorState(params: ErrorUpdateParams): void {
    this.deps.stateManager.updateErrorState(params);
  }

  // Event emitter-like methods
  public on(event: string, callback: (...args: unknown[]) => void): void {
    // Stub implementation for event binding
    console.log(`Event ${event} registered with callback:`, callback);
  }

  public off(event: string, callback?: (...args: unknown[]) => void): void {
    // Stub implementation for event unbinding
    console.log(`Event ${event} unregistered:`, callback);
  }

  public emit(event: string, ...args: unknown[]): void {
    // Stub implementation for event emission
    console.log(`Event ${event} emitted with args:`, args);
  }

  // Additional methods used by other parts of the codebase
  public preserveCurrentState(): void {
    // Stub implementation
  }

  public clearError(): void {
    this.resetState();
  }

  public retry(): boolean {
    // Stub implementation
    return false;
  }

  public canRetry(): boolean {
    // Stub implementation
    return false;
  }

  public getRemainingRetries(): number {
    // Stub implementation
    return 0;
  }

  public getErrorHistory(): unknown[] {
    // Stub implementation
    return [];
  }

  public getRecentErrors(): unknown[] {
    // Stub implementation
    return [];
  }

  public getErrorFrequency(): number {
    // Stub implementation
    return 0;
  }

  public updateConfig(): void {
    // Stub implementation
  }

  public getConfig(): ErrorBoundaryConfig {
    // Stub implementation
    return this.deps.config;
  }

  public reset(): void {
    this.resetState();
  }

  public resetRetryCount(): void {
    // Stub implementation
  }

  public getError(): Error | null {
    const state = this.getState();
    return state.error ?? null;
  }

  public hasError(): boolean {
    const state = this.getState();
    return state.hasError;
  }

  public getErrorInfo(): ErrorInfo | null {
    const state = this.getState();
    return state.errorInfo ?? null;
  }

  public render(): string {
    const state = this.getState();
    if (!state.hasError || !state.error) {
      return '';
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
    // Stub implementation
    return operation();
  }

  public runWithBoundary(fn: () => void): void {
    // Stub implementation
    try {
      fn();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public async runAsyncWithBoundary(fn: () => Promise<void>): Promise<void> {
    // Stub implementation
    try {
      await fn();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public createComponentBoundary(): ErrorBoundary {
    // Stub implementation
    return new ErrorBoundary(this.deps.config);
  }

  public preserveState(): void {
    // Stub implementation
  }

  public getPreservedState<T>(): T | null {
    // Stub implementation
    return null;
  }

  public clearPreservedState(): void {
    // Stub implementation
  }

  public destroy(): void {
    this.resetState();
  }

  public onError(error: Error): Promise<void> {
    // Stub implementation - convert to lifecycle hook format
    this.handleError(error);
    return Promise.resolve();
  }

  public onErrorWithInfo(handler: (error: Error, errorInfo: ErrorInfo) => void): void {
    // Keep the original signature for component-specific error handling
    // Wrap the handler to match the expected event signature
    this.on('error', (...args: unknown[]) => {
      const error = args[0] as Error;
      const errorInfo = args[1] as ErrorInfo;
      handler(error, errorInfo);
    });
  }
}