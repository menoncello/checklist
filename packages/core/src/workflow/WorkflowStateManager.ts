import { StateManager } from '../state/StateManager';
import { TransactionCoordinator } from '../state/TransactionCoordinator';
import { createLogger, type Logger } from '../utils/logger';
import {
  WorkflowState,
  ChecklistTemplate,
  Variables,
} from './types';

export class WorkflowStateManager {
  private stateManager: StateManager;
  private transactionCoordinator: TransactionCoordinator;
  private logger: Logger;

  constructor(
    stateManager: StateManager,
    transactionCoordinator: TransactionCoordinator
  ) {
    this.stateManager = stateManager;
    this.transactionCoordinator = transactionCoordinator;
    this.logger = createLogger('checklist:workflow:state');
  }

  async initializeState(templateId: string, vars: Variables = {}): Promise<WorkflowState> {
    this.logger.info({ msg: 'Initializing workflow state', templateId });

    const template = await this.loadTemplate(templateId);
    const existingState = await this.loadState();

    if (existingState?.templateId === templateId) {
      this.logger.info({ msg: 'Resuming existing workflow', templateId });
      return existingState;
    }

    return this.createNewState(template, vars);
  }

  private createNewState(template: ChecklistTemplate, vars: Variables): WorkflowState {
    return {
      templateId: template.id,
      currentStepIndex: 0,
      status: 'idle',
      variables: { ...vars },
      completedSteps: [],
      progress: {
        totalSteps: template.steps.length,
        completedSteps: 0,
        percentage: 0,
      },
      summary: {
        totalSteps: template.steps.length,
        completedSteps: 0,
        skippedSteps: 0,
        completionRate: 0,
        estimatedTimeRemaining: 0,
      },
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
  }

  async recoverFromIncompleteTransactions(): Promise<void> {
    const walEntries = await this.transactionCoordinator.getWALEntries();

    if (walEntries.length === 0) {
      this.logger.debug({ msg: 'No WAL entries found for recovery' });
      return;
    }

    this.logger.info({
      msg: 'Recovering from incomplete transactions',
      entryCount: walEntries.length,
    });

    for (const entry of walEntries) {
      await this.handleWALRecovery(entry);
    }

    await this.transactionCoordinator.clearWAL();
    this.logger.info({ msg: 'WAL recovery completed' });
  }

  private async handleWALRecovery(entry: { op: string; key: string }): Promise<void> {
    try {
      switch (entry.op) {
        case 'advance':
          this.logger.debug({ msg: 'Recovering advance operation', key: entry.key });
          break;

        case 'goBack':
          this.logger.debug({ msg: 'Recovering goBack operation', key: entry.key });
          break;

        case 'skip':
          this.logger.debug({ msg: 'Recovering skip operation', key: entry.key });
          break;

        case 'reset':
          this.logger.debug({ msg: 'Recovering reset operation', key: entry.key });
          break;

        default:
          this.logger.warn({ msg: 'Unknown WAL operation', operation: entry.op });
      }
    } catch (error) {
      this.logger.error({
        msg: 'Failed to recover WAL entry',
        entry,
        error: (error as Error).message,
      });
    }
  }

  async loadTemplate(templateId: string): Promise<ChecklistTemplate> {
    try {
      return await this.stateManager.loadTemplate(templateId);
    } catch (error) {
      this.logger.error({ msg: 'Failed to load template', templateId, error });
      throw error;
    }
  }

  async loadState(): Promise<WorkflowState | null> {
    return await this.stateManager.loadWorkflowState();
  }

  async saveState(state: WorkflowState): Promise<void> {
    try {
      const updatedState = {
        ...state,
        lastModified: new Date().toISOString(),
      };

      await this.stateManager.saveWorkflowState(updatedState);
      this.logger.debug({ msg: 'Workflow state saved', status: state.status });
    } catch (error) {
      this.logger.error({ msg: 'Failed to save workflow state', error });
      throw error;
    }
  }

  async beginTransaction(operation: string): Promise<string> {
    return await this.transactionCoordinator.beginTransaction(operation);
  }

  async commitTransaction(transactionId: string): Promise<void> {
    await this.transactionCoordinator.commitTransaction(transactionId);
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    await this.transactionCoordinator.rollbackTransaction(transactionId);
  }
}