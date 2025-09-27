import { createLogger } from '@checklist/core/utils/logger';

const logger = createLogger('checklist:tui:event-emitter');

export class EventEmitter {
  private eventHandlers = new Map<string, Set<Function>>();

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.delete(handler);
    }
  }

  protected emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          logger.error({
            msg: 'Error in event handler',
            event,
            error,
          });
        }
      });
    }
  }

  protected clearEventHandlers(): void {
    this.eventHandlers.clear();
  }
}
