import type { MemoryTracker } from './MemoryTracker';
import type { MetricsCollector } from './MetricsCollector';
import type { PerformanceMonitor } from './PerformanceMonitor';
import type { StartupProfiler } from './StartupProfiler';

export class PerformanceEventManager {
  private handlers: Map<string, Set<Function>> = new Map();
  private metricsCollector: MetricsCollector;
  private emitCallback: (event: string, data: unknown) => void;

  constructor(
    metricsCollector: MetricsCollector,
    emitCallback: (event: string, data: unknown) => void
  ) {
    this.metricsCollector = metricsCollector;
    this.emitCallback = emitCallback;
  }

  emit(event: string, data?: unknown): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => handler(data));
    }
  }

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.add(handler);
    }
  }

  off(event: string, handler: Function): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
    }
  }

  clear(): void {
    this.handlers.clear();
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }

  setupEventHandlers(
    _monitor: PerformanceMonitor,
    _startupProfiler: StartupProfiler,
    _memoryTracker: MemoryTracker,
    _metricsCollector: MetricsCollector
  ): void {
    // Setup event handlers for different performance components
    // This would wire up cross-component communication
  }
}
