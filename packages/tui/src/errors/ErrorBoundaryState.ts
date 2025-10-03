import {
  type ErrorState,
  type ErrorBoundaryConfig,
} from './ErrorBoundaryTypes';
import { ErrorBoundaryUtils } from './ErrorBoundaryUtils';

export class ErrorBoundaryState {
  static reset(
    maxRetries: number,
    retryTimer: Timer | null,
    clearPreservedStateFn: () => void,
    emitFn: (event: string) => void
  ): ErrorState {
    if (retryTimer) {
      clearTimeout(retryTimer);
    }

    clearPreservedStateFn();
    emitFn('reset');

    const state = ErrorBoundaryUtils.createInitialState();
    state.maxRetries = maxRetries;
    return state;
  }

  static clearError(
    maxRetries: number,
    retryTimer: Timer | null,
    onRecovery: (() => void) | undefined,
    emitFn: (event: string) => void
  ): ErrorState {
    if (retryTimer) {
      clearTimeout(retryTimer);
    }

    if (onRecovery) {
      onRecovery();
    }

    emitFn('reset');

    const state = ErrorBoundaryUtils.createInitialState();
    state.maxRetries = maxRetries;
    return state;
  }

  static preserveState(
    preservedState: Map<string, unknown>,
    enableStatePreservation: boolean,
    key: string,
    value: unknown
  ): void {
    if (enableStatePreservation) {
      preservedState.set(key, value);
    }
  }

  static restoreState(
    preservedState: Map<string, unknown>,
    key: string
  ): unknown {
    return preservedState.get(key);
  }

  static clearPreservedState(
    preservedState: Map<string, unknown>,
    key?: string
  ): void {
    if (key !== undefined) {
      preservedState.delete(key);
    } else {
      preservedState.clear();
    }
  }

  static getPreservedState<T = unknown>(
    preservedState: Map<string, unknown>,
    key: string
  ): T | null {
    const value = preservedState.get(key);
    return value !== undefined ? (value as T) : null;
  }

  static updateConfig(
    currentConfig: ErrorBoundaryConfig,
    newConfig: Partial<ErrorBoundaryConfig>,
    emitFn: (event: string, data?: unknown) => void
  ): ErrorBoundaryConfig {
    const config = ErrorBoundaryUtils.mergeConfigs(currentConfig, newConfig);
    emitFn('configUpdated', { config });
    return config;
  }

  static destroy(options: {
    retryTimer: Timer | null;
    eventHandlers: Map<string, Set<Function>>;
    preservedState: Map<string, unknown>;
    errorHistory: unknown[];
    emitFn: (event: string) => void;
  }): void {
    if (options.retryTimer) {
      clearTimeout(options.retryTimer);
    }

    options.eventHandlers.clear();
    options.preservedState.clear();
    options.errorHistory.length = 0;
    options.emitFn('destroyed');
  }
}
