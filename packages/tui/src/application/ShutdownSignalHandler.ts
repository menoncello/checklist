import { createLogger } from '@checklist/core/utils/logger';

const logger = createLogger('checklist:tui:shutdown-signal');

export class ShutdownSignalHandler {
  constructor(
    private executeGracefulShutdown: (reason: string) => Promise<void>
  ) {}

  public setupSignalHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info({ msg: 'Received shutdown signal', signal });
      await this.executeGracefulShutdown(signal);
    };

    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.once('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

    logger.debug({ msg: 'Signal handlers configured' });
  }

  public cleanupSignalHandlers(): void {
    // Remove all signal listeners
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGQUIT');

    logger.debug({ msg: 'Signal handlers cleaned up' });
  }
}
