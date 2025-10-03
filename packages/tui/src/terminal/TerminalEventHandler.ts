import { createLogger } from '@checklist/core/utils/logger';
import { TerminalStateManager } from './TerminalStateManager';

const logger = createLogger('checklist:tui:terminal-event-handler');

export class TerminalEventHandler {
  private resizeHandler: (() => void) | null = null;
  private signalHandlers: Map<NodeJS.Signals, () => void> = new Map();
  private isInitialized = false;

  constructor(private state: TerminalStateManager) {}

  public setupResizeHandling(): void {
    if (this.resizeHandler) {
      return; // Already set up
    }

    if (process.stdout.isTTY && process.stdin.isTTY) {
      this.resizeHandler = () => {
        const { columns, rows } = process.stdout;
        this.state.setDimensions(columns, rows);
        logger.debug({
          msg: 'Terminal resized',
          width: columns,
          height: rows,
        });
      };

      process.stdout.on('resize', this.resizeHandler);
      logger.debug({ msg: 'Resize handling enabled' });
    }
  }

  public setupSignalHandlers(): void {
    if (this.isInitialized) {
      return; // Already set up
    }

    const signals: NodeJS.Signals[] = [
      'SIGINT',
      'SIGTERM',
      'SIGUSR1',
      'SIGUSR2',
    ];

    signals.forEach((signal) => {
      const handler = () => {
        logger.debug({ msg: `Received signal: ${signal}` });
        this.cleanup();
        process.exit(0);
      };

      // Store the handler so we can remove it later
      this.signalHandlers.set(signal, handler);
      process.on(signal, handler);
    });

    this.isInitialized = true;
    logger.debug({ msg: 'Signal handlers enabled' });
  }

  public cleanup(): void {
    if (this.resizeHandler) {
      process.stdout.off('resize', this.resizeHandler);
      this.resizeHandler = null;
      logger.debug({ msg: 'Resize handler cleaned up' });
    }

    // Remove signal handlers using the stored references
    this.signalHandlers.forEach((handler, signal) => {
      process.off(signal, handler);
    });
    this.signalHandlers.clear();
    this.isInitialized = false;
    logger.debug({ msg: 'Signal handlers cleaned up' });
  }
}
