export class PerformanceEventManager {
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  constructor() {}

  emit(event: string, data?: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
