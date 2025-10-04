import { createLogger } from '@checklist/core/utils/logger';
import { EventHandler, LifecycleState } from '../framework/UIFramework';

const logger = createLogger('checklist:tui:application-shell-events');

export class ApplicationShellEvents {
  private eventHandlers = new Map<string, Set<EventHandler>>();

  public on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  public emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          logger.error({
            msg: 'Event handler failed',
            event,
            error: (error as Error).message,
          });
        }
      });
    }
  }

  public emitLifecycleStateChanged(state: LifecycleState): void {
    this.emit('lifecycleStateChanged', state);
  }

  public emitPerformanceAlert(alert: unknown): void {
    this.emit('performanceAlert', alert);
  }

  public emitError(error: Error): void {
    this.emit('error', error);
  }
}
