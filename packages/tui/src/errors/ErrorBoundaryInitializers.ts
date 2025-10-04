import { ApplicationErrorHandler } from './ApplicationErrorHandler';
import { CustomErrorStateHandler } from './CustomErrorStateHandler';
import { ErrorBoundaryCheckpointManager } from './ErrorBoundaryCheckpointManager';
import { ErrorBoundaryCore } from './ErrorBoundaryCore';
import { ErrorBoundaryEventManager } from './ErrorBoundaryEventManager';
import {
  ErrorBoundaryConfig,
  ErrorHistoryManager,
  ErrorStateManager,
  StatePreservationManager,
} from './ErrorBoundaryHelpers';
import { ErrorBoundaryMetricsCollector } from './ErrorBoundaryMetricsCollector';
import { ErrorBoundaryOperations } from './ErrorBoundaryOperations';
import { ErrorBoundaryRenderer } from './ErrorBoundaryRenderer';
import { ErrorBoundaryRetryManager } from './ErrorBoundaryRetryManager';
import { ErrorBoundaryStateHandler } from './ErrorBoundaryStateHandler';
import { ErrorBoundaryWrapper } from './ErrorBoundaryWrapper';
import { ErrorRecoveryManager } from './ErrorRecoveryManager';
import { ErrorRenderer } from './ErrorRenderer';

export interface ErrorBoundaryDependencies {
  config: ErrorBoundaryConfig;
  stateManager: ErrorStateManager;
  historyManager: ErrorHistoryManager;
  preservationManager: StatePreservationManager;
  retryManager: ErrorBoundaryRetryManager;
  checkpointManager: ErrorBoundaryCheckpointManager;
  eventManager: ErrorBoundaryEventManager;
  wrapper: ErrorBoundaryWrapper;
  metricsCollector: ErrorBoundaryMetricsCollector;
  operations: ErrorBoundaryOperations;
  stateHandler: ErrorBoundaryStateHandler;
  core: ErrorBoundaryCore;
  applicationErrorHandler: ApplicationErrorHandler;
  recoveryManager: ErrorRecoveryManager;
  customErrorStateHandler: CustomErrorStateHandler;
  errorRenderer: ErrorRenderer;
}

export class ErrorBoundaryInitializers {
  public initializeConfig(
    config: Partial<ErrorBoundaryConfig>
  ): ErrorBoundaryConfig {
    return {
      maxRetries: 3,
      retryDelay: 1000,
      logErrors: true,
      fallbackRenderer: new ErrorBoundaryRenderer(),
      enableStatePreservation: true,
      ...config,
    };
  }

  public initializeManagers(): {
    stateManager: ErrorStateManager;
    historyManager: ErrorHistoryManager;
    preservationManager: StatePreservationManager;
    eventManager: ErrorBoundaryEventManager;
    checkpointManager: ErrorBoundaryCheckpointManager;
  } {
    return {
      stateManager: new ErrorStateManager(),
      historyManager: new ErrorHistoryManager(),
      preservationManager: new StatePreservationManager(),
      eventManager: new ErrorBoundaryEventManager(),
      checkpointManager: new ErrorBoundaryCheckpointManager(
        new StatePreservationManager()
      ),
    };
  }

  private createOperationalContext(
    config: ErrorBoundaryConfig,
    stateManager: ErrorStateManager,
    historyManager: ErrorHistoryManager
  ) {
    return { config, stateManager, historyManager };
  }

  private createOperationalManagers(
    preservationManager: StatePreservationManager,
    eventManager: ErrorBoundaryEventManager,
    checkpointManager: ErrorBoundaryCheckpointManager
  ) {
    return { preservationManager, eventManager, checkpointManager };
  }

  private createBasicOperationalComponents(
    context: ReturnType<typeof this.createOperationalContext>,
    managers: ReturnType<typeof this.createOperationalManagers>
  ) {
    return {
      retryManager: new ErrorBoundaryRetryManager(
        context.config,
        context.historyManager
      ),
      metricsCollector: new ErrorBoundaryMetricsCollector(
        context.historyManager,
        managers.preservationManager
      ),
    };
  }

  private createComplexOperationalComponents(
    context: ReturnType<typeof this.createOperationalContext>,
    managers: ReturnType<typeof this.createOperationalManagers>
  ) {
    return {
      wrapper: new ErrorBoundaryWrapper(
        context.stateManager,
        managers.eventManager
      ),
      operations: new ErrorBoundaryOperations(
        context.stateManager,
        managers.preservationManager,
        managers.checkpointManager,
        managers.eventManager
      ),
      stateHandler: new ErrorBoundaryStateHandler(
        context.stateManager,
        managers.preservationManager,
        managers.eventManager
      ),
    };
  }

