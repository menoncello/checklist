import { EventHandlers } from './EventHandlers';

export class PerformanceMonitorEventHandlers {
  constructor(private eventHandlers: EventHandlers) {}

  public on(event: string, handler: (...args: unknown[]) => void): void {
    this.eventHandlers.on(event, handler);
  }

  public off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventHandlers.off(event, handler);
  }

  public emit(event: string, data: unknown): void {
    this.eventHandlers.emit(event, data);
  }
}
