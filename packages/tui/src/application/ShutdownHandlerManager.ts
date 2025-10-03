import { createLogger } from '@checklist/core/utils/logger';

const logger = createLogger('checklist:tui:shutdown-handler-manager');

export class ShutdownHandlerManager {
  private handlers: Map<string, () => Promise<void>> = new Map();

  public addHandler(id: string, executor: () => Promise<void>): void {
    this.handlers.set(id, executor);

    logger.debug({
      msg: 'Shutdown handler added',
      handlerId: id,
    });
  }

  public removeHandler(id: string): boolean {
    const removed = this.handlers.delete(id);

    if (removed) {
      logger.debug({
        msg: 'Shutdown handler removed',
        handlerId: id,
      });
    }

    return removed;
  }

  public getHandlers(): Map<string, () => Promise<void>> {
    return new Map(this.handlers);
  }

  public getHandlerCount(): number {
    return this.handlers.size;
  }

  public clear(): void {
    this.handlers.clear();
    logger.debug({ msg: 'All shutdown handlers cleared' });
  }
}
