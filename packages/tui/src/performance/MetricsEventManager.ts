export class MetricsEventManager {
  private handlers: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    const handlers = this.handlers.get(event);
    if (handlers != null) {
      handlers.push(handler);
    }
  }

  off(event: string, handler?: Function): void {
    if (!this.handlers.has(event)) return;

    if (handler) {
      const handlers = this.handlers.get(event);
      if (handlers != null) {
        const index = handlers.indexOf(handler);
        if (index >= 0) {
          handlers.splice(index, 1);
        }
      }
    } else {
      this.handlers.delete(event);
    }
  }

  emit(event: string, data?: unknown): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
