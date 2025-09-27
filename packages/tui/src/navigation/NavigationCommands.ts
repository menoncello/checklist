import { EventBus } from '../events/EventBus';

export interface NavigationState {
  currentStepId: string;
  previousStepId?: string;
  completedSteps: string[];
  skippedSteps: string[];
  hasUnsavedChanges: boolean;
  viewMode: 'list' | 'detail';
}

export interface NavigationCommand {
  id: string;
  type: 'internal';
  key: string;
  handler: () => Promise<void> | void;
  requiresConfirmation?: boolean;
  description: string;
}

export interface NavigationCommandConfig {
  handler: () => Promise<void> | void;
  requiresConfirmation?: boolean;
  description: string;
}

/**
 * NavigationCommandExecutor - Handles execution of navigation commands
 */
export class NavigationCommandExecutor {
  constructor(
    private eventBus: EventBus,
    public navigationState: NavigationState
  ) {}

  public async advanceToNext(): Promise<void> {
    this.eventBus.publishSync('navigation-advance-next', {
      currentStepId: this.navigationState.currentStepId,
      timestamp: Date.now(),
    });
  }

  public async markDoneAndAdvance(): Promise<void> {
    this.navigationState.completedSteps.push(
      this.navigationState.currentStepId
    );
    this.navigationState.hasUnsavedChanges = true;

    this.eventBus.publishSync('navigation-mark-done-advance', {
      completedStepId: this.navigationState.currentStepId,
      timestamp: Date.now(),
    });
  }

  public async goBackToPrevious(): Promise<void> {
    const previousStepId = this.navigationState.previousStepId;
    if (previousStepId === undefined) {
      throw new Error('No previous step available');
    }

    this.eventBus.publishSync('navigation-go-back', {
      currentStepId: this.navigationState.currentStepId,
      targetStepId: previousStepId,
      timestamp: Date.now(),
    });
  }

  public async resetToBeginning(): Promise<void> {
    this.navigationState.completedSteps = [];
    this.navigationState.skippedSteps = [];
    this.navigationState.hasUnsavedChanges = true;

    this.eventBus.publishSync('navigation-reset', {
      timestamp: Date.now(),
    });
  }

  public async skipWithConfirmation(): Promise<void> {
    this.navigationState.skippedSteps.push(this.navigationState.currentStepId);
    this.navigationState.hasUnsavedChanges = true;

    this.eventBus.publishSync('navigation-skip-step', {
      skippedStepId: this.navigationState.currentStepId,
      timestamp: Date.now(),
    });
  }

  public async toggleListView(): Promise<void> {
    const newViewMode =
      this.navigationState.viewMode === 'list' ? 'detail' : 'list';
    this.navigationState.viewMode = newViewMode;

    this.eventBus.publishSync('navigation-toggle-view', {
      viewMode: newViewMode,
      timestamp: Date.now(),
    });
  }

  public saveAndQuit(): void {
    this.eventBus.publishSync('navigation-save-and-quit', {
      state: this.navigationState,
      timestamp: Date.now(),
    });
  }

  public forceQuit(): void {
    this.eventBus.publishSync('navigation-force-quit', {
      timestamp: Date.now(),
    });
  }
}
