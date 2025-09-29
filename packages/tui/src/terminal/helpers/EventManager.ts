import type { EventHandler } from '../types';

export class EventManager {
  private eventHandlers = new Map<string, Set<EventHandler>>();

  public on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.delete(handler);
    }
  }

  public emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (_error) {
          console.error(
            `Error in capability detector event handler for '${event}':`,
            _error
          );
        }
      });
    }
  }
}