  public initializeOperationalComponents(
    context: ReturnType<typeof this.createOperationalContext>,
    managers: ReturnType<typeof this.createOperationalManagers>
  ): {
    retryManager: ErrorBoundaryRetryManager;
    wrapper: ErrorBoundaryWrapper;
    metricsCollector: ErrorBoundaryMetricsCollector;
    operations: ErrorBoundaryOperations;
    stateHandler: ErrorBoundaryStateHandler;
  } {
    const basic = this.createBasicOperationalComponents(context, managers);
    const complex = this.createComplexOperationalComponents(context, managers);
    return { ...basic, ...complex };
  }

  private createHandlerContext(
    config: ErrorBoundaryConfig,
    stateManager: ErrorStateManager,
    historyManager: ErrorHistoryManager
  ) {
    return { config, stateManager, historyManager };
  }

  private createHandlerManagers(
    eventManager: ErrorBoundaryEventManager,
    checkpointManager: ErrorBoundaryCheckpointManager,
    retryManager: ErrorBoundaryRetryManager
  ) {
    return { eventManager, checkpointManager, retryManager };
  }

  private createCoreHandler(
    context: ReturnType<typeof this.createHandlerContext>,
    managers: ReturnType<typeof this.createHandlerManagers>
  ) {
    return new ErrorBoundaryCore(context.config, {
      stateManager: context.stateManager,
      historyManager: context.historyManager,
      eventManager: managers.eventManager,
      checkpointManager: managers.checkpointManager,
    });
  }

  private createUtilityHandlers(
    context: ReturnType<typeof this.createHandlerContext>,
    managers: ReturnType<typeof this.createHandlerManagers>
  ) {
    return {
      applicationErrorHandler: new ApplicationErrorHandler(
        context.stateManager,
        context.historyManager,
        managers.eventManager
      ),
      recoveryManager: new ErrorRecoveryManager(
        context.stateManager,
        managers.retryManager,
        managers.eventManager
      ),
      customErrorStateHandler: new CustomErrorStateHandler(
        context.stateManager,
        managers.eventManager
      ),
      errorRenderer: new ErrorRenderer(context.config, context.stateManager),
    };
  }

  public initializeHandlers(
    context: ReturnType<typeof this.createHandlerContext>,
    managers: ReturnType<typeof this.createHandlerManagers>
  ): {
    core: ErrorBoundaryCore;
    applicationErrorHandler: ApplicationErrorHandler;
    recoveryManager: ErrorRecoveryManager;
    customErrorStateHandler: CustomErrorStateHandler;
    errorRenderer: ErrorRenderer;
  } {
    return {
      core: this.createCoreHandler(context, managers),
      ...this.createUtilityHandlers(context, managers),
    };
  }

  private initializeAllComponents(
    config: ErrorBoundaryConfig,
    managers: ReturnType<typeof this.initializeManagers>
  ) {
    const opContext = this.createOperationalContext(
      config,
      managers.stateManager,
      managers.historyManager
    );
    const opManagers = this.createOperationalManagers(
      managers.preservationManager,
      managers.eventManager,
      managers.checkpointManager
    );
    return this.initializeOperationalComponents(opContext, opManagers);
  }

  private initializeAllHandlers(
    config: ErrorBoundaryConfig,
    managers: ReturnType<typeof this.initializeManagers>,
    retryManager: ErrorBoundaryRetryManager
  ) {
    const hContext = this.createHandlerContext(
      config,
      managers.stateManager,
      managers.historyManager
    );
    const hManagers = this.createHandlerManagers(
      managers.eventManager,
      managers.checkpointManager,
      retryManager
    );
    return this.initializeHandlers(hContext, hManagers);
  }

  public createDependencies(
    config: Partial<ErrorBoundaryConfig>
  ): ErrorBoundaryDependencies {
    const initializedConfig = this.initializeConfig(config);
    const managers = this.initializeManagers();
    const components = this.initializeAllComponents(
      initializedConfig,
      managers
    );
    const handlers = this.initializeAllHandlers(
      initializedConfig,
      managers,
      components.retryManager
    );

    return {
      config: initializedConfig,
      ...managers,
      ...components,
      ...handlers,
    };
  }
}
