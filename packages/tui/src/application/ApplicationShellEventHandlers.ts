import { createLogger } from '@checklist/core/utils/logger';
import { InputEvent } from '../framework/ApplicationLoop';
import { ApplicationState } from './ApplicationShellConfig';

const logger = createLogger('checklist:tui:application-shell-events');

export class ApplicationShellEventHandlers {
  private state: ApplicationState;

  constructor(state: ApplicationState) {
    this.state = state;
  }

  public handleInput(input: InputEvent): void {
    logger.debug({ msg: 'Input received', input });
  }

  public handleResize(width: number, height: number): void {
    this.state.terminal.width = width;
    this.state.terminal.height = height;
    logger.debug({ msg: 'Terminal resized', width, height });
  }

  public handleError(error: Error): void {
    this.state.errorState = {
      error,
      timestamp: Date.now(),
      context: {
        focus: this.state.focus,
        layout: this.state.layout,
      },
    };
    logger.error({ msg: 'Application error', error: error.message });
  }

  public handleSignal(signalType: string): void {
    logger.info({ msg: 'Received signal', signal: signalType });
  }
}
