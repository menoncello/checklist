import { createLogger } from '@checklist/core/utils/logger';
import { EventBus } from '../events/EventBus';
import { ShutdownStep } from './ShutdownSteps';

const logger = createLogger('checklist:tui:shutdown-execution');

export interface ShutdownContext {
  startTime: number;
  timeout: number;
  steps: ShutdownStep[];
  completedSteps: Set<string>;
  failedSteps: Map<string, Error>;
  forceShutdown: boolean;
}

export class ShutdownExecution {
  private eventBus: EventBus;
  private timers: NodeJS.Timeout[] = [];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public async executeGracefulShutdown(
    context: ShutdownContext,
    _reason: string = 'unknown'
  ): Promise<void> {
    this.startTimeoutTimer(context);

    for (const step of context.steps) {
      if (context.forceShutdown) {
        logger.warn({
          msg: 'Skipping step due to force shutdown',
          stepId: step.id,
          stepName: step.name,
        });
        continue;
      }

      await this.executeStep(step, context);
    }
  }

  private async executeStep(
    step: {
      id: string;
      name: string;
      timeout: number;
      required: boolean;
      executor: () => Promise<void> | void;
    },
    context: ShutdownContext
  ): Promise<void> {
    const stepStartTime = Date.now();

    try {
      this.logStepStart(step);
      await this.executeStepWithTimeout(step);
      const stepDuration = Date.now() - stepStartTime;

      this.handleStepSuccess(step, context, stepDuration);
    } catch (error) {
      this.handleStepFailure(step, context, error as Error);
    }
  }

  private logStepStart(step: {
    id: string;
    name: string;
    timeout: number;
  }): void {
    logger.debug({
      msg: 'Executing shutdown step',
      stepId: step.id,
      stepName: step.name,
      timeout: step.timeout,
    });
  }

  private handleStepSuccess(
    step: {
      id: string;
      name: string;
    },
    context: ShutdownContext,
    duration: number
  ): void {
    context.completedSteps.add(step.id);

    logger.debug({
      msg: 'Shutdown step completed',
      stepId: step.id,
      duration,
    });

    this.eventBus.publish('shutdown:step-completed', {
      step,
      duration,
      timestamp: Date.now(),
    });
  }

  private handleStepFailure(
    step: {
      id: string;
      name: string;
    },
    context: ShutdownContext,
    error: Error
  ): void {
    logger.error({
      msg: 'Shutdown step failed',
      stepId: step.id,
      stepName: step.name,
      error: error.message,
    });

    context.failedSteps.set(step.id, error);
    this.eventBus.publish('shutdown:step-failed', {
      step,
      error,
      timestamp: Date.now(),
    });
  }

  private async executeStepWithTimeout(step: {
    id: string;
    name: string;
    timeout: number;
    required: boolean;
    executor: () => Promise<void> | void;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Step '${step.name}' timed out after ${step.timeout}ms`)
        );
      }, step.timeout);

      Promise.resolve(step.executor())
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private startTimeoutTimer(context: ShutdownContext): void {
    const timer = setTimeout(() => {
      try {
        logger.warn({
          msg: 'Shutdown timeout reached, initiating force shutdown',
          timeout: context.timeout,
        });
        context.forceShutdown = true;

        this.eventBus.publish('shutdown:timeout', {
          context,
          timestamp: Date.now(),
        });
      } catch (error) {
        // Ignore errors if EventBus is destroyed
        if (
          error instanceof Error &&
          error.message.includes('EventBus has been destroyed')
        ) {
          logger.debug({
            msg: 'EventBus destroyed during shutdown timeout, ignoring publish error',
          });
        } else {
          logger.error({
            msg: 'Unexpected error during shutdown timeout',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }, context.timeout);

    this.timers.push(timer);
  }

  public cleanup(): void {
    // Clear all pending timers to prevent callbacks after destruction
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers = [];
  }
}
