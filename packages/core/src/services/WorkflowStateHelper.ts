import type { IStateManager, WorkflowInstance } from '../interfaces/IStateManager';
import type { WorkflowStep } from '../interfaces/IWorkflowEngine';
import type { Logger } from '../utils/logger';

export class WorkflowStateHelper {
  constructor(
    private stateManager: IStateManager,
    private logger: Logger
  ) {}

  async persistWorkflowStart(instance: WorkflowInstance): Promise<void> {
    const state = await this.stateManager.load();
    state.activeInstance = instance;
    state.instances.push(instance);
    await this.stateManager.save(state);
  }

  async saveWorkflowState(currentInstance: WorkflowInstance | null): Promise<void> {
    const state = await this.stateManager.load();
    state.activeInstance = currentInstance ?? undefined;

    if (currentInstance) {
      const instanceIndex = state.instances.findIndex(
        (i) => i.id === currentInstance.id
      );
      if (instanceIndex >= 0) {
        state.instances[instanceIndex] = currentInstance;
      }
    }

    await this.stateManager.save(state);
  }

  async clearPersistedState(): Promise<void> {
    const state = await this.stateManager.load();
    state.activeInstance = undefined;
    await this.stateManager.save(state);
  }

  async pauseInstance(instance: WorkflowInstance): Promise<void> {
    instance.status = 'paused';
    const state = await this.stateManager.load();
    state.activeInstance = instance;
    await this.stateManager.save(state);
  }

  async resumeInstance(instance: WorkflowInstance): Promise<void> {
    instance.status = 'active';
    const state = await this.stateManager.load();
    state.activeInstance = instance;
    await this.stateManager.save(state);
  }

  async loadActiveInstance(): Promise<WorkflowInstance | null> {
    try {
      const state = await this.stateManager.load();
      if (state.activeInstance && state.activeInstance.status === 'active') {
        return state.activeInstance;
      }
      return null;
    } catch (error) {
      this.logger.warn({
        msg: 'Could not load active workflow',
        error: (error as Error).message,
      });
      return null;
    }
  }

  updateStepState(
    instance: WorkflowInstance,
    stepId: string,
    status: 'pending' | 'completed' | 'skipped' | 'failed',
    completedAt?: Date
  ): void {
    instance.stepStates[stepId] = {
      ...instance.stepStates[stepId],
      status,
      ...(completedAt ? { completedAt } : {}),
    };
  }

  initializeStepStates(instance: WorkflowInstance, steps: WorkflowStep[]): void {
    for (const step of steps) {
      instance.stepStates[step.id] = {
        stepId: step.id,
        status: 'pending',
      };
    }
  }
}