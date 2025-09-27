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
    this.components.stateManager.setMaxRetries(this.config.maxRetries);
    this.components.operations.updateConfig(this.config);
    this.components.stateHandler.updateStatePreservationConfig(
      this.config.enableStatePreservation
    );
  }

  reset(): void {
    this.components.stateManager.reset(this.config.maxRetries);
    this.components.historyManager.clear();
    this.components.preservationManager.clear();
  }

  destroy(): void {
    this.components.retryManager.destroy();
    this.components.preservationManager.clear();
    this.components.historyManager.clear();
    this.components.stateManager.reset(this.config.maxRetries);
  }
}
