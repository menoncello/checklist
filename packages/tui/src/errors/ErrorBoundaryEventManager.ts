export class ErrorBoundaryEventManager {
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

  emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in ErrorBoundary event handler for '${event}':`,
            error
          );
        }
      });
    }
  }

  clear(): void {
    this.eventHandlers.clear();
  }

  removeAllListeners(): void {
    this.clear();
  }
}
