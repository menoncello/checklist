import { createLogger } from '@checklist/core/utils/logger';
import { InputEvent } from '../framework/ApplicationLoop';
import { ApplicationState } from './ApplicationShellConfig';

const logger = createLogger('checklist:tui:application-shell-lifecycle');

export class ApplicationShellLifecycle {
  constructor(private state: ApplicationState) {}

  public async initializeSubsystems(): Promise<void> {
    logger.debug({ msg: 'Initializing application subsystems' });
  }

  public displaySplashScreen(): void {
    logger.debug({ msg: 'Displaying splash screen' });
  }

  public recordStartupMetrics(): void {
    logger.debug({ msg: 'Recording startup metrics' });
  }

  public async handleInitializationError(error: Error): Promise<void> {
    logger.error({
      msg: 'Application initialization failed',
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }

  public async start(): Promise<void> {
    logger.debug({ msg: 'Starting application' });
  }

  public async stop(): Promise<void> {
    logger.debug({ msg: 'Stopping application' });
  }

  public async shutdown(): Promise<void> {
    logger.debug({ msg: 'Shutting down application' });
  }

  public showSplashScreen(): void {
    logger.debug({ msg: 'Showing splash screen' });
  }

  public handleInput(input: InputEvent): void {
    logger.debug({
      msg: 'Handling input event',
      inputType: input.type,
      key: input.key,
    });
  }

  public handleResize(width: number, height: number): void {
    logger.debug({
      msg: 'Handling resize event',
      width,
      height,
    });
  }

  public updateLayoutDimensions(width: number, height: number): void {
    this.state.terminal.width = width;
    this.state.terminal.height = height;

    if (this.state.layout.type === 'split-pane') {
      const leftWidth = Math.floor(width * this.state.layout.ratio);
      const rightWidth = width - leftWidth;

      this.state.layout.leftPanel.width = leftWidth;
      this.state.layout.leftPanel.height = height;
      this.state.layout.rightPanel.width = rightWidth;
      this.state.layout.rightPanel.height = height;
    }

    logger.debug({
      msg: 'Updated layout dimensions',
      width,
      height,
      leftWidth: this.state.layout.leftPanel.width,
      rightWidth: this.state.layout.rightPanel.width,
    });
  }

  public handleSignal(signalType: string): void {
    logger.debug({ msg: `Handling signal: ${signalType}` });
    this.handleSignalByType(signalType);
  }

  private handleSignalByType(signalType: string): void {
    switch (signalType) {
      case 'SIGINT':
      case 'SIGTERM':
        logger.info({
          msg: 'Received termination signal, initiating shutdown',
        });
        break;
      case 'SIGUSR1':
        logger.info({ msg: 'Received user signal 1' });
        break;
      case 'SIGUSR2':
        logger.info({ msg: 'Received user signal 2' });
        break;
      default:
        logger.warn({ msg: `Unknown signal type: ${signalType}` });
        break;
    }
  }

  public handleError(error: Error): void {
    logger.error({
      msg: 'Application error occurred',
      error: error.message,
      stack: error.stack,
    });
    this.updateErrorState(error);
  }

  private updateErrorState(error: Error): void {
    logger.error({
      msg: 'Updating error state',
      error: error.message,
    });
  }
}
