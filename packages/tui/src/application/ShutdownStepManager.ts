import { createLogger } from '@checklist/core/utils/logger';
import { ShutdownStep } from './ShutdownSteps';

const logger = createLogger('checklist:tui:shutdown-step-manager');

export class ShutdownStepManager {
  private steps: ShutdownStep[] = [];

  public addStep(step: ShutdownStep): void {
    this.steps.push(step);

    // Re-sort by priority
    this.steps.sort((a, b) => b.priority - a.priority);

    logger.debug({
      msg: 'Cleanup step added',
      stepId: step.id,
      stepName: step.name,
      priority: step.priority,
    });
  }

  public removeStep(stepId: string): boolean {
    const initialLength = this.steps.length;
    this.steps = this.steps.filter((step) => step.id !== stepId);

    const removed = this.steps.length !== initialLength;

    if (removed) {
      logger.debug({
        msg: 'Cleanup step removed',
        stepId,
      });
    }

    return removed;
  }

  public getSteps(): ShutdownStep[] {
    return [...this.steps];
  }

  public getStepCount(): number {
    return this.steps.length;
  }

  public setSteps(steps: ShutdownStep[]): void {
    this.steps = [...steps].sort((a, b) => b.priority - a.priority);
  }

  public clear(): void {
    this.steps = [];
    logger.debug({ msg: 'All cleanup steps cleared' });
  }
}
