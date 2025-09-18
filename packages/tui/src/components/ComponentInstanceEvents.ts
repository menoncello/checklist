export class ComponentInstanceEventHandler {
  private eventHandlers = new Map<string, Set<Function>>();

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
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
          console.error(
            `Error in component instance event handler for '${event}':`,
            error
          );
        }
      });
    }
  }

  public clear(): void {
    this.eventHandlers.clear();
  }

  public getHandlerCount(): number {
    return Array.from(this.eventHandlers.values()).reduce(
      (total, handlers) => total + handlers.size,
      0
    );
  }

  public getHandlers(): Map<string, Set<Function>> {
    return this.eventHandlers;
  }
}
