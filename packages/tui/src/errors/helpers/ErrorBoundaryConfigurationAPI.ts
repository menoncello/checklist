import type {
  ErrorBoundaryConfig,
  ErrorHistoryManager,
  ErrorStateManager,
  StatePreservationManager,
} from '../ErrorBoundaryHelpers';
import type { ErrorBoundaryOperations } from '../ErrorBoundaryOperations';
import type { ErrorBoundaryRetryManager } from '../ErrorBoundaryRetryManager';
import type { ErrorBoundaryStateHandler } from '../ErrorBoundaryStateHandler';

interface ErrorBoundaryConfigComponents {
  stateManager: ErrorStateManager;
  historyManager: ErrorHistoryManager;
  preservationManager: StatePreservationManager;
  retryManager: ErrorBoundaryRetryManager;
  operations: ErrorBoundaryOperations;
  stateHandler: ErrorBoundaryStateHandler;
}

export class ErrorBoundaryConfigurationAPI {
  constructor(
    private config: ErrorBoundaryConfig,
    private components: ErrorBoundaryConfigComponents
  ) {}

  updateConfig(newConfig: Partial<ErrorBoundaryConfig>): void {
    Object.assign(this.config, newConfig);
    this.components.stateManager.setMaxRetries(this.config.maxRetries ?? 3);
    this.components.operations.updateConfig(this.config);
    this.components.stateHandler.updateStatePreservationConfig(
      this.config.enableStatePreservation
    );
  }

  reset(): void {
    this.components.stateManager.resetState();
    this.components.historyManager.clear();
    this.components.preservationManager.clear();
  }

  destroy(): void {
    // Use available cleanup methods - retryManager doesn't have destroy method
    this.components.retryManager.reset();
    this.components.preservationManager.clear();
    this.components.historyManager.clear();
    this.components.stateManager.resetState();
  }
}
