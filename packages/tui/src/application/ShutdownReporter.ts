import { ShutdownContext, ShutdownReport } from './ShutdownManager';

export class ShutdownReporter {
  public generateReport(context: ShutdownContext | null): ShutdownReport {
    if (!context) {
      return this.createEmptyReport();
    }

    const duration = Date.now() - context.startTime;
    const steps = this.createStepReports(context);

    return {
      duration,
      stepsCompleted: context.completedSteps.size,
      stepsFailed: context.failedSteps.size,
      steps,
      forceShutdown: context.forceShutdown,
      timeoutReached: context.forceShutdown,
    };
  }

  private createEmptyReport(): ShutdownReport {
    return {
      duration: 0,
      stepsCompleted: 0,
      stepsFailed: 0,
      steps: [],
      forceShutdown: false,
      timeoutReached: false,
    };
  }

  private createStepReports(context: ShutdownContext): Array<{
    id: string;
    name: string;
    status: 'completed' | 'failed' | 'skipped';
    error?: string;
  }> {
    return context.steps.map((step) => ({
      id: step.id,
      name: step.name,
      status: this.getStepStatus(step.id, context),
      error: context.failedSteps.get(step.id)?.message,
    }));
  }

  private getStepStatus(
    stepId: string,
    context: ShutdownContext
  ): 'completed' | 'failed' | 'skipped' {
    if (context.completedSteps.has(stepId)) {
      return 'completed';
    }
    if (context.failedSteps.has(stepId)) {
      return 'failed';
    }
    return 'skipped';
  }
}
