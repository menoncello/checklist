export class EventHandlers {
  private eventHandlers = new Map<string, Set<Function>>();

  public on(event: string, callback: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(callback);
    }
  }

  public off(event: string, callback?: Function): void {
    if (!this.eventHandlers.has(event)) return;
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;

    if (callback) {
      handlers.delete(callback);
    } else {
      handlers.clear();
    }
    if (handlers.size === 0) {
      this.eventHandlers.delete(event);
    }
  }

  public emit(event: string, ...args: unknown[]): void {
    if (!this.eventHandlers.has(event)) return;
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;

    handlers.forEach((handler) => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  public clear(): void {
    this.eventHandlers.clear();
  }
}
