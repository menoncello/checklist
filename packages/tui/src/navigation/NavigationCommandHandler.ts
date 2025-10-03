import { BaseComponent } from '../components/BaseComponent';
import { NavigationFeedback } from '../components/NavigationFeedback';
import { EventBus, BusMessage } from '../events/EventBus';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import { ViewSystem } from '../views/ViewSystem';
import { CommandQueue } from './CommandQueue';
import {
  NavigationCommand,
  NavigationCommandConfig,
  NavigationCommandExecutor,
  NavigationState,
} from './NavigationCommands';
import { NavigationModalHelper } from './NavigationModalHelper';

/** Core navigation command processor for workflow navigation with visual feedback */
export class NavigationCommandHandler extends BaseComponent {
  public readonly id = 'navigation-command-handler';

  private readonly eventBus: EventBus;
  private readonly viewSystem: ViewSystem;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly visualFeedback: NavigationFeedback;
  private readonly commandQueue: CommandQueue;
  private readonly commandExecutor: NavigationCommandExecutor;
  private readonly modalHelper: NavigationModalHelper;
  private readonly registeredCommands = new Map<string, NavigationCommand>();
  private navigationState: NavigationState;
  private isProcessing = false;
  private subscriberId?: string;

  constructor(
    eventBus: EventBus,
    viewSystem: ViewSystem,
    performanceMonitor: PerformanceMonitor,
    initialState: NavigationState
  ) {
    super();
    this.eventBus = eventBus;
    this.viewSystem = viewSystem;
    this.performanceMonitor = performanceMonitor;
    this.navigationState = { ...initialState };
    this.visualFeedback = new NavigationFeedback();
    this.commandQueue = this.createCommandQueue();
    this.commandExecutor = new NavigationCommandExecutor(
      eventBus,
      this.navigationState
    );
    this.modalHelper = new NavigationModalHelper(
      viewSystem,
      this.commandExecutor
    );
    this.initializeCommands();
    this.setupEventListeners();
  }

  private createCommandQueue(): CommandQueue {
    // Use smaller queue size in test environment to prevent overflow
    const isTest = process.env.NODE_ENV === 'test';
    return new CommandQueue({
      debounceMs: 200,
      maxQueueSize: isTest ? 10 : 50,
      timeoutMs: 5000,
      errorHandler: (commandId, key, error) => {
        this.eventBus.publishSync('navigation-command-error', {
          commandId,
          key,
          error: error.message,
          state: this.getNavigationState(),
        });
      },
    });
  }

