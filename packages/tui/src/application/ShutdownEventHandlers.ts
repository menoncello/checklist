import { createLogger } from '@checklist/core/utils/logger';
import { EventBus, BusMessage } from '../events/EventBus';
import { ShutdownExecution } from './ShutdownExecution';
import { ShutdownReport } from './ShutdownManager';
import { ShutdownStepManager } from './ShutdownStepManager';

const logger = createLogger('checklist:tui:shutdown-event-handlers');

export class ShutdownEventHandlers {
  constructor(
    private eventBus: EventBus,
    private shutdownExecution: ShutdownExecution,
    private stepManager: ShutdownStepManager
  ) {}

  public setupEventHandlers(): void {
    this.setupShutdownRequestHandler();
    this.setupAddHandlerHandler();
    this.setupRemoveHandlerHandler();
    this.setupAddStepHandler();
    this.setupRemoveStepHandler();
  }

  private setupShutdownRequestHandler(): void {
    this.eventBus.subscribe('shutdown:request', (message: BusMessage) => {
      this.handleShutdownRequest(
        message.data as { force?: boolean; reason?: string }
      );
    });
  }

  private setupAddHandlerHandler(): void {
    this.eventBus.subscribe('shutdown:add-handler', (message: BusMessage) => {
      const handler = message.data as {
        id: string;
        executor: () => Promise<void>;
      };
      // Convert handler to ShutdownStep and add it
      this.stepManager.addStep({
        id: handler.id,
        name: handler.id,
        priority: 50,
        timeout: 5000,
        required: false,
        executor: handler.executor,
      });
    });
  }

  private setupRemoveHandlerHandler(): void {
    this.eventBus.subscribe(
      'shutdown:remove-handler',
      (message: BusMessage) => {
        const handlerId = message.data as string;
        this.stepManager.removeStep(handlerId);
      }
    );
  }

  private setupAddStepHandler(): void {
    this.eventBus.subscribe('shutdown:add-step', (message: BusMessage) => {
      const step = message.data as import('./ShutdownSteps').ShutdownStep;
      this.stepManager.addStep(step);
    });
  }

  private setupRemoveStepHandler(): void {
    this.eventBus.subscribe('shutdown:remove-step', (message: BusMessage) => {
      const stepId = message.data as string;
      this.stepManager.removeStep(stepId);
    });
  }

  private handleShutdownRequest(request: {
    force?: boolean;
    reason?: string;
  }): void {
    logger.info({
      msg: 'Shutdown request received',
      force: request.force,
      reason: request.reason,
    });

    // Note: executeShutdown method would need to be added to ShutdownExecution
    // For now, log the request
    logger.warn({
      msg: 'executeShutdown not available on ShutdownExecution',
      force: request.force,
      reason: request.reason,
    });
  }

  public publishShutdownStarted(reason: string): void {
    this.eventBus.publish('shutdown:started', {
      reason,
      timestamp: Date.now(),
    });
  }

  public publishShutdownCompleted(report: ShutdownReport): void {
    this.eventBus.publish('shutdown:completed', {
      report,
      timestamp: Date.now(),
    });
  }

  public publishShutdownError(error: Error, report: ShutdownReport): void {
    this.eventBus.publish('shutdown:error', {
      error: error.message,
      report,
      timestamp: Date.now(),
    });
  }
}
