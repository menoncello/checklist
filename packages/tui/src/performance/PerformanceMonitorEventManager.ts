import type { PerformanceMonitorEventManager as BaseEventManager } from './helpers/PerformanceMonitorEventManager';

export class PerformanceMonitorEventManagerWrapper {
  constructor(private eventManager: BaseEventManager) {}

  public on(event: string, handler: Function): void {
    this.eventManager.on(event, handler);
  }

  public off(event: string, handler: Function): void {
    this.eventManager.off(event, handler);
  }

  public emit(event: string, data?: unknown): void {
    this.eventManager.emit(event, data);
  }

  public clear(): void {
    this.eventManager.clear();
  }
}