  protected initialize(): void {
    super.initialize();
  }
  private setupEventListeners(): void {
    this.subscriberId = this.eventBus.subscribe(
      'navigation-command-handler',
      this.handleKeyboardEvent.bind(this),
      { type: 'keyboard', source: 'KeyboardHandler' }
    );
    this.eventBus.subscribe(
      'navigation-state-handler',
      this.handleStateChange.bind(this),
      { type: 'state-change', source: 'WorkflowEngine' }
    );
  }
  private initializeCommands(): void {
    this.registerAllCommands();
  }
  private registerAllCommands(): void {
    [
      {
        key: 'n',
        handler: () => this.commandExecutor.advanceToNext(),
        description: 'Advance to next step',
      },
      {
        key: 'Enter',
        handler: () => this.commandExecutor.advanceToNext(),
        description: 'Advance to next step',
      },
      {
        key: 'd',
        handler: () => this.commandExecutor.markDoneAndAdvance(),
        description: 'Mark done and auto-advance',
      },
      {
        key: 'b',
        handler: () => this.commandExecutor.goBackToPrevious(),
        description: 'Go back to previous step',
      },
      {
        key: 'r',
        handler: () => this.commandExecutor.resetToBeginning(),
        requiresConfirmation: true,
        description: 'Reset to beginning',
      },
      {
        key: 's',
        handler: () => this.commandExecutor.skipWithConfirmation(),
        requiresConfirmation: true,
        description: 'Skip step with confirmation',
      },
      {
        key: 'l',
        handler: () => this.commandExecutor.toggleListView(),
        description: 'Toggle list/detail view',
      },
      {
        key: '?',
        handler: () => this.showHelpOverlay(),
        description: 'Show help overlay',
      },
      {
        key: 'q',
        handler: () => this.quitWithUnsavedCheck(),
        requiresConfirmation: false,
        description: 'Quit with unsaved check',
      },
    ].forEach((cmd) => this.registerCommand(cmd.key, cmd));
  }
  public registerCommand(key: string, config: NavigationCommandConfig): void {
    const command: NavigationCommand = {
      id: `nav-cmd-${key}`,
      type: 'internal',
      key,
      ...config,
    };
    this.registeredCommands.set(key, command);
  }
  public unregisterCommand(key: string): boolean {
    return this.registeredCommands.delete(key);
  }
  public getRegisteredCommands(): NavigationCommand[] {
    return Array.from(this.registeredCommands.values());
  }
  private async handleKeyboardEvent(message: BusMessage): Promise<void> {
    if (this.isProcessing) return;
    const { key } = message.data as { key: string };
    const command = this.registeredCommands.get(key);
    if (command === undefined) return;
    await this.commandQueue.enqueue({
      id: command.id,
      execute: () => this.executeCommand(command),
      validate: () => this.validateCommand(command),
      priority: this.getCommandPriority(command),
      timestamp: Date.now(),
    });
  }
  private async executeCommand(command: NavigationCommand): Promise<void> {
    const startTime = performance.now();
    this.isProcessing = true;
    try {
      await this.performCommandExecution(command);
      await this.recordCommandSuccess(command, startTime);
    } catch (error) {
      this.handleCommandError(command, error as Error);
    } finally {
      this.isProcessing = false;
    }
  }
  private async performCommandExecution(
    command: NavigationCommand
  ): Promise<void> {
    this.visualFeedback.showCommandFeedback(command.key, 'executing');

    if (command.requiresConfirmation === true) {
      const confirmed = await this.showConfirmationDialog(command);
      if (!confirmed) {
        this.visualFeedback.showCommandFeedback(command.key, 'cancelled');
        return;
      }
    }

    if (!this.validateNavigationState()) {
      throw new Error('Invalid navigation state');
    }

    if (command.handler !== undefined) await command.handler();
  }
  private async recordCommandSuccess(
    command: NavigationCommand,
    startTime: number
  ): Promise<void> {
    const duration = performance.now() - startTime;
    this.performanceMonitor.recordCommandExecution(command.id, duration);
    this.visualFeedback.showCommandFeedback(command.key, 'success');
    this.eventBus.publishSync('navigation-command-executed', {
      commandId: command.id,
      key: command.key,
      duration,
      state: this.getNavigationState(),
    });
    if (duration > 50)
      console.warn(
        `Navigation command '${command.key}' took ${duration.toFixed(2)}ms (>50ms threshold)`
      );
  }
  private async showConfirmationDialog(
    command: NavigationCommand
  ): Promise<boolean> {
    return this.modalHelper.showConfirmationDialog(command);
  }
  private validateCommand(command: NavigationCommand): boolean {
    if (command.handler === undefined) return false;
    switch (command.key) {
      case 'b':
        if (this.navigationState.previousStepId === undefined)
          throw new Error('No previous step available');
        return true;
      case 'd':
        if (this.navigationState.currentStepId === '')
          throw new Error('No current step available');
        return true;
      default:
        return true;
    }
  }
  private validateNavigationState(): boolean {
    const state = this.navigationState;
    return Boolean(
      state !== null &&
        state !== undefined &&
        typeof state.currentStepId === 'string' &&
        Array.isArray(state.completedSteps) &&
        Array.isArray(state.skippedSteps) &&
        typeof state.hasUnsavedChanges === 'boolean' &&
        ['list', 'detail'].includes(state.viewMode)
    );
  }
  private getCommandPriority(command: NavigationCommand): number {
    const priorities: Record<string, number> = {
      q: 10,
      r: 9,
      d: 8,
      n: 7,
      Enter: 7,
      b: 6,
      s: 5,
      l: 4,
      '?': 3,
    };
    return priorities[command.key] || 1;
  }
  private handleCommandError(command: NavigationCommand, error: Error): void {
    this.visualFeedback.showCommandFeedback(
      command.key,
      'error',
      error.message
    );
    this.eventBus.publishSync('navigation-command-error', {
      commandId: command.id,
      key: command.key,
      error: error.message,
      state: this.getNavigationState(),
    });
    const isRetryable = !(
      error.message.includes('validation failed') ||
      error.message.includes('timed out') ||
      error.message.includes('execution timeout')
    );
    if (isRetryable) throw error;
  }
  private handleStateChange(message: BusMessage): void {
    const { newState } = message.data as { newState: NavigationState };
    if (newState !== undefined) this.updateNavigationState(newState);
  }
  private async showHelpOverlay(): Promise<void> {
    await this.modalHelper.showHelpOverlay(
      Array.from(this.registeredCommands.values())
    );
  }
  private async quitWithUnsavedCheck(): Promise<void> {
    await this.modalHelper.showQuitConfirmation(
      this.navigationState.hasUnsavedChanges
    );
  }
  public getNavigationState(): NavigationState {
    return { ...this.navigationState };
  }
  public updateNavigationState(updates: Partial<NavigationState>): void {
    this.navigationState = { ...this.navigationState, ...updates };
    this.commandExecutor.navigationState = this.navigationState;
  }
  public getQueueStatus() {
    return this.commandQueue.getStatus();
  }
  public render(_props: unknown): string {
    return this.visualFeedback.render(_props);
  }
  public onMount(): void {
    super.onMount();
    this.visualFeedback.onMount();
  }
  public onUnmount(): void {
    if (this.subscriberId !== undefined)
      this.eventBus.unsubscribe(this.subscriberId);
    this.commandQueue.destroy();
    this.visualFeedback.onUnmount();
    super.onUnmount();
  }
}
