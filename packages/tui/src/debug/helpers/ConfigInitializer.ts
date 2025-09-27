export interface DebugConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  showOverlay: boolean;
  showMetrics: boolean;
  showComponentTree: boolean;
  showEventLog: boolean;
  showPerformanceMetrics: boolean;
  maxLogEntries: number;
  enableProfiling: boolean;
  hotkeys: Record<string, string>;
  overlayPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface DebugMetrics {
  renderTime: number;
  componentCount: number;
  eventCount: number;
  memoryUsage: number;
  fps: number;
  lastUpdate: number;
}

export class ConfigInitializer {
  static createDefaultConfig(override: Partial<DebugConfig> = {}): DebugConfig {
    return {
      enabled: false,
      logLevel: 'debug',
      showOverlay: true,
      showMetrics: true,
      showComponentTree: true,
      showEventLog: true,
      showPerformanceMetrics: true,
      maxLogEntries: 1000,
      enableProfiling: false,
      hotkeys: {
        toggle: 'F12',
        logs: '1',
        metrics: '2',
        components: '3',
        events: '4',
        performance: '5',
        clear: 'c',
        export: 'e',
      },
      ...override,
    };
  }

  static createDefaultMetrics(): DebugMetrics {
    return {
      renderTime: 0,
      componentCount: 0,
      eventCount: 0,
      memoryUsage: 0,
      fps: 60,
      lastUpdate: Date.now(),
    };
  }

  static setupEventCapture(
    logFunction: (
      level: string,
      category: string,
      message: string,
      data?: unknown
    ) => void
  ): void {
    if (typeof process !== 'undefined') {
      // Capture uncaught exceptions
      process.on('uncaughtException', (error) => {
        logFunction('error', 'System', 'Uncaught exception', {
          error: error.message,
          stack: error.stack,
        });
      });

      // Capture unhandled promise rejections
      process.on('unhandledRejection', (reason, promise) => {
        logFunction('error', 'System', 'Unhandled promise rejection', {
          reason,
          promise,
        });
      });
    }
  }
}
